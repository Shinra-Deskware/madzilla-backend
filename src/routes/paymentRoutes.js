import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import Order from "../models/Order.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import { v4 as uuidv4 } from "uuid";
import { ORDER_STATUS, PAYMENT_STATUS } from "../constants/constants.js";
import { sendOrderStatusEmail } from "../utils/sendOrderStatusEmail.js";

const router = express.Router();

/* -----------------------------------------------------
   🧩 Verify session
----------------------------------------------------- */
function verifySession(req, res, next) {
    try {
        const token = req.cookies?.session;
        if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.uid;
        next();
    } catch {
        return res.status(401).json({ success: false, message: "Invalid or expired session" });
    }
}

/* -----------------------------------------------------
   💳 Razorpay instance
----------------------------------------------------- */
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* -----------------------------------------------------
   🪙 Create Razorpay Order + Pending DB Order
----------------------------------------------------- */
router.post("/neworder", verifySession, async (req, res) => {
    try {
        const { items, shipping = 0, address = {}, retryOrderId } = req.body || {};
        if (!Array.isArray(items) || items.length === 0)
            return res.status(400).json({ success: false, message: "No items" });

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        if (!user.emailId && !user.phoneNumber)
            return res.status(400).json({ success: false, message: "User missing identifier" });

        // 1) Recalculate total from DB (never trust client)
        let verifiedTotal = 0;
        for (const item of items) {
            let p = null;
            if (item.productId && /^[a-f\d]{24}$/i.test(item.productId)) {
                p = await Product.findById(item.productId).select("price");
            } else if (item.key) {
                p = await Product.findOne({ key: item.key }).select("price");
            }
            if (!p) return res.status(400).json({ success: false, message: "Invalid product" });
            const qty = Number(item.qty ?? item.count ?? 1);
            verifiedTotal += Number(p.price) * qty;
        }
        const grand = verifiedTotal + Number(shipping || 0);
        const amountPaise = Math.round(grand * 100);
        const receipt = `rcpt_${Date.now()}`;

        // 2) If retrying an existing order (recommended flow)
        if (retryOrderId) {
            const existing = await Order.findOne({
                orderId: retryOrderId,
                $or: [{ emailId: user.emailId }, { phoneNumber: user.phoneNumber }],
            });

            if (!existing)
                return res.status(404).json({ success: false, message: "Order not found for retry" });

            // Block retry on paid / terminal states
            const terminalStatuses = new Set([
                PAYMENT_STATUS.PAID,
                PAYMENT_STATUS.REFUND_INITIATED,
                PAYMENT_STATUS.REFUND_DONE,
            ]);
            if (terminalStatuses.has(existing.paymentStatus) || existing.status === ORDER_STATUS.CANCELLED) {
                return res.status(400).json({ success: false, message: "Order not eligible for retry" });
            }

            // Create a fresh Razorpay order every retry
            const rzOrder = await razorpay.orders.create({
                amount: amountPaise,
                currency: "INR",
                receipt,
            });

            // Update existing order with refreshed payment refs & current cart snapshot
            existing.items = items;
            existing.address = address;
            existing.total = verifiedTotal;
            existing.shipping = Number(shipping || 0);
            existing.paymentMethod = "Razorpay";
            existing.razorpay_order_id = rzOrder.id;
            existing.razorpay_receipt = receipt;

            // Reset payment flags for clean retry
            existing.paymentStatus = PAYMENT_STATUS.PENDING;
            existing.status = ORDER_STATUS.PENDING;
            existing.currentStep = 0;
            existing.failedPaymentId = undefined;
            existing.razorpay_payment_id = undefined;
            existing.razorpay_signature = undefined;

            // Ensure history has at least PENDING once
            existing.statusHistory = existing.statusHistory || [];
            if (!existing.statusHistory.find(h => h.label === ORDER_STATUS.PENDING)) {
                existing.statusHistory.push({ step: 0, label: ORDER_STATUS.PENDING, date: new Date() });
            }

            await existing.save();
            await sendOrderStatusEmail(existing, "PENDING");

            return res.json({
                success: true,
                key: process.env.RAZORPAY_KEY_ID,
                razorpay_order_id: rzOrder.id,
                amount: amountPaise,
                currency: "INR",
                orderId: existing.orderId,
            });
        }

        // 3) Fresh order (original flow)
        const rzOrder = await razorpay.orders.create({
            amount: amountPaise,
            currency: "INR",
            receipt,
        });

        const orderId = `ORD-${uuidv4().split("-")[0].toUpperCase()}`;
        const order = await Order.create({
            orderId,
            emailId: user.emailId,
            phoneNumber: user.phoneNumber,
            items,
            address,
            total: verifiedTotal,
            shipping: Number(shipping || 0),
            paymentMethod: "Razorpay",
            razorpay_order_id: rzOrder.id,
            razorpay_receipt: receipt,
            paymentStatus: PAYMENT_STATUS.PENDING,
            status: ORDER_STATUS.PENDING,
            currentStep: 0,
            statusHistory: [{ step: 0, label: ORDER_STATUS.PENDING, date: new Date() }],
        });

        // Save/attach to user
        await User.findByIdAndUpdate(req.userId, {
            $set: {
                "address.fullName": address.fullName,
                "address.phoneNumber": address.phoneNumber,
                "address.emailId": user.emailId,
                "address.state": address.state,
                "address.city": address.city,
                "address.pinCode": address.pinCode,
                "address.addr1": address.addr1,
            },
            $addToSet: { orders: orderId },
        });

        await sendOrderStatusEmail(order, "PENDING");

        return res.json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            razorpay_order_id: rzOrder.id,
            amount: amountPaise,
            currency: "INR",
            orderId,
        });
    } catch (err) {
        console.error("neworder error:", err);
        return res.status(500).json({ success: false, message: "Failed" });
    }
});


/* -----------------------------------------------------
   🧾 Client Verification (Signature Only)
   ❗ Do NOT set PAID here — webhook handles final.
----------------------------------------------------- */
router.post("/verify", verifySession, async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

        const user = await User.findById(req.userId);
        const order = await Order.findOne({
            orderId,
            $or: [{ emailId: user.emailId }, { phoneNumber: user.phoneNumber }],
        });

        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        const sign = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (sign !== razorpay_signature) {
            order.paymentStatus = PAYMENT_STATUS.FAILED;
            order.status = ORDER_STATUS.PAYMENT_FAILED;
            order.failedPaymentId = razorpay_payment_id;
            order.statusHistory.push({ step: 0, label: ORDER_STATUS.PAYMENT_FAILED, date: new Date() });
            await order.save();
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }

        order.clientVerified = true;
        order.razorpay_order_id = razorpay_order_id;
        order.razorpay_payment_id = razorpay_payment_id;
        order.razorpay_signature = razorpay_signature;
        await order.save();

        // wipe cart instantly for UX
        user.cart = [];
        await user.save();

        return res.json({ success: true, message: "Payment verified (client)" });
    } catch {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

/* -----------------------------------------------------
   ✅ Client Confirmation after Razorpay success
   DOES NOT change payment status (webhook does)
----------------------------------------------------- */
router.post("/:orderId/confirm", verifySession, async (req, res) => {
    try {
        const { orderId } = req.params;

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const order = await Order.findOne({
            orderId,
            $or: [{ emailId: user.emailId }, { phoneNumber: user.phoneNumber }],
        });

        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        // ✅ Mark client confirmation without touching payment status
        if (!order.clientConfirmed) {
            order.clientConfirmed = true;
            order.clientConfirmedAt = new Date();
            await order.save();
        }

        return res.json({ success: true });
    } catch (err) {
        console.error("Order confirm error:", err);
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

/* -----------------------------------------------------
   🚫 Cancel order → trigger refund
   ❗ Webhook completes refund result
----------------------------------------------------- */
router.post("/order/:orderId/cancel", verifySession, async (req, res) => {
    try {
        const { orderId } = req.params;
        const user = await User.findById(req.userId);

        const order = await Order.findOne({
            orderId,
            $or: [{ emailId: user.emailId }, { phoneNumber: user.phoneNumber }],
        });

        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        if (order.currentStep >= 3)
            return res.status(400).json({ success: false, message: "Cannot cancel" });

        order.status = ORDER_STATUS.CANCELLED;
        order.currentStep = -1;
        order.refundContext = "CANCEL";

        if (order.paymentStatus === PAYMENT_STATUS.PAID) {
            order.paymentStatus = PAYMENT_STATUS.REFUND_INITIATED;
            try {
                const refund = await razorpay.payments.refund.create({
                    payment_id: order.razorpay_payment_id,
                    amount: Math.round(order.total * 100),
                    speed: "optimum",
                });
                order.refundId = refund.id;
                order.refundAttemptedAt = new Date();
            } catch {
                order.paymentStatus = PAYMENT_STATUS.REFUND_REQUESTED;
                await sendOrderStatusEmail(order, "REFUND_FAILED");
            }
        }

        order.statusHistory.push({ step: -1, label: ORDER_STATUS.CANCELLED, date: new Date() });
        order.cancelledDate = new Date();
        await order.save();
        await sendOrderStatusEmail(order, "CANCELLED");
        // restore cart
        const merged = new Map();
        for (const c of user.cart || []) merged.set(c.key, { ...c });
        for (const o of order.items || []) {
            const qty = o.qty ?? o.count ?? 1;
            if (merged.has(o.key)) merged.get(o.key).count += qty;
            else merged.set(o.key, { ...o, count: qty });
        }
        user.cart = Array.from(merged.values());
        await user.save();
        return res.json({ success: true, order, cart: user.cart });
    } catch {
        return res.status(500).json({ success: false, message: "Server error" });
    }
});

export default router;
