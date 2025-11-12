import { Resend } from "resend";
import { renderEmail, subjectFor } from "./emailTemplate.js";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = process.env.MAIL_FROM || "Shinra Deskware <no-reply@shinra-deskware.com>";
const DASHBOARD_URL = process.env.CLIENT_URL?.split(",")[0] || "https://yourapp.example.com";

export async function sendOrderStatusEmail(order, type) {
  const fullName = order?.address?.fullName || "Customer";
  const orderId = order?.orderId || "Order";
  const total = Number(order?.total || 0).toLocaleString("en-IN");
  const subject = subjectFor(order, type);

  const intro = messageFor(type);

  const blocks = [
    {
      title: "Order Details",
      rows: [
        { k: "Order ID: ", v: orderId },
        { k: "Total: ", v: `₹${total}` },
        ...(order?.paymentMethod ? [{ k: "Payment: ", v: order.paymentMethod }] : []),
        ...(order?.paymentStatus ? [{ k: "Payment Status: ", v: order.paymentStatus.replaceAll("_", " ") }] : []),
        ...(order?.status ? [{ k: "Order Status: ", v: order.status.replaceAll("_", " ") }] : []),
      ],
    },
  ];

  if (order?.trackingId || order?.trackingUrl) {
    blocks.push({
      title: "Shipping",
      rows: [
        ...(order.trackingId ? [{ k: "Tracking ID", v: order.trackingId }] : []),
        ...(order.trackingUrl ? [{ k: "Track URL", v: `<a href="${order.trackingUrl}">${order.trackingUrl}</a>` }] : []),
      ],
    });
  }

  const html = renderEmail({
    title: emailTitleFor(type),
    intro: `Hi ${fullName}, ${intro}`,
    blocks,
    cta: { label: "View my order", href: `${DASHBOARD_URL}/dashboard/orders` },
  });

  try {
    await resend.emails.send({ from: FROM, to: order.emailId, subject, html });
  } catch (e) {
    console.error("sendOrderStatusEmail error:", e?.message || e);
  }
}

function messageFor(type) {
  switch (type) {
    case "PAYMENT_AUTHORIZED": return "your payment is authorized. We’ll capture it and start processing shortly.";
    case "PAID": return "we’ve received your payment. We’ll share tracking details soon.";
    case "PAYMENT_FAILED": return "your payment attempt failed. You can retry from your orders page.";
    case "REFUND_REQUESTED": return "your refund request is received. We’ll process it and keep you posted.";
    case "REFUND_INITIATED": return "your refund has been initiated. It may take a few days to reflect.";
    case "REFUND_DONE": return "your refund has been completed successfully.";
    case "REFUND_FAILED": return "your refund couldn’t be processed. We’ll retry automatically.";
    case "PENDING": return "your order is created. Complete payment to proceed.";
    case "ORDER_PLACED": return "your order is confirmed.";
    case "ORDER_PACKED": return "your order is packed and will ship soon.";
    case "IN_TRANSIT": return "your order is on the way.";
    case "OUT_FOR_DELIVERY": return "your order is out for delivery.";
    case "DELIVERED": return "your order has been delivered. We hope you enjoy it!";
    case "CANCELLED": return "your order has been cancelled. If paid, refund updates will follow.";
    case "RETURN_ACCEPTED": return "your return request has been approved. Please ship the item back.";
    case "RETURN_RECEIVED": return "we received your returned item. Your refund is being processed.";
    default: return "there’s an update on your order.";
  }
}

function emailTitleFor(type) {
  const map = {
    PAYMENT_AUTHORIZED: "✅ Payment Authorized",
    PAID: "✅ Payment Received",
    PAYMENT_FAILED: "⚠️ Payment Failed",
    REFUND_REQUESTED: "↩️ Refund Requested",
    REFUND_INITIATED: "↩️ Refund Initiated",
    REFUND_DONE: "✅ Refund Completed",
    REFUND_FAILED: "⚠️ Refund Failed",
    PENDING: "🧾 Order Created",
    ORDER_PLACED: "✅ Order Confirmed",
    ORDER_PACKED: "📦 Order Packed",
    IN_TRANSIT: "🚚 In Transit",
    OUT_FOR_DELIVERY: "🛵 Out for Delivery",
    DELIVERED: "✅ Delivered",
    CANCELLED: "❌ Order Cancelled",
    RETURN_ACCEPTED: "↩️ Return Approved",
    RETURN_RECEIVED: "📦 Return Received",
  };
  return map[type] || "ℹ️ Order Update";
}

// optional shim if you need it elsewhere
export async function sendPaymentStatusEmail(order) {
  return sendOrderStatusEmail(order, order.paymentStatus || "PENDING");
}
