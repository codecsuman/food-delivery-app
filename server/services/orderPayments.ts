import type {
  PaymentEvent,
  PaymentEventType,
  PaymentStatus,
} from "../models/order.model.js";

/**
 * Builds one append-only payment/refund audit entry. Never mutates an existing
 * entry, so the full history stays reconstructable.
 */
export function paymentEvent(
  type: PaymentEventType,
  status: PaymentStatus,
  extra: Omit<Partial<PaymentEvent>, "type" | "status" | "createdAt"> = {},
): PaymentEvent {
  return {
    type,
    status,
    ...extra,
    createdAt: new Date(),
  };
}

export interface PaymentStateSource {
  status: string;
  paymentMethod?: "stripe" | "cod";
  refundStatus?: "not_applicable" | "pending" | "refunded" | "failed";
  paymentStatus?: PaymentStatus;
}

/**
 * Derives the money state for an order from its fulfilment status. Used by the
 * backfill migration and as a safety net for documents created before
 * `paymentStatus` existed.
 */
export function derivePaymentStatus(order: PaymentStateSource): PaymentStatus {
  if (order.paymentStatus) return order.paymentStatus;

  if (order.paymentMethod === "cod") {
    if (order.status === "delivered") return "paid";
    if (order.status === "cancelled") return "not_required";
    return "unpaid";
  }

  switch (order.status) {
    case "confirmed":
    case "preparing":
    case "outfordelivery":
    case "delivered":
      return "paid";
    case "payment_failed":
      return "failed";
    case "cancelled":
      if (order.refundStatus === "refunded") return "refunded";
      if (order.refundStatus === "pending") return "pending";
      // A cancelled order whose refund failed still holds the customer's
      // money, so its money state remains "paid" (needs manual action).
      if (order.refundStatus === "failed") return "paid";
      return "unpaid";
    case "pending":
    default:
      return "unpaid";
  }
}

/**
 * Money state to store when a cancellation is claimed. Paid Stripe orders move
 * to "pending" while the refund is in flight; everything else keeps its
 * existing state.
 */
export function paymentStatusOnCancellation(
  order: PaymentStateSource,
): PaymentStatus {
  const current = derivePaymentStatus(order);

  if (order.paymentMethod === "cod") return "not_required";
  if (current === "paid" || current === "partially_refunded") return "pending";
  return current;
}

/** Maps a refund outcome onto the order's money state. */
export function paymentStatusAfterRefund(
  previous: PaymentStatus,
  refundStatus: "not_applicable" | "pending" | "refunded" | "failed",
): PaymentStatus {
  if (refundStatus === "refunded") return "refunded";
  // The refund failed, so the money is still captured by us.
  if (refundStatus === "failed") return previous === "pending" ? "paid" : previous;
  return previous;
}
