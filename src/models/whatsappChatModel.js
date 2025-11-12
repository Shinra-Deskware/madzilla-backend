// models/whatsappChatModel.js
import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    from: String,
    to: String,
    type: String,
    body: String,
    messageId: String,
    timestamp: String,
  },
  { _id: false }
);

const whatsappChatSchema = new mongoose.Schema(
  {
    _id: { type: String }, // phone number
    messages: [messageSchema],
    lastMessage: String,
    lastTime: Date,
  },
  { timestamps: true }
);

export default mongoose.model("WhatsappChat", whatsappChatSchema);
