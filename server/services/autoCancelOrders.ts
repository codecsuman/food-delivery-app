import { Order, type IOrder } from "../models/order.model.js";
import { logger } from "../utils/logger.js";
import { refundOrderPayment, type RefundStatus } from "./orderRefunds.js";

const readHours = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseFloat(value ?? "");
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Orders still waiting for the restaurant to start preparing beyond this age are cancelled. */
export const AUTO_CANCEL_AFTER_HOURS = readHours(
  process.env.AUTO_CANCEL_AFTER_HOURS,
  2,
);

export const AUTO_CANCEL_AFTER_MS =
  AUTO_CANCEL_AFTER_HOURS * 60 * 60 * 1000;

const readPositiveInt = (value: string | undefined, fallback: number) => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const AUTO_CANCEL_INTERVAL_MS =
  readPositiveInt(process.env.AUTO_CANCEL_INTERVAL_MINUTES, 5) * 60 * 1000;

export const autoCancelReason = () =>
  `Auto-cancelled because the restaurant did not start preparing the order within ${AUTO_CANCEL_AFTER_HOURS} hour${
    AUTO_CANCEL_AFTER_HOURS === 1 ? "" : "s"
  }`;

export interface AutoCancelResult {
  orderId: string;
  previousStatus: string;
  refundStatus: RefundStatus;
  refundId?: string;
}

export interface AutoCancelOptions {
  /** Controlled clock for tests; defaults to now. */
  now?: Date;
  limit?: number;
  /** Called after the DB row has been updated (socket/email notifications). */
  onCancelled?: (order: IOrder) => void | Promise<void>;
}

const getCutoff = (now: Date) => new Date(now.getTime() - AUTO_CANCEL_AFTER_MS);

/**
 * Restart-safe, idempotent auto-cancellation worker.
 *
 * Only orders that are still `pending` or `confirmed` (i.e. the restaurant has
 * not started `preparing`) and are older than the configured window are
 * eligible. Each order is claimed with a single conditional update, so
 * concurrent workers (or overlapping intervals) can never cancel or refund the
 * same order twice. All state lives in MongoDB, so a process restart simply
 * continues from the current database state.
 */
export async function runAutoCancelOrders(
  options: AutoCancelOptions = {},
): Promise<AutoCancelResult[]> {
  const now = options.now ?? new Date();
  const cutoff = getCutoff(now);
  const limit = Math.max(1, Math.min(options.limit ?? 100, 500));

  const candidates = await Order.find({
    status: { $in: ["pending", "confirmed"] },
    createdAt: { $lte: cutoff },
    cancelledAt: { $exists: false },
  })
    .sort({ createdAt: 1 })
    .limit(limit);

  const results: AutoCancelResult[] = [];

  for (const candidate of candidates) {
    const previousStatus = candidate.status;
    const initialRefundStatus: RefundStatus =
      candidate.paymentMethod === "stripe" && candidate.paymentIntentId
        ? "pending"
        : "not_applicable";

    // Atomic claim. The status + age predicates guarantee that an order which
    // started preparing (or was already cancelled) in the meantime is skipped.
    const cancelled = await Order.findOneAndUpdate(
      {
        _id: candidate._id,
        status: { $in: ["pending", "confirmed"] },
        createdAt: { $lte: cutoff },
        cancelledAt: { $exists: false },
      },
      {
        $set: {
          status: "cancelled",
          cancellationReason: autoCancelReason(),
          cancelledAt: now,
          cancelledBy: "system",
          refundStatus: initialRefundStatus,
        },
      },
      { new: true },
    );

    if (!cancelled) {
      // Another worker/request won the race. Nothing to refund or notify.
      continue;
    }

    let refundStatus: RefundStatus = initialRefundStatus;
    let refundId: string | undefined;

    if (initialRefundStatus === "pending") {
      const outcome = await refundOrderPayment(cancelled, "requested_by_customer");
      refundStatus = outcome.status;
      refundId = outcome.refundId;

      await Order.updateOne(
        { _id: cancelled._id, status: "cancelled" },
        {
          $set: {
            refundStatus,
            ...(refundId ? { refundId } : {}),
          },
        },
      );

      cancelled.refundStatus = refundStatus;
      if (refundId) cancelled.refundId = refundId;
    }

    logger.info(
      {
        orderId: cancelled._id.toString(),
        previousStatus,
        refundStatus,
      },
      "Order auto-cancelled after preparation timeout",
    );

    results.push({
      orderId: cancelled._id.toString(),
      previousStatus,
      refundStatus,
      ...(refundId ? { refundId } : {}),
    });

    if (options.onCancelled) {
      try {
        await options.onCancelled(cancelled);
      } catch (error) {
        // A failed notification must never roll back a committed cancellation.
        logger.error(
          { err: error, orderId: cancelled._id.toString() },
          "Auto-cancel notification failed",
        );
      }
    }
  }

  return results;
}

/**
 * Starts the recurring worker and runs once immediately so overdue orders are
 * cancelled right after a restart/deploy rather than waiting a full interval.
 */
export function startAutoCancelJob(
  onCancelled?: AutoCancelOptions["onCancelled"],
) {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runAutoCancelOrders({ onCancelled });
    } catch (error) {
      logger.error({ err: error }, "Auto-cancel job failed");
    } finally {
      running = false;
    }
  };

  void tick();

  const timer = setInterval(tick, AUTO_CANCEL_INTERVAL_MS);
  timer.unref?.();

  return () => clearInterval(timer);
}
