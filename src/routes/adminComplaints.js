import express from "express";
import Complaint from "../models/Complaint.js";
import Order from "../models/Order.js";
import { ORDER_STATUS, PAYMENT_STATUS } from "../constants/constants.js";
import adminAuth from "../middleware/adminAuth.js";

const router = express.Router();

// 🔐 Protect all admin complaint routes
router.use(adminAuth);

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

        // ✅ Valid enum update
        complaint.status = "APPROVED"; // stays approved after approval
        complaint.returnReceivedAt = new Date();
        if (adminNotes) complaint.adminNotes = adminNotes;
        await complaint.save();

        await Order.findOneAndUpdate(
            { orderId: complaint.orderId },
            {
                status: ORDER_STATUS.RETURN_RECEIVED,
                paymentStatus: PAYMENT_STATUS.REFUND_INITIATED,
                refundContext: "RETURN",
                updatedAt: new Date(),
                returnReceivedDate: new Date(),
            }
        );

        res.json({ success: true, message: "Item received, refund initiated", complaint });
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
