import Stripe from "stripe";
import { logger } from "../utils/logger.js";

// Constructed lazily so importing this module never fails in tooling that
// loads controllers before the test setup has injected STRIPE_SECRET_KEY.
let stripeClient: Stripe | null = null;
const getStripe = (): Stripe => {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy");
  }
  return stripeClient;
};

export type RefundStatus = "not_applicable" | "pending" | "refunded" | "failed";

export interface RefundOutcome {
  status: RefundStatus;
  refundId?: string;
  error?: string;
}

export interface RefundableOrder {
  _id: unknown;
  paymentMethod?: "stripe" | "cod";
  paymentIntentId?: string;
}

const stripeErrorCode = (error: unknown): string | undefined =>
  (error as { code?: string } | null)?.code;

const stripeErrorMessage = (error: unknown): string =>
  (error as { message?: string } | null)?.message || "Refund failed";

/**
 * Refunds a captured Stripe payment exactly once.
 *
 * Rules:
 *  - COD / unpaid checkout sessions are never refunded (`not_applicable`).
 *  - A checkout-session id is resolved to its payment intent only after Stripe
 *    confirms the session was paid. An unpaid pending order therefore cannot
 *    accidentally trigger a refund.
 *  - The Stripe idempotency key is derived from the order id, so a retried
 *    cancellation (customer double-click, two job workers, restart) cannot
 *    issue a second refund.
 */
export async function refundOrderPayment(
  order: RefundableOrder,
  reason: Stripe.RefundCreateParams.Reason = "requested_by_customer",
): Promise<RefundOutcome> {
  if (order.paymentMethod !== "stripe" || !order.paymentIntentId) {
    return { status: "not_applicable" };
  }

  let paymentIntentId = order.paymentIntentId;

  if (paymentIntentId.startsWith("cs_")) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(paymentIntentId);
      const paymentStatus = (session as Stripe.Checkout.Session & {
        payment_status?: string;
      }).payment_status;

      // Stripe sets "unpaid" for abandoned/failed sessions and "paid" once the
      // money has been captured. Anything other than paid means there is
      // nothing to refund.
      if (
        paymentStatus &&
        paymentStatus !== "paid" &&
        paymentStatus !== "no_payment_required"
      ) {
        return { status: "not_applicable" };
      }

      paymentIntentId = (session.payment_intent as string) || "";
    } catch (error) {
      logger.error(
        { err: error, orderId: order._id },
        "Could not resolve Stripe checkout session for refund",
      );
      return { status: "failed", error: stripeErrorMessage(error) };
    }
  }

  if (!paymentIntentId.startsWith("pi_")) {
    return { status: "not_applicable" };
  }

  try {
    const refund = await getStripe().refunds.create(
      {
        payment_intent: paymentIntentId,
        reason,
      },
      { idempotencyKey: `order_cancel_refund_${String(order._id)}` },
    );

    return { status: "refunded", refundId: refund.id };
  } catch (error) {
    // Stripe returns this when the payment was already fully refunded (for
    // example a retry after a previous successful call). That is success.
    if (stripeErrorCode(error) === "charge_already_refunded") {
      return { status: "refunded" };
    }

    logger.error(
      { err: error, orderId: order._id, paymentIntentId },
      "Stripe refund failed",
    );
    return { status: "failed", error: stripeErrorMessage(error) };
  }
}
