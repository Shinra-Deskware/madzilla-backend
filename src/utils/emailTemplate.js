// server/utils/emailTemplate.js
const BRAND = {
    name: "Shinra Deskware",
    primary: "#00B86E",
    darkBg: "#ffffffff",
    cardBg: "#151923",
    text: "#E8EAF0",
    sub: "#9AA3B2",
    border: "#222735",
    accent: "#7A5CF4",
    logoText: "S H I N R A",
};

export function subjectFor(order, kind, extra = "") {
    const id = order?.orderId || "Order";
    const map = {
        PAYMENT_AUTHORIZED: `Payment Authorized | ${id}`,
        PAID: `Payment Received | ${id}`,
        PAYMENT_FAILED: `Payment Failed | ${id}`,
        REFUND_REQUESTED: `Refund Requested | ${id}`,
        REFUND_INITIATED: `Refund Initiated | ${id}`,
        REFUND_DONE: `Refund Completed | ${id}`,
        REFUND_FAILED: `Refund Failed | ${id}`,
        PENDING: `Placed (Pending Payment) | ${id}`,
        ORDER_PLACED: `Order Confirmed | ${id}`,
        ORDER_PACKED: `Order Packed | ${id}`,
        IN_TRANSIT: `In Transit | ${id}`,
        OUT_FOR_DELIVERY: `Out for Delivery | ${id}`,
        DELIVERED: `Delivered | ${id}`,
        CANCELLED: `Cancelled | ${id}`,
        RETURN_ACCEPTED: `Return Approved | ${id}`,
        RETURN_RECEIVED: `Return Received | ${id}`,
        ADMIN_NEW_PAID: `✅ New Paid Order | ${id}`,
    };
    return extra || map[kind] || `Update | ${id}`;
}

export function renderEmail({
    title,
    intro,
    blocks = [],
    cta, // { label, href }
    footerNote = "Thank you for shopping with us.",
}) {
    return `
  <div style="background:${BRAND.darkBg};padding:36px 18px;">
    <div style="max-width:640px;margin:0 auto;background:${BRAND.cardBg};border:1px solid ${BRAND.border};border-radius:14px;overflow:hidden;">
      <!-- Header -->
      <div style="padding:18px 22px;border-bottom:1px solid ${BRAND.border};display:flex;align-items:center;gap:10px">
        <div style="font-family:Inter,Arial,sans-serif;color:${BRAND.text};letter-spacing:6px;font-weight:700;">
          ${BRAND.logoText}
        </div>
      </div>

      <!-- Body -->
      <div style="padding:24px 22px 8px;font-family:Inter,Arial,sans-serif;color:${BRAND.text}">
        <h2 style="margin:0 0 8px;font-size:22px;line-height:28px;color:${BRAND.text}">${title}</h2>
        <p style="margin:0 0 18px;color:${BRAND.sub};font-size:14px;line-height:22px">${intro}</p>

        ${blocks
            .map(
                (b) => `
            <div style="margin:12px 0;padding:14px;border:1px solid ${BRAND.border};border-radius:12px;background:#111521">
              ${b.title ? `<div style="color:${BRAND.text};font-weight:600;margin-bottom:6px">${b.title}</div>` : ""}
              ${b.rows
                        ? b.rows
                            .map(
                                (r) => `
                <div style="display:flex;justify-content:space-between;color:${BRAND.text};font-size:14px;line-height:22px">
                  <span style="color:${BRAND.sub}">${r.k}</span>
                  <span>${r.v}</span>
                </div>`
                            )
                            .join("")
                        : b.html || ""
                    }
            </div>`
            )
            .join("")}

        ${cta ? `
          <div style="margin:24px 0">
            <a href="${cta.href}" style="display:inline-block;background:${BRAND.primary};color:#08130D;text-decoration:none;padding:10px 16px;border-radius:10px;font-weight:700">
              ${cta.label}
            </a>
          </div>` : ""}

        <p style="margin:12px 0 0;color:${BRAND.sub};font-size:12px">${footerNote}</p>
      </div>

      <!-- Footer -->
      <div style="padding:16px 22px;border-top:1px solid ${BRAND.border};font-family:Inter,Arial,sans-serif;color:${BRAND.sub};font-size:12px">
        © ${new Date().getFullYear()} ${BRAND.name}. All rights reserved.
      </div>
    </div>
  </div>
  `.trim();
}
