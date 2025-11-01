// server/models/Complaint.js
import mongoose from "mongoose";

const ComplaintSchema = new mongoose.Schema(
    {
        orderId: { type: String, required: true },
        userPhone: { type: String, required: true },
        type: { type: String, enum: ["OPEN", "APPROVED", "REJECTED", "RECEIVED", "CLOSED"], required: true },
        title: String,
        message: String,
        images: { type: Array, default: [] }, // future use
        status: {
            type: String,
            enum: ["OPEN", "APPROVED", "REJECTED"],
            default: "OPEN",
        },
        adminNotes: String,
        returnApprovedAt: Date,
        returnRejectedAt: Date,
        returnReceivedAt: Date,
    },
    { timestamps: true }
);

export default mongoose.model("Complaint", ComplaintSchema);
