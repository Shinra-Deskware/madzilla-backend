import express from "express";
import WhatsappMessage from "../models/whatsappMessageModel.js";

const router = express.Router();

// GET /api/whatsapp/messages
router.get("/", async (req, res) => {
    try {
        const messages = await WhatsappMessage.find().sort({ createdAt: -1 });
        res.json({ success: true, data: messages });
    } catch (err) {
        console.error("❌ Error fetching messages:", err);
        res.status(500).json({ success: false, message: "Server error" });
    }
});

export default router;
