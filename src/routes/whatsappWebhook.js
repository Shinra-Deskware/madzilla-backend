// routes/whatsappWebhook.js
import WhatsappMessage from "../models/whatsappMessageModel.js";
import express from "express";

const router = express.Router();

// ✅ Verification endpoint (Meta will call this once)

router.post("/", async (req, res) => {
    try {
        const entry = req.body.entry?.[0];
        const changes = entry?.changes?.[0];
        const messages = changes?.value?.messages;

        if (messages) {
            for (const msg of messages) {
                await WhatsappMessage.create({
                    from: msg.from,
                    to: changes.value.metadata?.display_phone_number,
                    type: msg.type,
                    body: msg.text?.body || null,
                    messageId: msg.id,
                    timestamp: msg.timestamp,
                });
            }
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("❌ Error saving WhatsApp message:", err);
        res.sendStatus(500);
    }
});


export default router;
