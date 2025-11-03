import express from "express";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import Order from "../models/Order.js";
import { v4 as uuidv4 } from "uuid";
import { ORDER_STATUS, PAYMENT_STATUS } from "../constants/constants.js";
import Razorpay from "razorpay";
const router = express.Router();
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});
/* -----------------------------------------------------
   🔐 Middleware: Verify user session
----------------------------------------------------- */
function verifySession(req, res, next) {
    try {
        const token = req.cookies?.session;
        if (!token) return res.status(401).json({ success: false, message: "Unauthorized" });

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.userId = decoded.uid;
        next();
    } catch (err) {
        console.error("Session verify error:", err.message);
        res.status(401).json({ success: false, message: "Invalid or expired session" });
    }
}

/* -----------------------------------------------------
   👤 Get logged-in user
----------------------------------------------------- */
router.get("/me", verifySession, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        res.json({ success: true, user });
    } catch (err) {
        console.error("Fetch user error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* -----------------------------------------------------
   ✏️ Update user details
----------------------------------------------------- */
router.patch("/me", verifySession, async (req, res) => {
    try {
        const updates = req.body || {};
        const user = await User.findByIdAndUpdate(req.userId, { $set: updates }, { new: true });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        res.json({ success: true, user });
    } catch (err) {
        console.error("User update error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* -----------------------------------------------------
   🛒 Save full cart (local → DB)
----------------------------------------------------- */
router.post("/cart/save", verifySession, async (req, res) => {
    try {
        const { cart } = req.body;
        if (!Array.isArray(cart)) return res.status(400).json({ success: false, message: "Invalid cart format" });

        const updatedUser = await User.findByIdAndUpdate(req.userId, { $set: { cart } }, { new: true });
        if (!updatedUser) return res.status(404).json({ success: false, message: "User not found" });

        res.json({ success: true, cart: updatedUser.cart });
    } catch (err) {
        console.error("Cart save error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* -----------------------------------------------------
   🛍️ Get user cart
----------------------------------------------------- */
router.get("/cart", verifySession, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });
        res.json({ success: true, cart: user.cart || [] });
    } catch (err) {
        console.error("Fetch cart error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* -----------------------------------------------------
   🔁 Merge guest → DB cart
----------------------------------------------------- */
router.post("/cart/sync", verifySession, async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items)) return res.status(400).json({ success: false, message: "Invalid cart data" });

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const mergedMap = new Map();
        for (const i of user.cart || []) mergedMap.set(i.key, { ...i });
        for (const i of items) {
            if (mergedMap.has(i.key)) mergedMap.get(i.key).count += i.count;
            else mergedMap.set(i.key, i);
        }

        user.cart = Array.from(mergedMap.values());
        await user.save();

        res.json({ success: true, cart: user.cart });
    } catch (err) {
        console.error("Cart sync error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* -----------------------------------------------------
   📦 Create new order
----------------------------------------------------- */
router.post("/orders", verifySession, async (req, res) => {
    try {
        const { order } = req.body;
        if (!order) return res.status(400).json({ success: false, message: "Order data required" });

        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const orderId = `ORD-${uuidv4().split("-")[0].toUpperCase()}`;

        const newOrder = await Order.create({
            orderId,
            emailId: user.emailId,
            phoneNumber: user.phoneNumber,
            items: order.items,
            address: order.address,
            total: order.total,
            shipping: order.shipping,
            paymentMethod: order.paymentMethod || "Razorpay",
            paymentStatus: PAYMENT_STATUS.PENDING,
            status: ORDER_STATUS.PENDING,
            currentStep: 0,
            statusHistory: [{ step: 0, label: ORDER_STATUS.PENDING, date: new Date() }],
        });

        user.orders.push(orderId);
        user.cart = [];
        await user.save();

        res.json({ success: true, order: newOrder });
    } catch (err) {
        console.error("Order create error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* -----------------------------------------------------
   📜 Get all my orders
----------------------------------------------------- */
router.get("/orders", verifySession, async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const orders = await Order.find({
            $or: [{ emailId: user.emailId }, { phoneNumber: user.phoneNumber }],
        }).sort({ createdAt: -1 });

        res.json({ success: true, orders });
    } catch (err) {
        console.error("Fetch orders error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

export default router;
