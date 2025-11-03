import express from "express";
import Razorpay from "razorpay";
import adminAuth from "../middleware/adminAuth.js";
import Order from "../models/Order.js";
import User from "../models/User.js";
import Product from "../models/Product.js";
import { ORDER_STATUS, PAYMENT_STATUS } from "../constants/constants.js";
import { sendOrderStatusEmail } from "../utils/sendOrderStatusEmail.js";

const router = express.Router();

const razor = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// 🔐 Protect all routes
router.use(adminAuth);

/* -----------------------------------------------------
   📦 Fetch all orders
----------------------------------------------------- */
router.get("/orders", async (req, res) => {
    try {
        const orders = await Order.find().sort({ createdAt: -1 });
        res.json({ success: true, orders });
    } catch (err) {
        console.error("Admin fetch orders error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* -----------------------------------------------------
   👥 Fetch all users
----------------------------------------------------- */
router.get("/users", async (req, res) => {
    try {
        const users = await User.find().sort({ createdAt: -1 });
        res.json({ success: true, users });
    } catch (err) {
        console.error("Admin fetch users error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* -----------------------------------------------------
   ✏️ Update user (admin inline edit)
----------------------------------------------------- */
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

/* -----------------------------------------------------
   🛍️ Fetch all products (paginated)
----------------------------------------------------- */
router.get("/sections/products", async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const products = await Product.find(
            {},
            {
                key: 1,
                title: 1,
                price: 1,
                stock: 1,
                discount: 1,
                rating: 1,
                totalReviews: 1,
                originalPrice: 1,
                createdAt: 1,
            }
        )
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

/* -----------------------------------------------------
   ✏️ Update product
----------------------------------------------------- */
router.put("/products/:id", async (req, res) => {
    try {
        const allowed = [
            "title", "stock", "price", "originalPrice",
            "discount", "rating", "totalReviews", "productId"
        ];

        const updateData = {};
        allowed.forEach(f => {
            if (req.body[f] !== undefined) updateData[f] = req.body[f];
        });
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

/* -----------------------------------------------------
   🚚 Update Order Status / Payment
----------------------------------------------------- */
router.put("/orders/:orderId", async (req, res) => {
    try {
        const { paymentStatus, status } = req.body;
        const order = await Order.findOne({ orderId: req.params.orderId });
        if (!order) return res.status(404).json({ success: false, message: "Order not found" });

        const prevStatus = order.status;
        const prevPayment = order.paymentStatus;


        const returnFlowStatuses = [
            ORDER_STATUS.RETURN_REQUESTED,
            ORDER_STATUS.RETURN_ACCEPTED,
            ORDER_STATUS.RETURN_RECEIVED,
            ORDER_STATUS.RETURN_REJECTED,
            ORDER_STATUS.RETURNED,
        ];

        if (returnFlowStatuses.includes(order.status)) {
            return res.status(400).json({
                success: false,
                message: "Order in return process — update via return routes only",
            });
        }

        // Cancel
        if (status === ORDER_STATUS.CANCELLED) {
            order.paymentStatus =
                order.paymentStatus === PAYMENT_STATUS.PAID
                    ? PAYMENT_STATUS.REFUND_REQUESTED
                    : PAYMENT_STATUS.CANCELLED;
            order.status = ORDER_STATUS.CANCELLED;
            order.currentStep = -1;
            order.statusHistory.push({
                step: -1,
                label: "CANCELLED (Admin)",
                date: new Date(),
            });
            order.updatedAt = new Date();
            await order.save();
            return res.json({ success: true, order });
        }

        // Normal step flow
        const steps = [
            ORDER_STATUS.PENDING,
            ORDER_STATUS.ORDER_PLACED,
            ORDER_STATUS.ORDER_PACKED,
            ORDER_STATUS.IN_TRANSIT,
            ORDER_STATUS.OUT_FOR_DELIVERY,
            ORDER_STATUS.DELIVERED,
        ];

        if (status && steps.includes(status) && order.status !== status) {
            const stepIndex = steps.indexOf(status);
            order.status = status;
            order.currentStep = stepIndex;
            order.statusHistory.push({ step: stepIndex, label: status, date: new Date() });
            if (status === ORDER_STATUS.DELIVERED) order.deliveredDate = new Date();
        }

        // Payment transitions
        if (paymentStatus && order.paymentStatus !== paymentStatus) {
            const validTransitions = {
                [PAYMENT_STATUS.PAID]: [PAYMENT_STATUS.REFUND_INITIATED],
                [PAYMENT_STATUS.REFUND_INITIATED]: [PAYMENT_STATUS.REFUND_DONE],
            };
            const allowedNext = validTransitions[order.paymentStatus] || [];
            if (!allowedNext.includes(paymentStatus)) {
                return res.status(400).json({
                    success: false,
                    message: `Invalid payment change: ${order.paymentStatus} → ${paymentStatus}`,
                });
            }
            order.paymentStatus = paymentStatus;
        }

        // Allow basic edits
        const editableFields = ["deliveryMethod", "trackingId", "trackingUrl", "shipping", "total", "notes"];
        for (const key of editableFields) {
            if (req.body[key] !== undefined) order[key] = req.body[key];
        }

        order.updatedAt = new Date();
        await order.save();

        // ✅ Send email only if status changed
        try {
            if (status && status !== prevStatus) {
                await sendOrderStatusEmail(order, status);
            }
            if (paymentStatus && paymentStatus !== prevPayment) {
                await sendOrderStatusEmail(order, paymentStatus); // or sendPaymentStatusEmail(order)
            }
        } catch (mailErr) {
            console.error("Admin email send error:", mailErr?.message || mailErr);
        }

        return res.json({ success: true, order });

    } catch (err) {
        console.error("Admin update order error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* -----------------------------------------------------
   🔁 Return received + refund flows
----------------------------------------------------- */
router.put("/orders/:orderId/return-received", async (req, res) => {
    try {
        const { orderId } = req.params;
        const { adminNotes } = req.body;

        const order = await Order.findOne({ orderId });
        if (!order) return res.status(404).json({ message: "Order not found" });
        if (order.status !== ORDER_STATUS.RETURN_ACCEPTED)
            return res.status(400).json({ message: "Item not approved for return yet" });

        order.status = ORDER_STATUS.RETURN_RECEIVED;
        order.paymentStatus = PAYMENT_STATUS.REFUND_INITIATED;
        if (adminNotes) order.adminNotes = adminNotes;
        order.updatedAt = new Date();
        await order.save();

        // ✅ Email: item received, refund starting
        try {
            await sendOrderStatusEmail(order, "RETURN_RECEIVED");
        } catch (mailErr) {
            console.error("Return mail error:", mailErr);
        }

        return res.json({ success: true, message: "Return received, refund initiated", order });
    } catch (err) {
        console.error("Return receive error:", err);
        res.status(500).json({ success: false, message: "Error updating return" });
    }
});
/* -----------------------------------------------------
   ✅ Admin Approves Return Request
----------------------------------------------------- */
router.put("/orders/:orderId/return-approve", async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findOne({ orderId });

        if (!order) return res.status(404).json({ message: "Order not found" });

        if (order.status !== ORDER_STATUS.RETURN_REQUESTED)
            return res.status(400).json({ message: "Return not requested by customer" });

        const prevStatus = order.status;

        order.status = ORDER_STATUS.RETURN_ACCEPTED;
        order.updatedAt = new Date();
        order.statusHistory.push({
            step: -2,
            label: ORDER_STATUS.RETURN_ACCEPTED,
            date: new Date(),
        });

        await order.save();

        // 📧 Email notification
        try {
            await sendOrderStatusEmail(order, ORDER_STATUS.RETURN_ACCEPTED);
        } catch (err) {
            console.error("Return approve email error:", err);
        }

        res.json({ success: true, message: "Return approved", order });
    } catch (err) {
        console.error("Return approve error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* -----------------------------------------------------
   ❌ Admin Rejects Return Request
----------------------------------------------------- */
router.put("/orders/:orderId/return-reject", async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason } = req.body;

        const order = await Order.findOne({ orderId });
        if (!order) return res.status(404).json({ message: "Order not found" });

        if (order.status !== ORDER_STATUS.RETURN_REQUESTED)
            return res.status(400).json({ message: "Return not requested by customer" });

        order.status = ORDER_STATUS.RETURN_REJECTED;
        order.updatedAt = new Date();
        order.adminNotes = reason || "Not accepted";
        order.statusHistory.push({
            step: -3,
            label: ORDER_STATUS.RETURN_REJECTED,
            date: new Date(),
        });

        await order.save();

        // 📧 Email notification
        try {
            await sendOrderStatusEmail(order, ORDER_STATUS.RETURN_REJECTED);
        } catch (err) {
            console.error("Return reject email error:", err);
        }

        res.json({ success: true, message: "Return rejected", order });

    } catch (err) {
        console.error("Return reject error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

router.put("/orders/:orderId/refund", async (req, res) => {
    try {
        const { orderId } = req.params;
        const order = await Order.findOne({ orderId });
        if (!order) return res.status(404).json({ message: "Order not found" });

        if (order.paymentStatus !== PAYMENT_STATUS.REFUND_INITIATED)
            return res.status(400).json({ message: "Refund not in initiated stage" });

        if (!order.razorpay_payment_id)
            return res.status(400).json({ message: "Missing payment ID for refund" });

        const refund = await razor.payments.refund(order.razorpay_payment_id, {
            amount: Math.round(order.total * 100),
            speed: "optimum",
        });

        order.refundContext = "RETURN";
        order.refundId = refund.id;
        order.refundAttemptedAt = new Date();
        // DO NOT set REFUND_DONE here — webhook will confirm
        order.paymentStatus = PAYMENT_STATUS.REFUND_INITIATED;
        await order.save();

        return res.json({
            success: true,
            message: "Refund requested — awaiting Razorpay confirmation",
            refundRequestId: refund.id,
            order,
        });
    } catch (err) {
        console.error("Refund error:", err);
        return res.status(500).json({
            success: false,
            message: err.error?.description || "Refund request failed",
        });
    }
});


export default router;
