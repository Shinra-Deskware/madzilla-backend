// routes/whatsappChats.js
import express from "express";
import WhatsappChat from "../models/whatsappChatModel.js";

const router = express.Router();

router.get("/", async (req, res) => {
    const chats = await WhatsappChat.find().sort({ lastTime: -1 });
    res.json({ success: true, data: chats });
});

router.get("/:phone", async (req, res) => {
    const chat = await WhatsappChat.findById(req.params.phone);
    res.json({ success: true, data: chat?.messages || [] });
});

export default router;
