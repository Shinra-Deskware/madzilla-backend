import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { v4 as uuidv4 } from "uuid";
import { ORDER_STATUS, PAYMENT_STATUS } from "../constants/constants.js";
import Product from "../models/Product.js";
const router = express.Router();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 🪙 Create Razorpay Order + Pending Order in DB
router.post("/payment/order", async (req, res) => {
    try {
        const { emailId, items, total, shipping, address = {}, orderId } = req.body || {};
        // ✅ Re-calculate total on server to block tampering
        let verifiedTotal = 0;

        for (const item of items) {
            const p = await Product.findById(item.productId).select("price");
            if (!p) return res.status(400).json({ success: false, message: "Invalid product" });

            const qty = item.qty ?? item.count ?? 1;
            verifiedTotal += p.price * qty;
        }

        // ✅ Replace trust client price
        const computedTotal = verifiedTotal;
        const computedGrand = computedTotal + shipping;

        // ❗ If client sent wrong total → block or override (your choice)
        if (Number(total) !== computedTotal) {
            console.warn("⚠️ Price tamper detected:", { sent: total, real: computedTotal });
            // Option A: Hard block
            // return res.status(400).json({ success: false, message: "Price mismatch" });

            // ✅ Option B: silently enforce real price
        }

        // ... (your validations unchanged)

        const user = await User.findOne({ emailId });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        // ✅ If orderId exists & not paid, reuse Razorpay order (prevents duplicates)
        if (orderId) {
            const existing = await Order.findOne({ orderId, emailId });

            if (existing && existing.paymentStatus !== "PAID" && existing.razorpay_order_id) {
                return res.json({
                    success: true,
                    key: process.env.RAZORPAY_KEY_ID,
                    razorpay_order_id: existing.razorpay_order_id,
                    amount: Math.round((existing.total + existing.shipping) * 100),
                    currency: "INR",
                    orderId: existing.orderId,
                    reused: true
                });
            }
        }

        // 🔎 Try fetching existing order first
        let orderDoc = orderId ? await Order.findOne({ orderId, emailId }) : null;

        // ✅ If already paid, do NOT create a new Razorpay order
        if (orderDoc && orderDoc.paymentStatus === PAYMENT_STATUS.PAID) {
            return res.json({
                success: true,
                key: process.env.RAZORPAY_KEY_ID,
                razorpay_order_id: orderDoc.razorpay_order_id,
                amount: Math.round((total + shipping) * 100),
                currency: "INR",
                orderId: orderDoc.orderId
            });
        }

        // 🧾 Create Razorpay order only now (needed for new / pending)
        const amountPaise = Math.round(computedGrand * 100); // ✅ server-verified amount
        const receipt = `rcpt_${Date.now()}`;
        const rzOrder = await razorpay.orders.create({
            amount: amountPaise,
            currency: "INR",
            receipt,
        });

        if (orderDoc) {
            // ♻️ Update existing pending order
            orderDoc.items = items;
            orderDoc.total = total;
            orderDoc.shipping = shipping;
            orderDoc.address = address;                   // ✅ keep address in order
            orderDoc.razorpay_order_id = rzOrder.id;
            orderDoc.razorpay_receipt = receipt;
            orderDoc.paymentStatus = PAYMENT_STATUS.PENDING;
            orderDoc.status = ORDER_STATUS.PENDING;
            orderDoc.currentStep = 0;

            // avoid duplicate PENDING entries
            const last = orderDoc.statusHistory?.[orderDoc.statusHistory.length - 1];
            if (!last || last.label !== ORDER_STATUS.PENDING) {
                orderDoc.statusHistory.push({ step: 0, label: ORDER_STATUS.PENDING, date: new Date() });
            }

            orderDoc.updatedAt = new Date();
            await orderDoc.save();
        } else {
            // 🆕 New order
            orderDoc = await Order.create({
                emailId,
                orderId: `ORD-${uuidv4().split("-")[0].toUpperCase()}`,
                items,
                total,
                shipping,
                address,
                razorpay_order_id: rzOrder.id,
                razorpay_receipt: receipt,
                paymentStatus: PAYMENT_STATUS.PENDING,
                status: ORDER_STATUS.PENDING,
                statusHistory: [{ step: 0, label: ORDER_STATUS.PENDING, date: new Date() }],
                currentStep: 0,
            });
        }

        // 👤 Update user doc (unchanged)
        const updateUser = { $addToSet: { orders: orderDoc.orderId } };
        const addrSet = {};
        if (address.fullName) addrSet.fullName = address.fullName;
        if (address.phoneNumber) addrSet.phoneNumber = address.phoneNumber;
        if (address.emailId) addrSet.emailId = address.emailId;
        if (address.state) addrSet["address.state"] = address.state;
        if (address.city) addrSet["address.city"] = address.city;
        if (address.pincode) addrSet["address.pinCode"] = address.pincode;
        if (address.addr1) addrSet["address.addr1"] = address.addr1;
        if (Object.keys(addrSet).length) updateUser.$set = addrSet;
        await User.updateOne({ _id: user._id }, updateUser);

        // ▶️ Response for Razorpay init
        res.json({
            success: true,
            key: process.env.RAZORPAY_KEY_ID,
            razorpay_order_id: orderDoc.razorpay_order_id,
            amount: amountPaise,
            currency: "INR",
            orderId: orderDoc.orderId,
        });
    } catch (err) {
        console.error("Payment /order error:", err);
        res.status(500).json({ success: false, message: "Failed to create order" });
    }
});


// 🧾 Verify Razorpay Payment
router.post("/payment/verify", async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, emailId, orderId } = req.body;
        if (!emailId) return res.status(400).json({ success: false, message: "emailId is required" });

        const order = await Order.findOne({ orderId, emailId });
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        if (order.paymentStatus === PAYMENT_STATUS.PAID) {
            return res.json({ success: true, message: "Already paid", order });
        }
        if (order.paymentStatus === PAYMENT_STATUS.FAILED) {
            return res.status(400).json({ success: false, message: "Payment already failed" });
        }

        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");

        if (generatedSignature !== razorpay_signature) {
            order.paymentStatus = PAYMENT_STATUS.FAILED;
            order.status = ORDER_STATUS.PAYMENT_FAILED;
            order.currentStep = 0;
            order.failedPaymentId = razorpay_payment_id;
            order.statusHistory.push({ step: 0, label: ORDER_STATUS.PAYMENT_FAILED, date: new Date() });
            order.updatedAt = new Date();
            await order.save();
            return res.status(400).json({ success: false, message: "Signature mismatch" });
        }

        // ✅ Persist the verified RZ ids too
        order.razorpay_order_id = razorpay_order_id;      // <<< add this
        order.razorpay_payment_id = razorpay_payment_id;
        order.razorpay_signature = razorpay_signature;
        order.paymentStatus = PAYMENT_STATUS.PAID;
        order.status = ORDER_STATUS.ORDER_PLACED;
        order.currentStep = 1;
        order.statusHistory.push({ step: 1, label: ORDER_STATUS.ORDER_PLACED, date: new Date() });
        order.updatedAt = new Date();
        await order.save();

        const user = await User.findOne({ emailId });
        if (user) {
            if (!user.orders) user.orders = [];
            if (!user.orders.includes(order.orderId)) user.orders.push(order.orderId);
            user.cart = [];
            await user.save();
        }

        return res.json({ success: true, message: "Payment verified", order });
    } catch (err) {
        console.error("❌ Payment verify error:", err);
        return res.status(500).json({ success: false, message: "Server error during verification" });
    }
});

// ✅ Final confirm (frontend call after Razorpay success)
router.post("/payment/:orderId/confirm", async (req, res) => {
    try {
        const { orderId } = req.params;

        const order = await Order.findOne({ orderId });
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        // ✅ If payment done but status not updated → fix it here
        if (order.paymentStatus === PAYMENT_STATUS.PAID && order.currentStep < 1) {
            order.status = ORDER_STATUS.ORDER_PLACED;
            order.currentStep = 1;
            order.statusHistory.push({
                step: 1,
                label: ORDER_STATUS.ORDER_PLACED,
                date: new Date(),
            });
            order.updatedAt = new Date();
            await order.save();
            return res.json({ success: true, message: "Order confirmed", order });
        }

        // ❗ If payment pending, don't block but tell UI
        if (order.paymentStatus !== PAYMENT_STATUS.PAID) {
            return res.status(200).json({
                success: true,
                message: "Order created but payment pending",
                order
            });
        }

        // ✅ Already placed — just return it
        return res.json({ success: true, message: "Order already confirmed", order });
    } catch (err) {
        console.error("Order confirm error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

export default router;
