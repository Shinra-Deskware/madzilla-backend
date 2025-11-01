// server/constants/constants.js
export const ORDER_STATUS = {
    PENDING: "PENDING",
    ORDER_PLACED: "ORDER_PLACED",
    ORDER_PACKED: "ORDER_PACKED",
    IN_TRANSIT: "IN_TRANSIT",
    OUT_FOR_DELIVERY: "OUT_FOR_DELIVERY",
    DELIVERED: "DELIVERED",

    // Returns workflow
    RETURN_REQUESTED: "RETURN_REQUESTED",
    RETURN_ACCEPTED: "RETURN_ACCEPTED",   // ✅ admin approved return
    RETURN_RECEIVED: "RETURN_RECEIVED",   // ✅ item received by admin; refund starts
    RETURN_REJECTED: "RETURN_REJECTED",
    RETURNED: "RETURNED",                 // ✅ final after refund done

    CANCELLED: "CANCELLED",
    PAYMENT_FAILED: "Payment Failed",
};

export const PAYMENT_STATUS = {
    PENDING: "PENDING",
    PAID: "PAID",
    FAILED: "FAILED",
    CANCELLED: "CANCELLED",
    REFUND_REQUESTED: "REFUND_REQUESTED",
    REFUND_INITIATED: "REFUND_INITIATED",
    REFUND_FAILED: "REFUND_FAILED",
    REFUND_DONE: "REFUND_DONE",
};
