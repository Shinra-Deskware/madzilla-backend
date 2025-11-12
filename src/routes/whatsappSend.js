// routes/whatsappSend.js
import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import WhatsappChat from "../models/whatsappChatModel.js";

dotenv.config();
const router = express.Router();

router.post("/send", async (req, res) => {
    try {
        const { to, message } = req.body;

        const url = `https://graph.facebook.com/v21.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
        const headers = {
            Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
        };

        const data = {
            messaging_product: "whatsapp",
            to,
            type: "text",
            text: { body: message },
        };

        const response = await axios.post(url, data, { headers });

        // Save to database
        await WhatsappChat.findByIdAndUpdate(
            to,
            {
                $push: {
                    messages: {
                        from: "you",
                        to,
                        type: "text",
                        body: message,
                        timestamp: new Date().toISOString(),
                    },
                },
                $set: {
                    lastMessage: message,
                    lastTime: new Date(),
                },
            },
            { upsert: true }
        );

        res.json({ success: true, response: response.data });
    } catch (err) {
        console.error("Error sending message:", err.response?.data || err.message);
        res.status(500).json({ success: false, error: err.message });
    }
});

export default router;
