import { describe, it, expect, beforeEach, vi } from "vitest";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import { User } from "../models/user.model.js";
import { Restaurant } from "../models/restaurant.model.js";
import { Menu } from "../models/menu.model.js";
import { Order } from "../models/order.model.js";
import {
  AUTO_CANCEL_AFTER_HOURS,
  runAutoCancelOrders,
} from "../services/autoCancelOrders.js";

const stripeMock = new (Stripe as any)();

describe("Auto-cancellation of orders awaiting preparation", () => {
  let owner: any;
  let restaurant: any;
  let menu: any;

  beforeEach(async () => {
    vi.mocked(stripeMock.refunds.create).mockClear();
    vi.mocked(stripeMock.checkout.sessions.retrieve).mockClear();

    owner = await User.create({
      fullname: "Auto Cancel Owner",
      email: "autocancel-owner@example.com",
      password: await bcrypt.hash("password123", 10),
      isVerified: true,
    });

    restaurant = await Restaurant.create({
      user: owner._id,
      restaurantName: "Auto Cancel Kitchen",
      address: "1 Timeout Road",
      city: "Kolkata",
      state: "West Bengal",
      country: "India",
      pincode: "700001",
      contact: 9876543210,
      deliveryTime: 30,
      deliveryPrice: 50,
      cuisines: ["Indian"],
      imageUrl: "https://test.com/auto.jpg",
      location: { type: "Point", coordinates: [88.3639, 22.5726] },
    });

    menu = await Menu.create({
      name: "Auto Cancel Meal",
      description: "Meal for timeout tests",
      price: 200,
      image: "https://test.com/meal.jpg",
      restaurant: restaurant._id,
    });
  });

  const createOrder = async (
    overrides: Record<string, unknown> = {},
    ageMs = 3 * 60 * 60 * 1000,
  ) => {
    const order = await Order.create({
      user: owner._id,
      restaurant: restaurant._id,
      deliveryDetails: {
        name: "Customer",
        email: "customer@example.com",
        address: "12 Test Street",
        city: "Kolkata",
        state: "West Bengal",
        country: "India",
        pincode: "700001",
        lat: 22.5726,
        lng: 88.3639,
      },
      cartItems: [
        {
          menuId: menu._id.toString(),
          name: menu.name,
          image: menu.image,
          price: 200,
          quantity: 1,
        },
      ],
      subtotal: 200,
      deliveryFee: 50,
      totalAmount: 250,
      status: "pending",
      paymentMethod: "cod",
      ...overrides,
    });

    // `createdAt` is managed by timestamps; write the controlled age directly.
    const createdAt = new Date(Date.now() - ageMs);
    await Order.collection.updateOne(
      { _id: order._id },
      { $set: { createdAt } },
    );
    order.createdAt = createdAt;
    return order;
  };

  it("cancels a stale pending order with a reason, timestamp and refund", async () => {
    const order = await createOrder({
      paymentMethod: "stripe",
      paymentIntentId: "pi_paid_auto_test",
    });
    const now = new Date();

    const results = await runAutoCancelOrders({ now });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      orderId: order._id.toString(),
      previousStatus: "pending",
      refundStatus: "refunded",
      refundId: "re_test_123",
    });

    const cancelled = await Order.findById(order._id);
    expect(cancelled!.status).toBe("cancelled");
    expect(cancelled!.cancelledBy).toBe("system");
    expect(cancelled!.cancelledAt).toBeTruthy();
    expect(cancelled!.cancellationReason).toContain(
      `${AUTO_CANCEL_AFTER_HOURS} hour`,
    );
    expect(cancelled!.refundStatus).toBe("refunded");
    expect(cancelled!.refundId).toBe("re_test_123");
    expect(stripeMock.refunds.create).toHaveBeenCalledTimes(1);
    expect(stripeMock.refunds.create).toHaveBeenCalledWith(
      { payment_intent: "pi_paid_auto_test", reason: "requested_by_customer" },
      { idempotencyKey: `order_cancel_refund_${order._id.toString()}` },
    );

    // Restart/overlapping tick: nothing left to cancel and no second refund.
    const rerun = await runAutoCancelOrders({ now });
    expect(rerun).toHaveLength(0);
    expect(stripeMock.refunds.create).toHaveBeenCalledTimes(1);
  });

  it("cancels a stale confirmed COD order without attempting a refund", async () => {
    const order = await createOrder({ status: "confirmed" });

    const results = await runAutoCancelOrders({ now: new Date() });

    expect(results).toEqual([
      expect.objectContaining({
        orderId: order._id.toString(),
        previousStatus: "confirmed",
        refundStatus: "not_applicable",
      }),
    ]);

    const cancelled = await Order.findById(order._id);
    expect(cancelled!.status).toBe("cancelled");
    expect(cancelled!.refundStatus).toBe("not_applicable");
    expect(stripeMock.refunds.create).not.toHaveBeenCalled();
  });

  it("leaves preparing, out-for-delivery and recent orders untouched", async () => {
    const preparing = await createOrder({ status: "preparing" });
    const outForDelivery = await createOrder({ status: "outfordelivery" });
    const recent = await createOrder({}, 60 * 60 * 1000);

    const results = await runAutoCancelOrders({ now: new Date() });
    expect(results).toEqual([]);

    expect((await Order.findById(preparing._id))!.status).toBe("preparing");
    expect((await Order.findById(outForDelivery._id))!.status).toBe(
      "outfordelivery",
    );
    expect((await Order.findById(recent._id))!.status).toBe("pending");
  });

  it("does not refund an unpaid abandoned Stripe session", async () => {
    const order = await createOrder({
      paymentMethod: "stripe",
      paymentIntentId: "cs_test_unpaid_auto",
    });

    vi.mocked(stripeMock.checkout.sessions.retrieve).mockResolvedValueOnce({
      id: "cs_test_unpaid_auto",
      payment_status: "unpaid",
      payment_intent: null,
      metadata: { orderId: order._id.toString() },
    } as any);

    const results = await runAutoCancelOrders({ now: new Date() });

    expect(results).toEqual([
      expect.objectContaining({
        orderId: order._id.toString(),
        refundStatus: "not_applicable",
      }),
    ]);
    expect(stripeMock.refunds.create).not.toHaveBeenCalled();

    const cancelled = await Order.findById(order._id);
    expect(cancelled!.status).toBe("cancelled");
    expect(cancelled!.refundStatus).toBe("not_applicable");
  });

  it("allows exactly one worker to win and refunds once", async () => {
    const order = await createOrder({
      paymentMethod: "stripe",
      paymentIntentId: "pi_paid_auto_race",
    });
    const now = new Date();

    const [first, second] = await Promise.all([
      runAutoCancelOrders({ now }),
      runAutoCancelOrders({ now }),
    ]);

    expect([...first, ...second]).toHaveLength(1);
    expect(stripeMock.refunds.create).toHaveBeenCalledTimes(1);
    expect((await Order.findById(order._id))!.refundStatus).toBe("refunded");
  });

  it("respects the controlled cutoff for orders exactly at the boundary", async () => {
    const justOver = await createOrder(
      {},
      AUTO_CANCEL_AFTER_HOURS * 60 * 60 * 1000 + 1000,
    );
    const justUnder = await createOrder(
      {},
      AUTO_CANCEL_AFTER_HOURS * 60 * 60 * 1000 - 1000,
    );

    const results = await runAutoCancelOrders({ now: new Date() });

    expect(results.map((result) => result.orderId)).toEqual([
      justOver._id.toString(),
    ]);
    expect((await Order.findById(justOver._id))!.status).toBe("cancelled");
    expect((await Order.findById(justUnder._id))!.status).toBe("pending");
  });
});
