import mongoose from "mongoose";

const whatsappMessageSchema = new mongoose.Schema(
    {
        from: String,          // sender number
        to: String,            // your business number
        type: String,          // text, image, etc.
        body: String,          // text content
        messageId: String,     // unique WhatsApp message ID
        timestamp: String,     // when it was sent
    },
    { timestamps: true }
);

export default mongoose.model("WhatsappMessage", whatsappMessageSchema);
