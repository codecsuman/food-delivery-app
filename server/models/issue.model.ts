import mongoose, { Document } from "mongoose";

export const ISSUE_TYPES = [
  "missing_item",
  "wrong_item",
  "cold_food",
  "late_delivery",
  "payment",
  "hygiene",
  "other",
] as const;

export const ISSUE_STATUSES = [
  "open",
  "in_review",
  "resolved",
  "rejected",
] as const;

export type IssueType = (typeof ISSUE_TYPES)[number];
export type IssueStatus = (typeof ISSUE_STATUSES)[number];

export interface IIssue extends Document {
  order: mongoose.Schema.Types.ObjectId;
  restaurant: mongoose.Schema.Types.ObjectId;
  user: mongoose.Schema.Types.ObjectId;
  type: IssueType;
  description: string;
  status: IssueStatus;
  resolutionNote?: string;
  resolvedBy?: mongoose.Schema.Types.ObjectId;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const issueSchema = new mongoose.Schema<IIssue>(
  {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    type: {
      type: String,
      enum: {
        values: ISSUE_TYPES,
        message: "Issue type {VALUE} is not supported",
      },
      required: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: [10, "Description must be at least 10 characters"],
      maxlength: [1000, "Description cannot exceed 1000 characters"],
    },
    status: {
      type: String,
      enum: {
        values: ISSUE_STATUSES,
        message: "Issue status {VALUE} is not valid",
      },
      default: "open",
      required: true,
    },
    resolutionNote: {
      type: String,
      trim: true,
      maxlength: [500, "Resolution note cannot exceed 500 characters"],
    },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    resolvedAt: { type: Date },
  },
  { timestamps: true },
);

issueSchema.index({ user: 1, createdAt: -1 });
issueSchema.index({ restaurant: 1, status: 1, createdAt: -1 });
issueSchema.index({ order: 1 });
// A customer can have at most one *open* report of the same type per order.
// Partial so resolved/rejected reports do not block a future report.
issueSchema.index(
  { order: 1, user: 1, type: 1 },
  { unique: true, partialFilterExpression: { status: "open" } },
);

export const Issue = mongoose.model<IIssue>("Issue", issueSchema);
