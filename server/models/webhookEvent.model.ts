import mongoose, { Document } from "mongoose";

/**
 * Durable record of every Stripe webhook event we have seen.
 *
 * The previous implementation kept this in an in-process Map, which meant a
 * deploy/restart (or a second server instance) forgot which events had already
 * been handled and could replay side effects such as menu order-count
 * increments. MongoDB is the source of truth here.
 */
export type WebhookEventStatus = "processing" | "processed" | "failed";

export interface IWebhookEvent extends Document {
  eventId: string;
  type: string;
  status: WebhookEventStatus;
  attempts: number;
  orderId?: string;
  lastError?: string | null;
  lockedAt: Date;
  processedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const webhookEventSchema = new mongoose.Schema<IWebhookEvent>(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: {
        values: ["processing", "processed", "failed"],
        message: "Webhook status {VALUE} is not valid",
      },
      default: "processing",
      required: true,
    },
    attempts: {
      type: Number,
      default: 1,
      min: 1,
    },
    orderId: { type: String, trim: true },
    lastError: { type: String, default: null, maxlength: 500 },
    // Used to detect an event that was claimed by a process that then died.
    lockedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
  },
  { timestamps: true },
);

webhookEventSchema.index({ status: 1, lockedAt: 1 });
// Stripe retries for up to ~3 days. Keeping 30 days is comfortably longer and
// lets MongoDB remove old rows automatically.
webhookEventSchema.index(
  { processedAt: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * 30 },
);

export const WebhookEvent = mongoose.model<IWebhookEvent>(
  "WebhookEvent",
  webhookEventSchema,
);
