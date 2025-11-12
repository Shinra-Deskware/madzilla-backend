// routes/whatsappWebhook.js
import express from "express";
import WhatsappChat from "../models/whatsappChatModel.js";

const router = express.Router();

router.post("/", async (req, res) => {
    try {
        const entry = req.body.entry?.[0];
        const changes = entry?.changes?.[0];
        const messages = changes?.value?.messages;

        if (messages) {
            for (const msg of messages) {
                const phone = msg.from;

                await WhatsappChat.findByIdAndUpdate(
                    phone,
                    {
                        $push: {
                            messages: {
                                from: msg.from,
                                to: changes.value.metadata?.display_phone_number,
                                type: msg.type,
                                body: msg.text?.body || null,
                                messageId: msg.id,
                                timestamp: msg.timestamp,
                            },
                        },
                        $set: {
                            lastMessage: msg.text?.body || "",
                            lastTime: new Date(parseInt(msg.timestamp) * 1000),
                        },
                    },
                    { upsert: true, new: true }
                );
            }
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("❌ Error saving WhatsApp message:", err);
        res.sendStatus(500);
    }
});

export default router;
