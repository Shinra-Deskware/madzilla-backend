// routes/whatsappWebhook.js
import express from "express";

const router = express.Router();

// ✅ Verification endpoint (Meta will call this once)
router.get("/", (req, res) => {
    const VERIFY_TOKEN = process.env.WA_TOKEN;
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("✅ WhatsApp webhook verified successfully");
        res.status(200).send(challenge);
    } else {
        console.warn("❌ WhatsApp webhook verification failed");
        res.sendStatus(403);
    }
});

// ✅ Receive incoming WhatsApp messages or status updates
router.post("/", (req, res) => {
    try {
        console.log("📩 WhatsApp event:", JSON.stringify(req.body, null, 2));
        res.sendStatus(200); // must respond fast
    } catch (err) {
        console.error("❌ Error handling WhatsApp webhook:", err);
        res.sendStatus(500);
    }
});

export default router;
