import { Resend } from "resend";
import { renderEmail, subjectFor } from "./emailTemplate.js";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.MAIL_FROM || "Shinra Deskware <no-reply@shinra-deskware.com>";
const SUPPORT = process.env.ALERT_EMAIL || "support@shinra-deskware.com";

export async function sendRefundEmail(order, success) {
    const orderId = order?.orderId || "Order";
    const total = Number(order?.total || 0).toLocaleString("en-IN");

    const subject = subjectFor(order, success ? "REFUND_DONE" : "REFUND_FAILED");
    const html = renderEmail({
        title: success ? "✅ Refund Completed" : "⚠️ Refund Failed",
        intro: success
            ? "we’ve successfully processed your refund."
            : "we couldn’t complete your refund. We’ll retry automatically and keep you updated.",
        blocks: [
            {
                title: "Refund Summary",
                rows: [
                    { k: "Order ID", v: orderId },
                    { k: "Amount", v: `₹${total}` },
                    ...(order?.refundId ? [{ k: "Refund ID", v: order.refundId }] : []),
                ],
            },
        ],
        footerNote: "If you have any questions, reply to this email and our team will help you.",
    });

    // customer
    await resend.emails.send({ from: FROM, to: order.emailId, subject, html });

    // admin copy
    await resend.emails.send({ from: FROM, to: SUPPORT, subject: `[Copy] ${subject}`, html });
}
