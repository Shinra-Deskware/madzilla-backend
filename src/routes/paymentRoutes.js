import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import Order from "../models/Order.js";
import User from "../models/User.js";
import { v4 as uuidv4 } from "uuid";
import { ORDER_STATUS, PAYMENT_STATUS } from "../constants/constants.js";

const router = express.Router();

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 🪙 helper - make cart signature
const makeCartSignature = (items, total, shipping) => {
    const sorted = [...items].sort((a, b) => a.key.localeCompare(b.key));
    const cartStr = JSON.stringify({ items: sorted, total, shipping });
    return crypto.createHash("sha256").update(cartStr).digest("hex");
};

// 🪙 Create Razorpay Order + Pending Order in DB
router.post("/order", async (req, res) => {
    try {
        const { phoneNumber, items, total, shipping, address, orderId } = req.body;
        const amount = Math.round((total + shipping) * 100);
        const newSignature = makeCartSignature(items, total, shipping);
        // ✅ Update user address if changed
        await User.findOneAndUpdate(
            { phoneNumber },
            {
                $set: {
                    fullName: address.fullName,
                    emailId: address.emailId,
                    phoneNumber: address.phoneNumber,
                    "address.state": address.state,
                    "address.city": address.city,
                    "address.pinCode": address.pincode,
                    "address.addr1": address.addr1
                },
            },
            { new: true }
        );
        // ✅ If orderId exists → reuse existing order
        let existingOrder = null;
        if (orderId) {
            existingOrder = await Order.findOne({ orderId, phoneNumber });
        }
        // 🧾 Create Razorpay order
        const razorpayOrder = await razorpay.orders.create({
            amount,
            currency: "INR",
            receipt: `rcpt_${Date.now()}`,
        });
        // 📝 If order already exists, update it instead of creating new
        if (existingOrder) {
            existingOrder.razorpay_order_id = razorpayOrder.id;
            existingOrder.paymentStatus = PAYMENT_STATUS.PENDING;
            existingOrder.status = ORDER_STATUS.PENDING;
            existingOrder.currentStep = 0; // ensure reset if retried
            existingOrder.updatedAt = new Date();
            await existingOrder.save();
        } else {
            const newOrder = await Order.create({
                phoneNumber,
                orderId: `ORD-${uuidv4().split("-")[0].toUpperCase()}`,
                items,
                total,
                shipping,
                address,
                razorpay_order_id: razorpayOrder.id,
                paymentStatus: PAYMENT_STATUS.PENDING,
                status: ORDER_STATUS.PENDING,
                statusHistory: [{ step: 0, label: ORDER_STATUS.PENDING, date: new Date() }],
                currentStep: 0,
            });
            existingOrder = newOrder;
        }
        res.json({
            key: process.env.RAZORPAY_KEY_ID,
            order_id: existingOrder.razorpay_order_id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            orderId: existingOrder.orderId,
        });
    } catch (err) {
        console.error("Payment order create error:", err);
        res.status(500).json({ success: false, message: "Failed to create order" });
    }
});


// 🧾 Verify Razorpay Payment
router.post("/verify", async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, phoneNumber } = req.body;
        const order = await Order.findOne({ razorpay_order_id, phoneNumber });
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });
        // ⏳ If already handled
        if (order.paymentStatus === PAYMENT_STATUS.PAID) {
            return res.json({ success: true, message: "Already paid", order });
        }
        if (order.paymentStatus === PAYMENT_STATUS.FAILED) {
            return res.status(400).json({ success: false, message: "Payment already failed" });
        }
        // 1️⃣ Verify signature
        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");
        if (generatedSignature !== razorpay_signature) {
            order.paymentStatus = PAYMENT_STATUS.FAILED;
            order.status = ORDER_STATUS.PAYMENT_FAILED; // <- use order status, not payment code
            order.currentStep = 0;

            // 📝 Track failed payment id
            order.failedPaymentId = razorpay_payment_id;

            // 🏷️ Push into history
            order.statusHistory.push({
                step: 0,
                label: ORDER_STATUS.PAYMENT_FAILED,
                date: new Date(),
            });

            order.updatedAt = new Date();
            await order.save();

            return res.status(400).json({ success: false, message: "Signature mismatch" });
        }
        // 2️⃣ Update order after successful payment
        order.razorpay_payment_id = razorpay_payment_id;
        order.razorpay_signature = razorpay_signature;
        order.paymentStatus = PAYMENT_STATUS.PAID;
        order.status = ORDER_STATUS.ORDER_PLACED;
        order.currentStep = 1;
        order.statusHistory.push({ step: 1, label: ORDER_STATUS.ORDER_PLACED, date: new Date() });
        order.updatedAt = new Date();
        await order.save();
        // 3️⃣ Link to user + clear cart
        const user = await User.findOne({ phoneNumber });
        if (user) {
            user.orders = user.orders || [];
            if (!user.orders.includes(order.orderId)) {
                user.orders.push(order.orderId);
            }
            user.cart = [];
            await user.save();
        }
        res.json({ success: true, message: "Payment verified", order });
    } catch (err) {
        console.error("❌ Payment verify error:", err);
        res.status(500).json({ success: false, message: "Server error during verification" });
    }
});

export default router;
