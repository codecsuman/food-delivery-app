import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import mongoose from "mongoose";
import Stripe from "stripe";
import { Order } from "../models/order.model.js";
import {
  AUTO_CANCEL_AFTER_MS,
  runAutoCancelOrders,
  startAutoCancelJob,
} from "../services/autoCancelOrders.js";

const NOW = new Date("2026-01-15T12:00:00.000Z");

const makeOrder = async (overrides: Record<string, unknown> = {}) =>
  Order.create({
    user: new mongoose.Types.ObjectId(),
    restaurant: new mongoose.Types.ObjectId(),
    deliveryDetails: {
      email: "customer@example.com",
      name: "Test Customer",
      address: "1 Test Street",
      city: "Kolkata",
      state: "West Bengal",
      country: "India",
      pincode: "700001",
    },
    cartItems: [
      {
        menuId: new mongoose.Types.ObjectId().toString(),
        name: "Test Pizza",
        image: "",
        price: 200,
        quantity: 1,
      },
    ],
    subtotal: 200,
    deliveryFee: 50,
    totalAmount: 250,
    status: "confirmed",
    paymentMethod: "cod",
    ...overrides,
  });

const backdate = async (orderId: unknown, ageMs: number) => {
  await Order.collection.updateOne(
    { _id: orderId },
    { $set: { createdAt: new Date(NOW.getTime() - ageMs) } },
  );
};

const HOUR = 60 * 60 * 1000;

describe("Automatic cancellation of stale orders", () => {
  const stripe = new Stripe("sk_test_dummy");
  const refundsCreate = vi.mocked(stripe.refunds.create);

  beforeEach(() => {
    refundsCreate.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("cancels pending/confirmed orders older than two hours", async () => {
    const stalePending = await makeOrder({ status: "pending" });
    const staleConfirmed = await makeOrder({ status: "confirmed" });
    await backdate(stalePending._id, AUTO_CANCEL_AFTER_MS + HOUR);
    await backdate(staleConfirmed._id, AUTO_CANCEL_AFTER_MS + HOUR);

    const results = await runAutoCancelOrders({ now: NOW });

    expect(results).toHaveLength(2);
    expect(results.map((result) => result.orderId).sort()).toEqual(
      [stalePending._id.toString(), staleConfirmed._id.toString()].sort(),
    );

    for (const id of [stalePending._id, staleConfirmed._id]) {
      const order = await Order.findById(id);
      expect(order?.status).toBe("cancelled");
      expect(order?.cancelledBy).toBe("system");
      expect(order?.cancelledAt).toEqual(NOW);
      expect(order?.cancellationReason).toContain("2 hours");
      expect(order?.refundStatus).toBe("not_applicable");
    }
  });

  it("leaves recent orders and orders that started preparing untouched", async () => {
    const recent = await makeOrder({ status: "confirmed" });
    await backdate(recent._id, AUTO_CANCEL_AFTER_MS - 1);

    const preparing = await makeOrder({ status: "preparing" });
    await backdate(preparing._id, AUTO_CANCEL_AFTER_MS * 3);

    const outForDelivery = await makeOrder({ status: "outfordelivery" });
    await backdate(outForDelivery._id, AUTO_CANCEL_AFTER_MS * 3);

    const delivered = await makeOrder({ status: "delivered" });
    await backdate(delivered._id, AUTO_CANCEL_AFTER_MS * 3);

    const alreadyCancelled = await makeOrder({
      status: "cancelled",
      cancellationReason: "Cancelled by customer",
      cancelledAt: new Date(NOW.getTime() - HOUR),
      cancelledBy: "customer",
    });
    await backdate(alreadyCancelled._id, AUTO_CANCEL_AFTER_MS * 3);

    const results = await runAutoCancelOrders({ now: NOW });

    expect(results).toHaveLength(0);
    expect((await Order.findById(recent._id))?.status).toBe("confirmed");
    expect((await Order.findById(preparing._id))?.status).toBe("preparing");
    expect((await Order.findById(outForDelivery._id))?.status).toBe(
      "outfordelivery",
    );
    expect((await Order.findById(delivered._id))?.status).toBe("delivered");
    expect((await Order.findById(alreadyCancelled._id))?.status).toBe(
      "cancelled",
    );
  });

  it("is idempotent across restarts and overlapping runs", async () => {
    const order = await makeOrder({ status: "confirmed" });
    await backdate(order._id, AUTO_CANCEL_AFTER_MS + HOUR);

    const onCancelled = vi.fn();
    const first = await runAutoCancelOrders({ now: NOW, onCancelled });
    expect(first).toHaveLength(1);

    const afterFirst = await Order.findById(order._id);
    const cancelledAt = afterFirst?.cancelledAt;

    // A restart immediately after the first pass must not cancel or notify
    // the same order again.
    const second = await runAutoCancelOrders({
      now: new Date(NOW.getTime() + 5 * 60 * 1000),
      onCancelled,
    });

    expect(second).toHaveLength(0);
    expect(onCancelled).toHaveBeenCalledTimes(1);
    const afterSecond = await Order.findById(order._id);
    expect(afterSecond?.status).toBe("cancelled");
    expect(afterSecond?.cancelledAt).toEqual(cancelledAt);
  });

  it("refunds a paid Stripe order exactly once", async () => {
    const order = await makeOrder({
      status: "confirmed",
      paymentMethod: "stripe",
      paymentIntentId: "pi_test_auto_cancel",
    });
    await backdate(order._id, AUTO_CANCEL_AFTER_MS + HOUR);

    await runAutoCancelOrders({ now: NOW });
    await runAutoCancelOrders({ now: new Date(NOW.getTime() + 60_000) });

    expect(refundsCreate).toHaveBeenCalledTimes(1);
    expect(refundsCreate).toHaveBeenCalledWith(
      expect.objectContaining({ payment_intent: "pi_test_auto_cancel" }),
      { idempotencyKey: `order_cancel_refund_${order._id.toString()}` },
    );

    const cancelled = await Order.findById(order._id);
    expect(cancelled?.status).toBe("cancelled");
    expect(cancelled?.refundStatus).toBe("refunded");
    expect(cancelled?.refundId).toBe("re_test_123");
  });

  it("runs immediately on startup so a restart catches overdue orders", async () => {
    const overdue = await makeOrder({ status: "confirmed" });
    await backdate(overdue._id, AUTO_CANCEL_AFTER_MS + HOUR);

    const stop = startAutoCancelJob();
    try {
      await vi.waitFor(
        async () => {
          expect((await Order.findById(overdue._id))?.status).toBe("cancelled");
        },
        { timeout: 3000, interval: 50 },
      );
    } finally {
      stop();
    }
  });
});
