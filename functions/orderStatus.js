"use strict";

const ORDER_ID_PATTERN = /^[A-Za-z0-9]{20}$/;
const SAFE_ORDER_STATUSES = new Set(["pending", "paid", "cancelled"]);
const SAFE_PAYMENT_STATUSES = new Set(["pending", "paid", "expired"]);

function isValidOrderId(orderId) {
    return typeof orderId === "string" && ORDER_ID_PATTERN.test(orderId);
}

function safeValue(value, allowedValues) {
    return typeof value === "string" && allowedValues.has(value) ? value : null;
}

function buildPublicOrderStatus(order) {
    if (!order) {
        return {
            exists: false,
            status: null,
            paymentStatus: null,
            confirmed: false,
            confirmationState: "not_found",
        };
    }

    const status = safeValue(order.status, SAFE_ORDER_STATUSES);
    const paymentStatus = safeValue(
        order.paymentStatus,
        SAFE_PAYMENT_STATUSES
    );
    const confirmed = status === "paid" && paymentStatus === "paid";
    const cancelled =
        status === "cancelled" || paymentStatus === "expired";

    return {
        exists: true,
        status,
        paymentStatus,
        confirmed,
        confirmationState: confirmed
            ? "confirmed"
            : cancelled
                ? "cancelled"
                : "processing",
    };
}

module.exports = {
    buildPublicOrderStatus,
    isValidOrderId,
};
