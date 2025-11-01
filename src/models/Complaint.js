// server/models/Complaint.js
import mongoose from "mongoose";

const ComplaintSchema = new mongoose.Schema(
    {
        orderId: { type: String, required: true },
        userPhone: { type: String, required: true },

        // Type: complaint or return request
        type: {
            type: String,
            enum: ["COMPLAINT", "RETURN"],
            required: true
        },

        title: String,
        message: String,
        images: { type: Array, default: [] },

        // Complaint/Return status
        status: {
            type: String,
            enum: ["OPEN", "APPROVED", "REJECTED"],
            default: "OPEN"
        },

        adminNotes: String,

        // Return timeline
        returnApprovedAt: Date,
        returnRejectedAt: Date,
        returnReceivedAt: Date
    },
    { timestamps: true }
);

export default mongoose.model("Complaint", ComplaintSchema);
