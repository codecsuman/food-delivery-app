import { WebhookEvent } from "../models/webhookEvent.model.js";

/**
 * How long a claim may stay in "processing" before another delivery of the
 * same event is allowed to take over. Stripe retries after minutes/hours, so a
 * crashed process must not block its own retry forever.
 */
const STALE_CLAIM_MS = 5 * 60 * 1000;

const isDuplicateKeyError = (error: unknown): boolean =>
  (error as { code?: number } | null)?.code === 11000;

export type WebhookClaim =
  | { claimed: true; reason: "new" | "retry" }
  | { claimed: false; reason: "duplicate" | "in_progress" };

/**
 * Atomically claim an event before processing it. Exactly one caller wins for
 * a brand-new event; concurrent duplicates see `in_progress`, and already
 * handled events see `duplicate`.
 */
export async function claimWebhookEvent(
  eventId: string,
  type: string,
): Promise<WebhookClaim> {
  const now = new Date();

  try {
    await WebhookEvent.create({
      eventId,
      type,
      status: "processing",
      attempts: 1,
      lockedAt: now,
    });
    return { claimed: true, reason: "new" };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;
  }

  // The event already exists. Re-claim it only when the previous attempt
  // failed or the claiming process disappeared mid-flight.
  const staleBefore = new Date(now.getTime() - STALE_CLAIM_MS);
  const reclaimed = await WebhookEvent.findOneAndUpdate(
    {
      eventId,
      $or: [
        { status: "failed" },
        { status: "processing", lockedAt: { $lt: staleBefore } },
      ],
    },
    {
      $set: { status: "processing", lockedAt: now, lastError: null },
      $inc: { attempts: 1 },
    },
    { new: true },
  );

  if (reclaimed) return { claimed: true, reason: "retry" };

  const existing = await WebhookEvent.findOne({ eventId }).lean();
  return {
    claimed: false,
    reason: existing?.status === "processed" ? "duplicate" : "in_progress",
  };
}

/** Mark an event as successfully handled. Never throws at the caller's expense. */
export async function completeWebhookEvent(
  eventId: string,
  orderId?: string,
): Promise<void> {
  await WebhookEvent.updateOne(
    { eventId },
    {
      $set: {
        status: "processed",
        processedAt: new Date(),
        lastError: null,
        ...(orderId ? { orderId } : {}),
      },
    },
  );
}

/** Record a failure so Stripe's retry (and an operator) can see what happened. */
export async function failWebhookEvent(
  eventId: string,
  error: unknown,
): Promise<void> {
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");

  await WebhookEvent.updateOne(
    { eventId },
    {
      $set: {
        status: "failed",
        lastError: message.slice(0, 500),
      },
    },
  );
}
