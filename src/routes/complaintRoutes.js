// server/routes/complaintRoutes.js
import express from "express";
import Complaint from "../models/Complaint.js";
import Order from "../models/Order.js";
import { ORDER_STATUS } from "../constants/constants.js";

const router = express.Router();

/** User creates complaint / return request */
router.post("/", async (req, res) => {
    try {
        const { orderId, userPhone, emailId, type, title, message } = req.body;

        if (!orderId || !type || !title || !message)
            return res.status(400).json({ success: false, msg: "Missing fields" });

        // find order either by phone or email
        const query = { orderId };
        if (emailId) query.emailId = emailId;
        else if (userPhone) query.phoneNumber = userPhone;
        else return res.status(400).json({ success: false, msg: "emailId or userPhone required" });

        const order = await Order.findOne(query);
        if (!order)
            return res.status(404).json({ success: false, msg: "Order not found" });

        // return flow guard
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

        if (type === "RETURN") {
            if (order.status !== ORDER_STATUS.DELIVERED)
                return res.status(400).json({ success: false, msg: "Return allowed only after delivery" });

            await Order.findOneAndUpdate(query, {
                status: ORDER_STATUS.RETURN_REQUESTED,
                updatedAt: new Date(),
                returnRequestedAt: new Date()
            });
        }

        const complaint = await Complaint.create({
            orderId,
            emailId: (emailId || order.emailId || "").toLowerCase(),
            userPhone: userPhone || order.phoneNumber || null,
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
