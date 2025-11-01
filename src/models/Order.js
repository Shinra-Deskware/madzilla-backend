import mongoose from "mongoose";
import { PAYMENT_STATUS } from "../constants/constants.js";

const orderSchema = new mongoose.Schema({
    orderId: { type: String, required: true, unique: true },
    phoneNumber: { type: String, required: true },

    items: { type: Array, required: true },
    address: { type: Object, required: true },

    total: { type: Number, required: true },
    shipping: { type: Number, default: 0 },

    paymentMethod: { type: String, default: "Razorpay" },

    // ✅ Payment Status
    paymentStatus: {
        type: String,
        enum: Object.values(PAYMENT_STATUS),
        default: PAYMENT_STATUS.PENDING
    },

    // ✅ Order status (delivery flow)
    status: {
        type: String,
        default: "PENDING"
    },

    // ✅ Stepper for delivery
    currentStep: {
        type: Number,
        default: 0 // Payment step
    },

    // ✅ Status journey
    statusHistory: {
        type: Array,
        default: []
    },

    // ✅ Razorpay fields
    razorpay_order_id: String,
    razorpay_payment_id: String,
    razorpay_signature: String,

    deliveredDate: Date,
    cancelledDate: Date,
    returnRequestDate: Date,
    returnApprovedDate: Date,
    returnReceivedDate: Date,
    returnCompletedAt: Date, // when refund is done & order marked returned
    adminNotes: String, // moved from complaint so order holds final notes
    refundId: String,
    refundDate: Date,

}, { timestamps: true });

export default mongoose.model("Order", orderSchema);
