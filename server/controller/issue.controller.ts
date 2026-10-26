import { Request, Response } from "express";
import { Issue, type IssueStatus } from "../models/issue.model.js";
import { Order } from "../models/order.model.js";
import { Restaurant } from "../models/restaurant.model.js";
import { logger } from "../utils/logger.js";

/**
 * Ordered-state rules for issue handling. Terminal states cannot be reopened;
 * a customer should create a new report instead (the partial unique index only
 * blocks duplicate *open* reports).
 */
const ISSUE_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  open: ["in_review", "resolved", "rejected"],
  in_review: ["resolved", "rejected"],
  resolved: [],
  rejected: [],
};

const TERMINAL_STATUSES: IssueStatus[] = ["resolved", "rejected"];

const isDuplicateKeyError = (error: unknown) =>
  (error as { code?: number } | null)?.code === 11000;

const paginate = (req: Request) => {
  const page = Math.max(1, Number.parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, Number.parseInt(req.query.limit as string, 10) || 20),
  );
  return { page, limit, skip: (page - 1) * limit };
};

// ======================= CREATE ISSUE (CUSTOMER) =======================
export const createIssue = async (req: Request, res: Response) => {
  try {
    const { orderId, type, description } = req.body;

    // Scope the lookup to the caller so a guessed order id cannot be used to
    // report (or probe) somebody else's order.
    const order = await Order.findOne({ _id: orderId, user: req.id }).select(
      "_id restaurant status",
    );

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    if (order.status === "pending" || order.status === "payment_failed") {
      return res.status(400).json({
        success: false,
        message: "You can report an issue once the order has been accepted",
      });
    }

    const issue = await Issue.create({
      order: order._id,
      restaurant: order.restaurant,
      user: req.id,
      type,
      description,
    });

    return res.status(201).json({
      success: true,
      message: "Issue reported successfully",
      issue,
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return res.status(409).json({
        success: false,
        message:
          "You have already reported this issue for this order. The restaurant is reviewing it.",
      });
    }

    logger.error({ err: error }, "Create issue failed");
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= LIST MY ISSUES (CUSTOMER) =======================
export const getMyIssues = async (req: Request, res: Response) => {
  try {
    const { page, limit, skip } = paginate(req);

    const [issues, totalCount] = await Promise.all([
      Issue.find({ user: req.id })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("order", "status totalAmount createdAt")
        .populate("restaurant", "restaurantName imageUrl"),
      Issue.countDocuments({ user: req.id }),
    ]);

    return res.status(200).json({
      success: true,
      count: issues.length,
      totalCount,
      issues,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        limit,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "List my issues failed");
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= LIST RESTAURANT ISSUES (OWNER) =======================
export const getRestaurantIssues = async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params as { restaurantId: string };

    const restaurant = await Restaurant.findOne({
      _id: restaurantId,
      user: req.id,
    }).select("_id restaurantName");

    if (!restaurant) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found" });
    }

    const { page, limit, skip } = paginate(req);
    const status = req.query.status as IssueStatus | undefined;

    const filter = {
      restaurant: restaurant._id,
      ...(status ? { status } : {}),
    };

    const [issues, totalCount] = await Promise.all([
      Issue.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("order", "status totalAmount createdAt deliveryDetails.name")
        .populate("user", "fullname email contact"),
      Issue.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      count: issues.length,
      totalCount,
      issues,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        limit,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "List restaurant issues failed");
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= UPDATE ISSUE STATUS (OWNER/ADMIN) =======================
export const updateIssueStatus = async (req: Request, res: Response) => {
  try {
    const { issueId } = req.params as { issueId: string };
    const { status, resolutionNote } = req.body as {
      status: IssueStatus;
      resolutionNote?: string;
    };

    const issue = await Issue.findById(issueId);
    if (!issue) {
      return res
        .status(404)
        .json({ success: false, message: "Issue not found" });
    }

    if (!req.admin) {
      const ownsRestaurant = await Restaurant.exists({
        _id: issue.restaurant,
        user: req.id,
      });
      if (!ownsRestaurant) {
        return res.status(403).json({
          success: false,
          message: "Not authorized to update this issue",
        });
      }
    }

    if (!ISSUE_TRANSITIONS[issue.status].includes(status)) {
      return res.status(409).json({
        success: false,
        message: `Cannot move an issue from "${issue.status}" to "${status}"`,
      });
    }

    const isTerminal = TERMINAL_STATUSES.includes(status);

    // Conditional update: two dashboard tabs cannot apply conflicting
    // transitions at the same time.
    const updated = await Issue.findOneAndUpdate(
      { _id: issue._id, status: issue.status },
      {
        $set: {
          status,
          ...(resolutionNote !== undefined ? { resolutionNote } : {}),
          ...(isTerminal
            ? { resolvedAt: new Date(), resolvedBy: req.id }
            : {}),
        },
      },
      { new: true },
    );

    if (!updated) {
      return res.status(409).json({
        success: false,
        message: "This issue was already updated. Please refresh.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Issue updated successfully",
      issue: updated,
    });
  } catch (error) {
    logger.error({ err: error }, "Update issue status failed");
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
