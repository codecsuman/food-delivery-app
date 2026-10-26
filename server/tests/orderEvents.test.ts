import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  emitNewOrder,
  emitOrderStatus,
  setSocketServer,
} from "../socketHandlers/orderEvents.js";

const makeServer = () => {
  const emit = vi.fn();
  const to = vi.fn(() => ({ emit }));
  setSocketServer({ to } as any);
  return { emit, to };
};

describe("order event fan-out", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends a status change to both the order and restaurant rooms", () => {
    const { emit, to } = makeServer();

    emitOrderStatus({
      orderId: "order-1",
      restaurantId: "restaurant-1",
      status: "preparing",
    });

    expect(to).toHaveBeenCalledWith("order:order-1");
    expect(to).toHaveBeenCalledWith("restaurant:restaurant-1");
    expect(emit).toHaveBeenCalledTimes(2);
    expect(emit).toHaveBeenCalledWith(
      "order:status",
      expect.objectContaining({
        orderId: "order-1",
        restaurantId: "restaurant-1",
        status: "preparing",
      }),
    );
  });

  it("announces a new order only to the restaurant dashboard", () => {
    const { emit, to } = makeServer();

    emitNewOrder({
      orderId: "order-2",
      restaurantId: "restaurant-2",
      status: "confirmed",
      totalAmount: 499,
    });

    expect(to).toHaveBeenCalledTimes(1);
    expect(to).toHaveBeenCalledWith("restaurant:restaurant-2");
    expect(emit).toHaveBeenCalledWith(
      "order:new",
      expect.objectContaining({ orderId: "order-2", status: "confirmed" }),
    );
  });

  it("includes cancellation details so both views can update the badge", () => {
    const { emit } = makeServer();
    const cancelledAt = new Date("2026-10-27T10:00:00.000Z");

    emitOrderStatus({
      orderId: "order-3",
      restaurantId: "restaurant-3",
      status: "cancelled",
      cancellationReason: "Cancelled by restaurant",
      cancelledAt,
      cancelledBy: "restaurant",
      refundStatus: "pending",
    });

    expect(emit).toHaveBeenCalledWith(
      "order:status",
      expect.objectContaining({
        orderId: "order-3",
        status: "cancelled",
        cancellationReason: "Cancelled by restaurant",
        cancelledAt,
        cancelledBy: "restaurant",
        refundStatus: "pending",
      }),
    );
  });
});
