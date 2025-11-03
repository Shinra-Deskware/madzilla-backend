// routes/razorpayWebhook.js
import express from "express";
import crypto from "crypto";
import Order from "../models/Order.js";
import { ORDER_STATUS, PAYMENT_STATUS } from "../constants/constants.js";
import { sendRefundEmail } from "../utils/sendRefundEmail.js";
import { sendOrderStatusEmail } from "../utils/sendOrderStatusEmail.js";
import { sendNewOrderEmail } from "../utils/sendNewOrderEmail.js";

const router = express.Router();

// IMPORTANT: mount with express.raw() only for this endpoint in server.js (see note below)
router.post("/webhook", express.raw({ type: "*/*" }), async (req, res) => {
    try {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        const signature = req.headers["x-razorpay-signature"];
        const expected = crypto.createHmac("sha256", secret).update(req.body).digest("hex");
        if (signature !== expected) return res.status(400).send("Invalid signature");

        const evt = JSON.parse(req.body);
        const type = evt?.event || "";

        // helpers
        const markHistory = (order, step, label) => {
            order.statusHistory = order.statusHistory || [];
            order.statusHistory.push({ step, label, date: new Date() });
        };

        const inferRefundContext = (order) => {
            // Prefer explicit field if you set it during cancel/return flows
            // e.g., order.refundContext = 'CANCEL' | 'RETURN'
            if (order.refundContext === "RETURN" || order.refundContext === "CANCEL") return order.refundContext;

            // Fallback inference from status/history
            const labels = (order.statusHistory || []).map(h => String(h.label).toUpperCase());
            if (labels.includes(String(ORDER_STATUS.RETURN_REQUESTED).toUpperCase())
                || labels.includes("RETURN_REQUESTED")
                || String(order.status).toUpperCase().includes("RETURN")) return "RETURN";
            return "CANCEL";
        };

        /* =========================
           Payment events
        ==========================*/
        if (type === "payment.authorized") {
            const p = evt.payload?.payment?.entity;
            if (!p) return res.send("ok");

            const order = await Order.findOne({ razorpay_order_id: p.order_id });
            if (!order) return res.send("ok");

            // Idempotent: if already paid/placed, skip
            if (order.paymentStatus === PAYMENT_STATUS.PAID) return res.send("ok");

            if (order.paymentStatus !== PAYMENT_STATUS.PAYMENT_AUTHORIZED) {
                order.paymentStatus = PAYMENT_STATUS.PAYMENT_AUTHORIZED;
                // DO NOT mark order placed here
                await order.save();
                await sendOrderStatusEmail(order, "PAYMENT_AUTHORIZED");
            }
            return res.send("ok");
        }

        if (type === "payment.captured") {
            const p = evt.payload?.payment?.entity;
            if (!p) return res.send("ok");

            const order = await Order.findOne({ razorpay_order_id: p.order_id });
            if (!order) return res.send("ok");

            // Idempotent: if already paid & placed with same payment id, skip
            if (order.paymentStatus === PAYMENT_STATUS.PAID && order.razorpay_payment_id === p.id) {
                return res.send("ok");
            }

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

        if (type === "payment.failed") {
            const p = evt.payload?.payment?.entity;
            if (!p) return res.send("ok");

            const order = await Order.findOne({ razorpay_order_id: p.order_id });
            if (!order) return res.send("ok");

            // Idempotent: if already failed, skip
            if (order.paymentStatus === PAYMENT_STATUS.FAILED) return res.send("ok");

            order.paymentStatus = PAYMENT_STATUS.FAILED;
            order.status = ORDER_STATUS.PAYMENT_FAILED;
            order.failedPaymentId = p?.id;
            markHistory(order, 0, ORDER_STATUS.PAYMENT_FAILED);
            await order.save();

            await sendOrderStatusEmail(order, "PAYMENT_FAILED");
            return res.send("ok");
        }

        /* =========================
           Refund events
           Supports CANCEL + RETURN flows
        ==========================*/
        if (type === "refund.created") {
            const r = evt.payload?.refund?.entity;
            if (!r) return res.send("ok");

            const order = await Order.findOne({ razorpay_payment_id: r.payment_id });
            if (!order) return res.send("ok");

            // Idempotent: if already initiated/done, skip
            if ([PAYMENT_STATUS.REFUND_INITIATED, PAYMENT_STATUS.REFUND_DONE].includes(order.paymentStatus)) {
                return res.send("ok");
            }

            order.paymentStatus = PAYMENT_STATUS.REFUND_INITIATED;
            // Keep order.status as-is (CANCELLED or RETURN_IN_PROGRESS etc.) — don’t overwrite here
            order.refundId = r.id;
            order.refundAttemptedAt = new Date();
            await order.save();

            await sendOrderStatusEmail(order, "REFUND_INITIATED");
            return res.send("ok");
        }

        if (type === "refund.processed") {
            const r = evt.payload?.refund?.entity;
            if (!r) return res.send("ok");

            const order = await Order.findOne({ razorpay_payment_id: r.payment_id });
            if (!order) return res.send("ok");

            // Idempotent: if already marked done with same refund id, skip
            if (order.paymentStatus === PAYMENT_STATUS.REFUND_DONE && order.refundId === r.id) {
                return res.send("ok");
            }

            order.paymentStatus = PAYMENT_STATUS.REFUND_DONE;
            order.refundId = r.id;
            order.refundDate = new Date();

            const reason = inferRefundContext(order); // "CANCEL" | "RETURN"
            if (reason === "RETURN") {
                // Return workflow completed
                order.status = ORDER_STATUS.REFUND_COMPLETED ?? ORDER_STATUS.RETURN_COMPLETED ?? order.status;
                markHistory(order, -2, order.status);
            } else {
                // Cancel refund completed
                // Keep CANCELLED if already set, else set a safe terminal cancel status
                order.status =
                    order.status === ORDER_STATUS.CANCELLED
                        ? ORDER_STATUS.CANCELLED
                        : (ORDER_STATUS.CANCELLED ?? order.status);
                markHistory(order, -1, order.status);
            }

            await order.save();
            await sendOrderStatusEmail(order, "REFUND_DONE");
            // keep your existing refund email as well
            try { await sendRefundEmail(order, true); } catch { }

            return res.send("ok");
        }

        if (type === "refund.failed") {
            const r = evt.payload?.refund?.entity;
            if (!r) return res.send("ok");

            const order = await Order.findOne({ razorpay_payment_id: r.payment_id });
            if (!order) return res.send("ok");

            // Idempotent: if already marked failed and same refund id, skip
            if (order.paymentStatus === PAYMENT_STATUS.REFUND_FAILED && order.refundId === r.id) {
                return res.send("ok");
            }

            order.paymentStatus = PAYMENT_STATUS.REFUND_FAILED ?? PAYMENT_STATUS.REFUND_REQUESTED;
            order.refundId = r.id || order.refundId;
            await order.save();

            await sendOrderStatusEmail(order, "REFUND_FAILED");
            try { await sendRefundEmail(order, false); } catch { }

            return res.send("ok");
        }

        // Optional: Disputes (no-ops for now; expand later if needed)
        if (type?.startsWith("payment.dispute.")) return res.send("ok");

        // Unknown/unhandled
        return res.send("ok");
    } catch (err) {
        console.error("Webhook error:", err);
        return res.status(500).send("server error");
    }
});

export default router;
