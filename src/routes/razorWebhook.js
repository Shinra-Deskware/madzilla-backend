// routes/razorWebhook.js
import crypto from "crypto";
import Order from "../models/Order.js";
import { ORDER_STATUS, PAYMENT_STATUS } from "../constants/constants.js";
import { sendRefundEmail } from "../utils/sendRefundEmail.js";
import { sendOrderStatusEmail } from "../utils/sendOrderStatusEmail.js";
import { sendNewOrderEmail } from "../utils/sendNewOrderEmail.js";

export default async function razorpayWebhook(req, res) {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers["x-razorpay-signature"];

        const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
        const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
        if (signature !== expected) return res.status(400).send("Invalid signature");
        const evt = JSON.parse(raw.toString("utf8"));
        const type = evt?.event || "";

        const markHistory = (order, step, label) => {
            order.statusHistory = order.statusHistory || [];
            order.statusHistory.push({ step, label, date: new Date() });
        };

        const inferRefundContext = (order) => {
            if (order.refundContext === "RETURN" || order.refundContext === "CANCEL")
                return order.refundContext;

            const labels = (order.statusHistory || []).map(h => String(h.label).toUpperCase());
            if (
                labels.includes(String(ORDER_STATUS.RETURN_REQUESTED).toUpperCase()) ||
                labels.includes("RETURN_REQUESTED") ||
                String(order.status).toUpperCase().includes("RETURN")
            ) return "RETURN";

            return "CANCEL";
        };

        /* =========================
           Payment authorized
        ==========================*/
        if (type === "payment.authorized") {
            const p = evt.payload?.payment?.entity;
            if (!p) return res.send("ok");

            const order = await Order.findOne({ razorpay_order_id: p.order_id });
            if (!order) return res.send("ok");

            if (order.paymentStatus !== PAYMENT_STATUS.PAYMENT_AUTHORIZED) {
                order.paymentStatus = PAYMENT_STATUS.PAYMENT_AUTHORIZED;
                await order.save();
                await sendOrderStatusEmail(order, "PAYMENT_AUTHORIZED");
            }
            return res.send("ok");
        }

        /* =========================
           Payment captured
        ==========================*/
        if (type === "payment.captured") {
            const p = evt.payload?.payment?.entity;
            if (!p) return res.send("ok");

            const order = await Order.findOne({ razorpay_order_id: p.order_id });
            if (!order) return res.send("ok");

            if (order.paymentStatus === PAYMENT_STATUS.PAID && order.razorpay_payment_id === p.id)
                return res.send("ok");

            order.paymentStatus = PAYMENT_STATUS.PAID;
            order.status = ORDER_STATUS.ORDER_PLACED;
            order.currentStep = Math.max(order.currentStep ?? 0, 1);
            order.razorpay_payment_id = p.id;
            markHistory(order, 1, ORDER_STATUS.ORDER_PLACED);
            await order.save();

            await sendOrderStatusEmail(order, "PAID");
            await sendNewOrderEmail(order);

            return res.send("ok");
        }

        /* =========================
           Payment failed
        ==========================*/
        if (type === "payment.failed") {
            const p = evt.payload?.payment?.entity;
            if (!p) return res.send("ok");

            const order = await Order.findOne({ razorpay_order_id: p.order_id });
            if (!order) return res.send("ok");

            if (order.paymentStatus !== PAYMENT_STATUS.FAILED) {
                order.paymentStatus = PAYMENT_STATUS.FAILED;
                order.status = ORDER_STATUS.PAYMENT_FAILED;
                order.failedPaymentId = p.id;
                markHistory(order, 0, ORDER_STATUS.PAYMENT_FAILED);
                await order.save();
                await sendOrderStatusEmail(order, "PAYMENT_FAILED");
            }
            return res.send("ok");
        }

        /* =========================
           Refund initiated
        ==========================*/
        if (type === "refund.created") {
            const r = evt.payload?.refund?.entity;
            if (!r) return res.send("ok");

            let order = await Order.findOne({ razorpay_payment_id: r.payment_id });
            if (!order && r?.id) order = await Order.findOne({ refundId: r.id });
            if (!order) return res.send("ok");

            if (![PAYMENT_STATUS.REFUND_INITIATED, PAYMENT_STATUS.REFUND_DONE].includes(order.paymentStatus)) {
                order.paymentStatus = PAYMENT_STATUS.REFUND_INITIATED;
                order.refundId = r.id;
                order.refundAttemptedAt = new Date();
                await order.save();
                await sendOrderStatusEmail(order, "REFUND_INITIATED");
            }
            return res.send("ok");
        }

        /* =========================
           Refund processed
        ==========================*/
        if (type === "refund.processed") {
            const r = evt.payload?.refund?.entity;
            if (!r) return res.send("ok");

            let order = await Order.findOne({ razorpay_payment_id: r.payment_id });
            if (!order && r?.id) order = await Order.findOne({ refundId: r.id });
            if (!order) return res.send("ok");

            if (!(order.paymentStatus === PAYMENT_STATUS.REFUND_DONE && order.refundId === r.id)) {
                order.paymentStatus = PAYMENT_STATUS.REFUND_DONE;
                order.refundId = r.id;
                order.refundDate = new Date();

                const reason = inferRefundContext(order);
                if (reason === "RETURN") {
                    order.status = ORDER_STATUS.RETURNED;
                    markHistory(order, -2, ORDER_STATUS.RETURNED);
                }
                else {
                    order.status = ORDER_STATUS.CANCELLED;
                    markHistory(order, -1, ORDER_STATUS.CANCELLED);
                }

                await order.save();
                await sendOrderStatusEmail(order, "REFUND_DONE");
                await sendRefundEmail(order, true).catch(() => { });
            }
            return res.send("ok");
        }

        /* =========================
           Refund failed
        ==========================*/
        if (type === "refund.failed") {
            const r = evt.payload?.refund?.entity;
            if (!r) return res.send("ok");

            let order = await Order.findOne({ razorpay_payment_id: r.payment_id });
            if (!order && r?.id) order = await Order.findOne({ refundId: r.id });
            if (!order) return res.send("ok");

            if (!(order.paymentStatus === PAYMENT_STATUS.REFUND_FAILED && order.refundId === r.id)) {
                order.paymentStatus = PAYMENT_STATUS.REFUND_FAILED ?? PAYMENT_STATUS.REFUND_REQUESTED;
                order.refundId = r.id || order.refundId;
                await order.save();
                await sendOrderStatusEmail(order, "REFUND_FAILED");
                await sendRefundEmail(order, false).catch(() => { });
            }
            return res.send("ok");
        }

        return res.send("ok");
    } catch (err) {
        console.error("Webhook error:", err);
        return res.status(500).send("server error");
    }
}
