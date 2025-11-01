import express from "express";
import Order from "../models/Order.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import adminAuth from "../middleware/adminAuth.js";
import { ORDER_STATUS, PAYMENT_STATUS } from "../constants/constants.js";
import Razorpay from "razorpay";

const router = express.Router();
const razor = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

router.use(adminAuth);
// 📦 All orders
router.get("/orders", async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json({ success: true, orders });
    } catch (err) {
        console.error("Admin fetch orders error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// 👥 All users
router.get("/users", async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.json({ success: true, users });
    } catch (err) {
        console.error("Admin fetch users error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// ✏️ Update user (Admin inline edit)
router.put("/users/:id", async (req, res) => {
    try {
        const allowed = [
            "fullName",
            "phoneNumber",
            "emailId",
            "address.city",
            "address.state",
            "address.pinCode",
        ];

        const updateData = {};
        for (const key of allowed) {
            if (key.startsWith("address.")) {
                const field = key.split(".")[1];
                if (!updateData.address) updateData.address = {};
                if (req.body.address?.[field] !== undefined)
                    updateData.address[field] = req.body.address[field];
            } else if (req.body[key] !== undefined) {
                updateData[key] = req.body[key];
            }
        }

        updateData.updatedAt = new Date();

        const updated = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true }
        );

        if (!updated)
            return res.status(404).json({ success: false, message: "User not found" });

        res.json({ success: true, user: updated });
    } catch (err) {
        console.error("Admin update user error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

// 🛍️ All products
router.get("/sections/products", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const products = await Product.find({}, {
            key: 1,
            title: 1,
            price: 1,
            stock: 1,
            discount: 1,
            rating: 1,
            totalReviews: 1,
            originalPrice: 1,
            createdAt: 1
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Product.countDocuments();

        res.json({ success: true, products, total });
    } catch (err) {
        console.error("Admin fetch products error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// ✏️ Update product (Admin inline edit)
router.put("/sections/products/:id", async (req, res) => {
    try {
        const allowed = [
            "title",
            "stock",
            "price",
            "originalPrice",
            "discount",
            "rating",
            "totalReviews",
        ];

        const updateData = {};
        for (const field of allowed) {
            if (req.body[field] !== undefined) updateData[field] = req.body[field];
        }
        updateData.updatedAt = new Date();

        const updated = await Product.findByIdAndUpdate(
            req.params.id,
            { $set: updateData },
            { new: true }
        );

        if (!updated)
            return res.status(404).json({ success: false, message: "Product not found" });

        res.json({ success: true, product: updated });
    } catch (err) {
        console.error("Admin update product error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

router.put("/orders/:orderId", async (req, res) => {
    // Prevent accidental status override after return initiated
    const returnFlowStatuses = [
        ORDER_STATUS.RETURN_REQUESTED,
        ORDER_STATUS.RETURN_ACCEPTED,
        ORDER_STATUS.RETURN_RECEIVED,
        ORDER_STATUS.RETURN_REJECTED,
        ORDER_STATUS.RETURNED
    ];

    if (returnFlowStatuses.includes(order.status)) {
        return res.status(400).json({
            success: false,
            message: "Order is in return process. Update via return actions only."
        });
    }

    try {
        const { paymentStatus, status } = req.body;

        const steps = [
            ORDER_STATUS.PENDING,
            ORDER_STATUS.ORDER_PLACED,
            ORDER_STATUS.ORDER_PACKED,
            ORDER_STATUS.IN_TRANSIT,
            ORDER_STATUS.OUT_FOR_DELIVERY,
            ORDER_STATUS.DELIVERED
        ];

        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order)
            return res.status(404).json({ success: false, message: "Order not found" });
        // Cancel Order
        // ✅ Admin Cancel Order
        if (status === ORDER_STATUS.CANCELLED) {

            if (order.paymentStatus === PAYMENT_STATUS.PAID) {
                order.paymentStatus = PAYMENT_STATUS.REFUND_REQUESTED;
            } else {
                order.paymentStatus = PAYMENT_STATUS.CANCELLED;
            }

            order.status = "CANCELLED";
            order.currentStep = -1;

            order.statusHistory.push({
                step: -1,
                label: "CANCELLED (Admin)",
                date: new Date()
            });

            order.updatedAt = new Date();
            await order.save();
            return res.json({ success: true, order });
        }

        // 🧾 Append status change to history safely
        if (status && steps.includes(status) && order.status !== status) {
            const stepIndex = steps.indexOf(status);
            order.status = status;
            order.currentStep = stepIndex;
            order.statusHistory = order.statusHistory || [];
            order.statusHistory.push({
                step: stepIndex,
                label: status,
                date: new Date(),
            });
            if (status === "Delivered") {
                order.deliveredDate = new Date()
            }
        }

        // 💳 Update payment status if changed
        // ✅ Safe Payment Status Control
        if (paymentStatus && order.paymentStatus !== paymentStatus) {

            const validTransitions = {
                [PAYMENT_STATUS.PAID]: [PAYMENT_STATUS.REFUND_INITIATED],
                [PAYMENT_STATUS.REFUND_INITIATED]: [PAYMENT_STATUS.REFUND_DONE]
            };

            const allowedNext = validTransitions[order.paymentStatus] || [];

            if (!allowedNext.includes(paymentStatus)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid payment status change: ${order.paymentStatus} → ${paymentStatus}`
                });
            }

            order.paymentStatus = paymentStatus;
        }

        // ✅ Allow only specific editable fields
        const editableFields = [
            "deliveryMethod",
            "trackingId",
            "trackingUrl",
            "shipping",
            "total",
            "notes",
        ];

        for (const key of editableFields) {
            if (req.body[key] !== undefined) {
                order[key] = req.body[key];
            }
        }

        // 🕒 Always update timestamp
        order.updatedAt = new Date();

        await order.save();

        res.json({ success: true, order });
    } catch (err) {
        console.error("Admin update order error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});
// ✅ ADMIN — Mark item received (after user sends product back)
router.put("/orders/:orderId/return-received", async (req, res) => {
    try {
        const { orderId } = req.params;
        const { adminNotes } = req.body;

        const order = await Order.findOne({ orderId });
        if (!order) return res.status(404).json({ message: "Order not found" });

        if (order.status !== ORDER_STATUS.RETURN_ACCEPTED) {
            return res.status(400).json({ message: "Item not yet approved for return" });
        }

        order.status = ORDER_STATUS.RETURN_RECEIVED;
        order.paymentStatus = PAYMENT_STATUS.REFUND_INITIATED;
        if (adminNotes) order.adminNotes = adminNotes;
        order.updatedAt = new Date();

        await order.save();

        res.json({ success: true, message: "Return received, refund initiated", order });
    } catch (err) {
        console.error("Return receive error:", err);
        res.status(500).json({ success: false, message: "Error updating return" });
    }
});

// ✅ ADMIN — Trigger Razorpay Refund
router.put("/orders/:orderId/refund", async (req, res) => {
    try {
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) return res.status(404).json({ message: "Order not found" });

        if (order.paymentStatus !== PAYMENT_STATUS.REFUND_INITIATED)
            return res.status(400).json({ message: "Refund not initiated stage" });

        const refund = await razor.payments.refund(order.razorpay_payment_id, {
            speed: "normal"
        });

        order.paymentStatus = PAYMENT_STATUS.REFUND_DONE;
        order.status = ORDER_STATUS.RETURNED;
        order.returnCompletedAt = new Date();
        order.refundId = refund.id;
        order.refundDate = new Date();
        order.updatedAt = new Date();
        await order.save();

        res.json({ success: true, message: "Refund completed", order });
    } catch (err) {
        console.error("Refund error:", err);
        res.status(500).json({ success: false, message: "Refund failed" });
    }
});


export default router;
