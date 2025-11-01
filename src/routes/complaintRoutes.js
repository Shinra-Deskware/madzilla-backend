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

        // ensure not already in return flow
        if (["RETURN_REQUESTED", "RETURN_ACCEPTED", "RETURN_RECEIVED", "RETURN_REJECTED", "RETURNED"]
            .includes(order.status)
        ) {
            return res.status(400).json({ success: false, msg: "Return already in process" });
        }

        // Allow RETURN only if delivered
        if (type === "RETURN") {
            if (order.status !== ORDER_STATUS.DELIVERED) {
                return res.status(400).json({ success: false, msg: "Return allowed only after delivery" });
            }

            await Order.findOneAndUpdate(
                { orderId, phoneNumber: userPhone },
                {
                    status: ORDER_STATUS.RETURN_REQUESTED,
                    updatedAt: new Date(),
                    returnRequestedAt: new Date()
                }
            );
        }

        const complaint = await Complaint.create({
            orderId,
            userPhone,
            type,
            title,
            message,
            createdAt: new Date()
        });

        res.json({ success: true, complaint });
    } catch (err) {
        console.error("Create complaint error:", err);
        res.status(500).json({ success: false, msg: "Server error" });
    }
});

export default router;
