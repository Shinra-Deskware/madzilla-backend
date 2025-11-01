import express from 'express'
import User from '../models/User.js'
import jwt from "jsonwebtoken";
import Order from "../models/Order.js";
import { v4 as uuidv4 } from "uuid";
import { ORDER_STATUS, PAYMENT_STATUS } from "../constants/constants.js";


const router = express.Router()

// 🧍 Create new user
router.post('/register', async (req, res) => {
    try {
        const { name, phone } = req.body
        const user = await User.create({ name, phone })
        res.json({ success: true, user })
    } catch (err) {
        res.status(400).json({ success: false, message: err.message })
    }
})

// 👥 Get all users (for testing)
router.get('/', async (req, res) => {
    const users = await User.find()
    res.json(users)
})

// 👤 Get logged-in user
router.get("/me", async (req, res) => {
    const token = req.cookies.session;
    if (!token) return res.json({ user: null });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.uid);
        res.json({ user });
    } catch (err) {
        console.error("JWT verify error:", err.message);
        res.json({ user: null });
    }
});

// ✏️ Update logged-in user details
router.patch("/me", async (req, res) => {
    const token = req.cookies.session;
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const updates = req.body;

        const user = await User.findByIdAndUpdate(
            decoded.uid,
            { $set: updates },
            { new: true }
        );

        res.json({ success: true, user });
    } catch (err) {
        console.error("Update error:", err);
        res.status(400).json({ error: "Failed to update user" });
    }
});


// 🧩 1️⃣ Save full cart (local → DB) safely — replaces cart fully
router.post("/:userId/cart/save", async (req, res) => {
    try {
        const { cart } = req.body;
        if (!Array.isArray(cart)) return res.status(400).json({ message: "Invalid cart format" });

        const updatedUser = await User.findByIdAndUpdate(
            req.params.userId,
            { $set: { cart } },
            { new: true } // ✅ avoids VersionError
        );

        if (!updatedUser) return res.status(404).json({ message: "User not found" });

        res.json({ success: true, cart: updatedUser.cart });
    } catch (err) {
        console.error("Cart save error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});


// 🛒 2️⃣ Get user cart
router.get("/:userId/cart", async (req, res) => {
    try {
        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        res.json(user.cart || []);
    } catch (err) {
        console.error("Fetch cart error:", err);
        res.status(500).json({ message: "Server error" });
    }
});


// 🔁 3️⃣ Merge guest → DB (login sync)
router.post("/:userId/cart/sync", async (req, res) => {
    try {
        const { items } = req.body;
        if (!Array.isArray(items)) return res.status(400).json({ message: "Invalid cart data" });

        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        const existingCart = user.cart || [];
        const mergedMap = new Map();

        // Merge both carts
        for (const item of existingCart) mergedMap.set(item.key, item);
        for (const item of items) {
            if (mergedMap.has(item.key)) {
                mergedMap.get(item.key).count += item.count;
            } else mergedMap.set(item.key, item);
        }

        user.cart = Array.from(mergedMap.values());
        await user.save();

        res.json({ success: true, cart: user.cart });
    } catch (err) {
        console.error("Cart sync error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// ✅ Create new order (save in Orders collection + link to user)
router.post("/:userId/orders", async (req, res) => {
    try {
        const { order } = req.body;
        if (!order) return res.status(400).json({ message: "Order data required" });

        const user = await User.findById(req.params.userId);
        if (!user) return res.status(404).json({ message: "User not found" });

        // 🆔 Generate readable orderId
        const orderId = `ORD-${uuidv4().split("-")[0].toUpperCase()}`;

        // 🏗️ Create order in Orders collection
        const newOrder = await Order.create({
            phoneNumber: user.phoneNumber,
            orderId,
            ...order,
            status: ORDER_STATUS.PENDING,
            currentStep: 0,
            paymentStatus: PAYMENT_STATUS.PENDING,
            statusHistory: [{ step: 0, label: ORDER_STATUS.PENDING, date: new Date() }],
        });

        // 🔗 Link orderId to user
        user.orders = user.orders || [];
        user.orders.push(orderId);
        user.cart = []; // empty cart after confirm
        await user.save();

        res.json({ success: true, order: newOrder });
    } catch (err) {
        console.error("Order save error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// 📦 Fetch all orders by phoneNumber
router.get("/:phone/orders", async (req, res) => {
    try {
        const { phone } = req.params;
        const orders = await Order.find({ phoneNumber: phone }).sort({ createdAt: -1 });

        if (!orders.length) return res.json({ success: true, orders: [] });

        res.json({ success: true, orders });
    } catch (err) {
        console.error("Fetch orders error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// 🚫 Cancel order + restore items to cart
router.post("/:phone/orders/:orderId/cancel", async (req, res) => {
    try {
        const { phone, orderId } = req.params;
        const user = await User.findOne({ phoneNumber: phone });
        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        const order = await Order.findOne({ phoneNumber: phone, orderId });
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        if (order.currentStep >= 3)
            return res.status(400).json({ success: false, message: "Cannot cancel this order now" });

        // 🛑 Set proper cancelled status (no step)
        // ✅ Cancel Order Logic
        if (order.paymentStatus === PAYMENT_STATUS.PAID) {
            order.paymentStatus = PAYMENT_STATUS.REFUND_REQUESTED;
        } else {
            order.paymentStatus = PAYMENT_STATUS.CANCELLED;
        }

        order.status = ORDER_STATUS.CANCELLED;
        order.currentStep = -1;
        order.statusHistory.push({
            step: -1,
            label: ORDER_STATUS.CANCELLED,
            date: new Date()
        });
        order.cancelledDate = new Date();
        order.updatedAt = new Date();
        await order.save();
        // 🛒 Restore cart
        const merged = new Map();
        for (const item of user.cart || []) merged.set(item.key, item);
        for (const item of order.items || []) {
            if (merged.has(item.key)) {
                merged.get(item.key).count += item.count;
            } else merged.set(item.key, item);
        }
        user.cart = Array.from(merged.values());
        await user.save();

        res.json({ success: true, order, cart: user.cart });
    } catch (err) {
        console.error("Cancel order error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

export default router;
