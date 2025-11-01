// server/routes/adminComplaints.js
import express from "express";
import Complaint from "../models/Complaint.js";
import Order from "../models/Order.js";
import { ORDER_STATUS, PAYMENT_STATUS } from "../constants/constants.js";
import adminAuth from "../middleware/adminAuth.js";

const router = express.Router();
router.use(adminAuth);

/** List all complaints */
router.get("/", async (req, res) => {
    try {
        const list = await Complaint.find().sort({ createdAt: -1 });
        res.json({ success: true, complaints: list });
    } catch (e) {
        console.error("Admin list complaints error:", e);
        res.status(500).json({ success: false });
    }
});

/** ✅ Approve complaint/return */
router.put("/:id/approve", async (req, res) => {
    try {
        const { id } = req.params;
        const { adminNotes } = req.body;

        const complaint = await Complaint.findById(id);
        if (!complaint) return res.status(404).json({ success: false, msg: "Not found" });

        complaint.status = "APPROVED";
        if (adminNotes) complaint.adminNotes = adminNotes;
        complaint.approvedAt = new Date();
        await complaint.save();

        if (complaint.type === "RETURN") {
            await Order.findOneAndUpdate(
                { orderId: complaint.orderId },
                {
                    status: ORDER_STATUS.RETURN_ACCEPTED,
                    updatedAt: new Date(),
                    returnAcceptedAt: new Date()
                }
            );
        }

        res.json({ success: true, complaint });
    } catch (e) {
        console.error("Approve complaint error:", e);
        res.status(500).json({ success: false });
    }
});

/** ✅ Mark item received & begin refund */
router.put("/:id/receive", async (req, res) => {
    try {
        const { id } = req.params;
        const { adminNotes } = req.body;

        const complaint = await Complaint.findById(id);
        if (!complaint) return res.status(404).json({ success: false, msg: "Not found" });
        if (complaint.type !== "RETURN")
            return res.status(400).json({ success: false, msg: "Not a return" });

        complaint.status = "RECEIVED"; // TRACKING ONLY, admin UI uses order status
        if (adminNotes) complaint.adminNotes = adminNotes;
        complaint.itemReceivedAt = new Date();
        await complaint.save();

        await Order.findOneAndUpdate(
            { orderId: complaint.orderId },
            {
                status: ORDER_STATUS.RETURN_RECEIVED,
                paymentStatus: PAYMENT_STATUS.REFUND_INITIATED,
                updatedAt: new Date(),
                returnReceivedAt: new Date(),
            }
        );

        res.json({ success: true });
    } catch (e) {
        console.error("Mark receive error:", e);
        res.status(500).json({ success: false });
    }
});

/** ✅ Reject complaint/return */
router.put("/:id/reject", async (req, res) => {
    try {
        const { id } = req.params;
        const { adminNotes } = req.body;

        const complaint = await Complaint.findById(id);
        if (!complaint) return res.status(404).json({ success: false, msg: "Not found" });

        complaint.status = "REJECTED";
        if (adminNotes) complaint.adminNotes = adminNotes;
        complaint.rejectedAt = new Date();
        await complaint.save();

        if (complaint.type === "RETURN") {
            await Order.findOneAndUpdate(
                { orderId: complaint.orderId },
                {
                    status: ORDER_STATUS.RETURN_REJECTED,
                    updatedAt: new Date(),
                    returnRejectedAt: new Date()
                }
            );
        }

        res.json({ success: true });
    } catch (e) {
        console.error("Reject complaint error:", e);
        res.status(500).json({ success: false });
    }
});

export default router;
