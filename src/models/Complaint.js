import mongoose from "mongoose";

const ComplaintSchema = new mongoose.Schema(
    {
        orderId: { type: String, required: true },
        emailId: { type: String, required: true, lowercase: true },
        userPhone: { type: String }, // ✅ added

        type: {
            type: String,
            enum: ["COMPLAINT", "RETURN"],
            required: true
        },

        title: String,
        message: String,
        images: { type: Array, default: [] },

        status: {
            type: String,
            enum: ["OPEN", "APPROVED", "REJECTED"],
            default: "OPEN"
        },

        adminNotes: String,

        returnApprovedAt: Date,
        returnRejectedAt: Date,
        returnReceivedAt: Date
    },
    { timestamps: true }
);


export default mongoose.model("Complaint", ComplaintSchema);
