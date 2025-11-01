// server/routes/complaintRoutes.js
import express from "express";
import Complaint from "../models/Complaint.js";
import Order from "../models/Order.js";
import { ORDER_STATUS } from "../constants/constants.js";

const router = express.Router();

/** User creates complaint / return request */
router.post("/", async (req, res) => {
    try {
        const { orderId, userPhone, type, title, message } = req.body;

        if (!orderId || !userPhone || !type || !title || !message)
            return res.status(400).json({ success: false, msg: "Missing fields" });

        // ensure order exists & belongs to user
        const order = await Order.findOne({ orderId, phoneNumber: userPhone });
        if (!order)
            return res.status(404).json({ success: false, msg: "Order not found" });

        // ❗ Only block if RETURN in progress AND request is RETURN
        if (
            type === "RETURN" &&
            [
                ORDER_STATUS.RETURN_REQUESTED,
                ORDER_STATUS.RETURN_ACCEPTED,
                ORDER_STATUS.RETURN_RECEIVED,
                ORDER_STATUS.RETURN_REJECTED,
                ORDER_STATUS.RETURNED
            ].includes(order.status)
        ) {
            return res.status(400).json({ success: false, msg: "Return already in process" });
        }

        // ✅ RETURN only after delivered
        if (type === "RETURN") {
            if (order.status !== ORDER_STATUS.DELIVERED)
                return res.status(400).json({ success: false, msg: "Return allowed only after delivery" });

            await Order.findOneAndUpdate(
                { orderId, phoneNumber: userPhone },
                {
                    status: ORDER_STATUS.RETURN_REQUESTED,
                    updatedAt: new Date(),
                    returnRequestedAt: new Date()
                }
            );
        }

        // create complaint/return log
        const complaint = await Complaint.create({
            orderId,
            userPhone,
            type,
            title,
            message
        });

        res.json({ success: true, complaint });
    } catch (err) {
        console.error("Create complaint error:", err);
        res.status(500).json({ success: false, msg: "Server error" });
    }
});

export default router;
