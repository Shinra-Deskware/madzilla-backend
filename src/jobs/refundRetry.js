import Razorpay from "razorpay";
import Order from "../models/Order.js";
import { PAYMENT_STATUS } from "../constants/constants.js";

const razor = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export default async function refundRetryJob() {
    const orders = await Order.find({
        paymentStatus: PAYMENT_STATUS.REFUND_REQUESTED,
        refundRetries: { $lt: 5 }
    });

    for (const order of orders) {
        try {
            const r = await razor.payments.refund(order.razorpay_payment_id, {
                amount: Math.round(order.total * 100),
            });

            order.paymentStatus = PAYMENT_STATUS.REFUND_INITIATED;
            order.refundId = r.id;
            order.refundRetries++;
            await order.save();
            console.log("✅ Retry refund started:", order.orderId);
        } catch (err) {
            order.refundRetries++;
            await order.save();
            console.log("⚠️ Refund retry failed:", order.orderId);
        }
    }
}
