import { Resend } from "resend";
import { renderEmail, subjectFor } from "./emailTemplate.js";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.MAIL_FROM || "Shinra Deskware <no-reply@shinra-deskware.com>";
const SUPPORT = process.env.ALERT_EMAIL || "support@shinra-deskware.com";

export async function sendNewOrderEmail(order) {
  const fullName = order?.address?.fullName || "Customer";
  const emailId = order?.emailId || "N/A";
  const phone = order?.phoneNumber || "N/A";
  const total = Number(order?.total || 0).toLocaleString("en-IN");

  const subject = subjectFor(order, "ADMIN_NEW_PAID");
  const html = renderEmail({
    title: "🛍️ New Paid Order",
    intro: `New paid order received from ${fullName}.`,
    blocks: [
      {
        title: "Customer",
        rows: [
          { k: "Name", v: fullName },
          { k: "Email", v: emailId },
          { k: "Phone", v: phone },
        ],
      },
      {
        title: "Order",
        rows: [
          { k: "Order ID", v: order.orderId },
          { k: "Total", v: `₹${total}` },
          ...(order?.razorpay_payment_id ? [{ k: "Payment ID", v: order.razorpay_payment_id }] : []),
        ],
      },
    ],
    footerNote: "This is an internal alert sent to your ops mailbox.",
  });

  try {
    await resend.emails.send({
      from: FROM,
      to: SUPPORT,
      reply_to: emailId !== "N/A" ? emailId : undefined,
      subject,
      html,
    });
  } catch (e) {
    console.error("sendNewOrderEmail error:", e?.message || e);
  }
}
