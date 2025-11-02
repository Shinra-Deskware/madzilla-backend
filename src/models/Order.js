import mongoose from 'mongoose';
import { PAYMENT_STATUS, ORDER_STATUS } from '../constants/constants.js';

const OrderItemSchema = new mongoose.Schema(
    {
        key: { type: String },
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        title: { type: String },
        price: { type: Number },
        qty: { type: Number, default: 1, min: 1 },
    },
    { _id: false }
);

const orderSchema = new mongoose.Schema(
    {
        orderId: { type: String, required: true, unique: true },

        emailId: { type: String, required: true, trim: true, lowercase: true },
        phoneNumber: { type: String },

        items: { type: [OrderItemSchema], required: true },

        address: { type: Object, required: true },

        total: { type: Number, required: true },
        shipping: { type: Number, default: 0 },

        paymentMethod: { type: String, default: 'Razorpay' },

        paymentStatus: {
            type: String,
            enum: Object.values(PAYMENT_STATUS),
            default: PAYMENT_STATUS.PENDING,
        },

        status: {
            type: String,
            enum: Object.values(ORDER_STATUS),
            default: ORDER_STATUS.PENDING,
        },

        currentStep: { type: Number, default: 0 },

        statusHistory: { type: Array, default: [] },

        // Razorpay fields
        razorpay_order_id: String,
        razorpay_payment_id: String,
        razorpay_signature: String,
        razorpay_receipt: String,

        // integrity / reconciliation
        cartSignature: String,
        failedPaymentId: String,

        deliveredDate: Date,
        cancelledDate: Date,
        returnRequestDate: Date,
        returnApprovedDate: Date,
        returnReceivedDate: Date,
        returnCompletedAt: Date,
        adminNotes: String,
        refundId: String,
        refundDate: Date,
    },
    { timestamps: true }
);

// Indexes
orderSchema.index({ orderId: 1 }, { unique: true });
orderSchema.index({ emailId: 1 });
orderSchema.index({ razorpay_order_id: 1 });
// for your verify query pattern
orderSchema.index({ emailId: 1, razorpay_order_id: 1 });

export default mongoose.model('Order', orderSchema);
