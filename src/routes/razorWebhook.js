import crypto from "crypto";
import Order from "../models/Order.js";
import { ORDER_STATUS, PAYMENT_STATUS } from "../constants/constants.js";
import { sendRefundEmail } from "../utils/sendRefundEmail.js";
import { sendOrderStatusEmail } from "../utils/sendOrderStatusEmail.js";
import { sendNewOrderEmail } from "../utils/sendNewOrderEmail.js";

export default async function razorpayWebhook(req, res) {
    try {
        const signature = req.headers["x-razorpay-signature"];
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const expected = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
        if (signature !== expected) return res.status(400).send("Invalid signature");

        const evt = JSON.parse(req.body);
        const type = evt?.event || "";
        const p = evt.payload?.payment?.entity;
        const r = evt.payload?.refund?.entity;

        const findOrder = async (rzKey, id) => {
            return Order.findOne({ [rzKey]: id });
        };

        const markHistory = (o, step, label) => {
            o.statusHistory = o.statusHistory || [];
            o.statusHistory.push({ step, label, date: new Date() });
        };

        const inferRefundContext = (o) => {
            if (o.refundContext) return o.refundContext;
            const labels = (o.statusHistory || []).map(x => String(x.label).toUpperCase());
            if (labels.includes("RETURN_REQUESTED") || String(o.status).includes("RETURN")) return "RETURN";
            return "CANCEL";
        };

        if (type === "payment.authorized" && p) {
            const o = await findOrder("razorpay_order_id", p.order_id); if (!o) return res.send("ok");
            if (o.paymentStatus !== PAYMENT_STATUS.PAYMENT_AUTHORIZED) {
                o.paymentStatus = PAYMENT_STATUS.PAYMENT_AUTHORIZED;
                await o.save();
                await sendOrderStatusEmail(o, "PAYMENT_AUTHORIZED");
            }
            return res.send("ok");
        }

        if (type === "payment.captured" && p) {
            const o = await findOrder("razorpay_order_id", p.order_id); if (!o) return res.send("ok");
            if (o.paymentStatus !== PAYMENT_STATUS.PAID) {
                o.paymentStatus = PAYMENT_STATUS.PAID;
                o.status = ORDER_STATUS.ORDER_PLACED;
                o.currentStep = 1;
                o.razorpay_payment_id = p.id;
                markHistory(o, 1, ORDER_STATUS.ORDER_PLACED);
                await o.save();
                await sendOrderStatusEmail(o, "PAID");
                await sendNewOrderEmail(o);
            }
            return res.send("ok");
        }

        if (type === "payment.failed" && p) {
            const o = await findOrder("razorpay_order_id", p.order_id); if (!o) return res.send("ok");
            o.paymentStatus = PAYMENT_STATUS.FAILED;
            o.status = ORDER_STATUS.PAYMENT_FAILED;
            o.failedPaymentId = p.id;
            markHistory(o, 0, ORDER_STATUS.PAYMENT_FAILED);
            await o.save();
            await sendOrderStatusEmail(o, "PAYMENT_FAILED");
            return res.send("ok");
        }

        if (type === "refund.created" && r) {
            const o = await findOrder("razorpay_payment_id", r.payment_id); if (!o) return res.send("ok");
            o.paymentStatus = PAYMENT_STATUS.REFUND_INITIATED;
            o.refundId = r.id;
            o.refundAttemptedAt = new Date();
            await o.save();
            await sendOrderStatusEmail(o, "REFUND_INITIATED");
            return res.send("ok");
        }

        if (type === "refund.processed" && r) {
            const o = await findOrder("razorpay_payment_id", r.payment_id); if (!o) return res.send("ok");
            o.paymentStatus = PAYMENT_STATUS.REFUND_DONE;
            o.refundId = r.id;
            o.refundDate = new Date();
            const reason = inferRefundContext(o);
            o.status = reason === "RETURN" ? ORDER_STATUS.REFUND_COMPLETED : ORDER_STATUS.CANCELLED;
            markHistory(o, reason === "RETURN" ? -2 : -1, o.status);
            await o.save();
            await sendOrderStatusEmail(o, "REFUND_DONE");
            await sendRefundEmail(o, true).catch(() => { });
            return res.send("ok");
        }

        if (type === "refund.failed" && r) {
            const o = await findOrder("razorpay_payment_id", r.payment_id); if (!o) return res.send("ok");
            o.paymentStatus = PAYMENT_STATUS.REFUND_FAILED;
            o.refundId = r.id;
            await o.save();
            await sendOrderStatusEmail(o, "REFUND_FAILED");
            await sendRefundEmail(o, false).catch(() => { });
            return res.send("ok");
        }

        return res.send("ok");
    } catch (err) {
        console.error("Webhook error:", err);
        res.status(500).send("server error");
    }
}
