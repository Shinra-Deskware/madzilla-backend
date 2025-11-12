// routes/adminComplaints.js
import express from "express";
import Complaint from "../models/Complaint.js";
import Order from "../models/Order.js";
import { ORDER_STATUS, PAYMENT_STATUS } from "../constants/constants.js";
import adminAuth from "../middleware/adminAuth.js";
import Razorpay from "razorpay";

const router = express.Router();

// 🔐 Protect all admin complaint routes
router.use(adminAuth);

// Razorpay client
const razor = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

/* -----------------------------------------------------
   📋 Get all complaints
----------------------------------------------------- */
router.get("/", async (req, res) => {
    try {
        const list = await Complaint.find().sort({ createdAt: -1 });
        res.json({ success: true, complaints: list });
    } catch (err) {
        console.error("Admin list complaints error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* -----------------------------------------------------
   ✅ Approve complaint / return
----------------------------------------------------- */
router.put("/:id/approve", async (req, res) => {
    try {
        const { id } = req.params;
        const { adminNotes } = req.body;

        const complaint = await Complaint.findById(id);
        if (!complaint)
            return res.status(404).json({ success: false, message: "Complaint not found" });

        complaint.status = "APPROVED";
        if (adminNotes) complaint.adminNotes = adminNotes;
        complaint.returnApprovedAt = new Date();
        await complaint.save();

        if (complaint.type === "RETURN") {
            await Order.findOneAndUpdate(
                { orderId: complaint.orderId },
                {
                    status: ORDER_STATUS.RETURN_ACCEPTED,
                    updatedAt: new Date(),
                    returnApprovedDate: new Date(),
                }
            );
        }

        res.json({ success: true, message: "Complaint approved", complaint });
    } catch (err) {
        console.error("Approve complaint error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* -----------------------------------------------------
   📦 Mark item received & initiate refund
   -> creates Razorpay refund immediately and updates order
----------------------------------------------------- */
router.put("/:id/receive", async (req, res) => {
    try {
        const { id } = req.params;
        const { adminNotes } = req.body;

        const complaint = await Complaint.findById(id);
        if (!complaint)
            return res.status(404).json({ success: false, message: "Complaint not found" });
        if (complaint.type !== "RETURN")
            return res.status(400).json({ success: false, message: "Not a return complaint" });

        // Mark complaint as received
        complaint.status = "APPROVED"; // keep approved state
        complaint.returnReceivedAt = new Date();
        if (adminNotes) complaint.adminNotes = adminNotes;
        await complaint.save();

        // Update order to reflect item received and refund initiation
        await Order.findOneAndUpdate(
            { orderId: complaint.orderId },
            {
                status: ORDER_STATUS.RETURN_RECEIVED,
                paymentStatus: PAYMENT_STATUS.REFUND_INITIATED, // optimistic
                refundContext: "RETURN",
                updatedAt: new Date(),
                returnReceivedDate: new Date(),
            }
        );

        // Fetch the fresh order document to perform refund call / updates
        const order = await Order.findOne({ orderId: complaint.orderId });
        if (!order) {
            return res.status(404).json({ success: false, message: "Order not found" });
        }

        // If order has a Razorpay payment id, try to create a refund immediately
        if (order.razorpay_payment_id) {
            try {
                const amountPaise = Math.round((Number(order.total || 0) + Number(order.shipping || 0)) * 100);
                const refund = await razor.payments.refund.create({
                    payment_id: order.razorpay_payment_id,
                    amount: amountPaise,
                    speed: "optimum",
                });

                // Persist refund metadata (webhook will confirm final status)
                order.paymentStatus = PAYMENT_STATUS.REFUND_INITIATED;
                order.refundId = refund.id;
                order.refundAttemptedAt = new Date();
                order.refundContext = "RETURN";
                await order.save();

                // respond with refund id for admin visibility
                return res.json({
                    success: true,
                    message: "Item received — refund initiated with Razorpay",
                    complaint,
                    order,
                    refundId: refund.id,
                });
            } catch (err) {
                console.error("Refund create failed (admin receive):", err);

                // Mark as requested so team can retry
                order.paymentStatus = PAYMENT_STATUS.REFUND_REQUESTED;
                order.refundAttemptedAt = new Date();
                order.refundRetries = (order.refundRetries || 0) + 1;
                order.refundContext = "RETURN";
                await order.save();

                return res.status(200).json({
                    success: true,
                    message: "Item received — refund request queued (failed to create refund with Razorpay).",
                    complaint,
                    order,
                });
            }
        }

        // If no razorpay id present, just return success (manual refund may be required)
        return res.json({ success: true, message: "Item received, refund initiated (no payment id found)", complaint, order });
    } catch (err) {
        console.error("Mark receive error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

/* -----------------------------------------------------
   ❌ Reject complaint / return
----------------------------------------------------- */
router.put("/:id/reject", async (req, res) => {
    try {
        const { id } = req.params;
        const { adminNotes } = req.body;

        const complaint = await Complaint.findById(id);
        if (!complaint)
            return res.status(404).json({ success: false, message: "Complaint not found" });

        complaint.status = "REJECTED";
        if (adminNotes) complaint.adminNotes = adminNotes;
        complaint.returnRejectedAt = new Date();
        await complaint.save();

        if (complaint.type === "RETURN") {
            await Order.findOneAndUpdate(
                { orderId: complaint.orderId },
                {
                    status: ORDER_STATUS.RETURN_REJECTED,
                    updatedAt: new Date(),
                    returnRejectedAt: new Date(),
                }
            );
        }

        res.json({ success: true, message: "Complaint rejected", complaint });
    } catch (err) {
        console.error("Reject complaint error:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

export default router;
