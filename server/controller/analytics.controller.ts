import { Request, Response } from "express";
import { Restaurant } from "../models/restaurant.model.js";
import { Order } from "../models/order.model.js";
import { logger } from "../utils/logger.js";

const RANGE_DAYS: Record<string, number | null> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  all: null,
};

const round2 = (value: number) => Math.round(value * 100) / 100;

const emptyOverall = {
  totalOrders: 0,
  totalValue: 0,
  paidOrders: 0,
  paidValue: 0,
  refundedOrders: 0,
  refundedValue: 0,
  cancelledOrders: 0,
  deliveredOrders: 0,
};

/**
 * Owner-only sales analytics for one restaurant.
 *
 * All money figures are derived from server-side order documents; nothing is
 * supplied by the client. `paymentStatus` is read with a fallback to "unpaid"
 * so orders created before that field existed still count correctly.
 */
export const getRestaurantAnalytics = async (req: Request, res: Response) => {
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

    const rangeKey = (req.query.range as string) || "30d";
    // `all` intentionally maps to null (no lower bound); `??` would wrongly
    // replace that null with the default, so use an explicit lookup.
    const days = rangeKey in RANGE_DAYS ? RANGE_DAYS[rangeKey] : 30;
    const now = new Date();
    const from =
      days === null
        ? null
        : new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const match = {
      restaurant: restaurant._id,
      ...(from ? { createdAt: { $gte: from } } : {}),
    };

    const [result] = await Order.aggregate([
      { $match: match },
      {
        $facet: {
          overall: [
            {
              $group: {
                _id: null,
                totalOrders: { $sum: 1 },
                totalValue: { $sum: "$totalAmount" },
                paidOrders: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          { $ifNull: ["$paymentStatus", "unpaid"] },
                          "paid",
                        ],
                      },
                      1,
                      0,
                    ],
                  },
                },
                paidValue: {
                  $sum: {
                    $cond: [
                      {
                        $eq: [
                          { $ifNull: ["$paymentStatus", "unpaid"] },
                          "paid",
                        ],
                      },
                      "$totalAmount",
                      0,
                    ],
                  },
                },
                refundedOrders: {
                  $sum: {
                    $cond: [{ $eq: ["$refundStatus", "refunded"] }, 1, 0],
                  },
                },
                refundedValue: {
                  $sum: {
                    $cond: [
                      { $eq: ["$refundStatus", "refunded"] },
                      "$totalAmount",
                      0,
                    ],
                  },
                },
                cancelledOrders: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0],
                  },
                },
                deliveredOrders: {
                  $sum: {
                    $cond: [{ $eq: ["$status", "delivered"] }, 1, 0],
                  },
                },
              },
            },
          ],
          // Business volume excludes orders that never produced a sale.
          sales: [
            {
              $match: {
                status: { $nin: ["cancelled", "payment_failed"] },
              },
            },
            {
              $group: {
                _id: null,
                orders: { $sum: 1 },
                value: { $sum: "$totalAmount" },
              },
            },
          ],
          byStatus: [
            {
              $group: {
                _id: "$status",
                count: { $sum: 1 },
                value: { $sum: "$totalAmount" },
              },
            },
            { $sort: { count: -1, _id: 1 } },
          ],
          byPaymentStatus: [
            {
              $group: {
                _id: { $ifNull: ["$paymentStatus", "unpaid"] },
                count: { $sum: 1 },
                value: { $sum: "$totalAmount" },
              },
            },
            { $sort: { count: -1, _id: 1 } },
          ],
          topItems: [
            // Sold/redeemed items only: a cancelled or failed order should not
            // make a dish look popular.
            {
              $match: {
                status: { $nin: ["cancelled", "payment_failed"] },
              },
            },
            { $unwind: "$cartItems" },
            {
              $group: {
                _id: {
                  menuId: "$cartItems.menuId",
                  name: "$cartItems.name",
                },
                quantity: { $sum: "$cartItems.quantity" },
                revenue: {
                  $sum: {
                    $multiply: ["$cartItems.price", "$cartItems.quantity"],
                  },
                },
              },
            },
            { $sort: { quantity: -1, revenue: -1 } },
            { $limit: 10 },
          ],
          daily: [
            {
              $match: {
                status: { $nin: ["cancelled", "payment_failed"] },
              },
            },
            {
              $group: {
                _id: {
                  $dateToString: { format: "%Y-%m-%d", date: "$createdAt" },
                },
                orders: { $sum: 1 },
                value: { $sum: "$totalAmount" },
              },
            },
            { $sort: { _id: 1 } },
          ],
        },
      },
    ]);

    const overall = result?.overall?.[0] ?? emptyOverall;
    const sales = result?.sales?.[0] ?? { orders: 0, value: 0 };

    return res.status(200).json({
      success: true,
      restaurant: {
        id: restaurant._id,
        name: restaurant.restaurantName,
      },
      currency: "INR",
      generatedAt: now.toISOString(),
      range: {
        key: rangeKey,
        days,
        from: from ? from.toISOString() : null,
        to: now.toISOString(),
      },
      summary: {
        totalOrders: overall.totalOrders,
        deliveredOrders: overall.deliveredOrders,
        cancelledOrders: overall.cancelledOrders,
        salesOrders: sales.orders,
        salesValue: round2(sales.value),
        averageOrderValue:
          sales.orders > 0 ? round2(sales.value / sales.orders) : 0,
        paidOrders: overall.paidOrders,
        paidValue: round2(overall.paidValue),
        refundedOrders: overall.refundedOrders,
        refundedValue: round2(overall.refundedValue),
      },
      byStatus: (result?.byStatus ?? []).map(
        (row: { _id: string; count: number; value: number }) => ({
          status: row._id,
          count: row.count,
          value: round2(row.value),
        }),
      ),
      byPaymentStatus: (result?.byPaymentStatus ?? []).map(
        (row: { _id: string; count: number; value: number }) => ({
          status: row._id,
          count: row.count,
          value: round2(row.value),
        }),
      ),
      topItems: (result?.topItems ?? []).map(
        (row: {
          _id: { menuId: string; name: string };
          quantity: number;
          revenue: number;
        }) => ({
          menuId: row._id.menuId,
          name: row._id.name,
          quantity: row.quantity,
          revenue: round2(row.revenue),
        }),
      ),
      daily: (result?.daily ?? []).map(
        (row: { _id: string; orders: number; value: number }) => ({
          date: row._id,
          orders: row.orders,
          value: round2(row.value),
        }),
      ),
    });
  } catch (error) {
    logger.error({ err: error }, "Restaurant analytics failed");
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
