import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import Stripe from "stripe";
import { User } from "../models/user.model.js";
import { Restaurant } from "../models/restaurant.model.js";
import { Menu } from "../models/menu.model.js";
import { Order } from "../models/order.model.js";
import orderRoute from "../routes/order.route.js";
import restaurantRoute from "../routes/restaurant.route.js";
import { stripeWebhook } from "../controller/order.controller.js";
import { derivePaymentStatus } from "../services/orderPayments.js";

const createTestApp = () => {
  const app = express();
  app.post(
    "/api/v1/order/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhook,
  );
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/v1/order", orderRoute);
  app.use("/api/v1/restaurant", restaurantRoute);
  return app;
};

const stripeMock = new (Stripe as any)();

const tokenFor = (user: any) =>
  jwt.sign(
    { userId: user._id.toString(), email: user.email, admin: false },
    process.env.SECRET_KEY!,
    { expiresIn: "7d" },
  );

describe("Payment status and audit trail", () => {
  let app: express.Express;
  let owner: any;
  let customer: any;
  let restaurant: any;
  let menu: any;
  let ownerToken: string;
  let customerToken: string;

  beforeEach(async () => {
    app = createTestApp();
    vi.mocked(stripeMock.refunds.create).mockClear();
    vi.mocked(stripeMock.checkout.sessions.create).mockClear();
    vi.mocked(stripeMock.checkout.sessions.retrieve).mockClear();

    const password = await bcrypt.hash("password123", 10);

    owner = await User.create({
      fullname: "Payment Owner",
      email: "payment-owner@example.com",
      password,
      isVerified: true,
    });
    customer = await User.create({
      fullname: "Payment Customer",
      email: "payment-customer@example.com",
      password,
      isVerified: true,
    });

    restaurant = await Restaurant.create({
      user: owner._id,
      restaurantName: "Payment Kitchen",
      address: "7 Payment Road",
      city: "Kolkata",
      state: "West Bengal",
      country: "India",
      pincode: "700001",
      contact: 9876543210,
      deliveryTime: 30,
      deliveryPrice: 50,
      cuisines: ["Indian"],
      imageUrl: "https://test.com/restaurant.jpg",
      location: { type: "Point", coordinates: [88.3639, 22.5726] },
    });

    menu = await Menu.create({
      name: "Payment Thali",
      description: "A complete test meal",
      price: 200,
      image: "https://test.com/thali.jpg",
      restaurant: restaurant._id,
    });
    restaurant.menus.push(menu._id);
    await restaurant.save();

    ownerToken = tokenFor(owner);
    customerToken = tokenFor(customer);
  });

  const checkoutPayload = (overrides: Record<string, unknown> = {}) => ({
    cartItems: [
      {
        menuId: menu._id.toString(),
        name: menu.name,
        image: menu.image,
        price: menu.price,
        quantity: 1,
      },
    ],
    deliveryDetails: {
      name: customer.fullname,
      email: customer.email,
      address: "12 Customer Street",
      city: "Kolkata",
      state: "West Bengal",
      country: "India",
      pincode: "700001",
      lat: 22.5726,
      lng: 88.3639,
    },
    restaurantId: restaurant._id.toString(),
    paymentMethod: "cod",
    ...overrides,
  });

  const placeOrder = async (overrides: Record<string, unknown> = {}) => {
    const res = await request(app)
      .post("/api/v1/order/checkout/create-checkout-session")
      .set("Cookie", [`token=${customerToken}`])
      .send(checkoutPayload(overrides));
    expect(res.status).toBe(200);
    return res;
  };

  const eventFor = (order: any, overrides: Record<string, unknown> = {}) => ({
    id: `evt_${Math.random().toString(36).slice(2)}`,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_payment",
        metadata: { orderId: order._id.toString() },
        amount_total: Math.round(order.totalAmount * 100),
        payment_intent: "pi_payment_test",
        payment_status: "paid",
        ...overrides,
      },
    },
  });

  it("records COD orders as unpaid with an audit entry", async () => {
    const res = await placeOrder({ idempotencyKey: "payment-cod-001" });
    const order = await Order.findById(res.body.order._id);

    expect(order!.paymentStatus).toBe("unpaid");
    expect(order!.paymentEvents).toHaveLength(1);
    expect(order!.paymentEvents![0].type).toBe("cod_order_confirmed");
    expect(order!.paymentEvents![0].status).toBe("unpaid");
  });

  it("records Stripe orders as unpaid until the payment is captured", async () => {
    const res = await placeOrder({
      paymentMethod: "stripe",
      idempotencyKey: "payment-stripe-001",
    });
    const order = await Order.findById(res.body.orderId);

    expect(order!.status).toBe("pending");
    expect(order!.paymentStatus).toBe("unpaid");
    expect(order!.paymentEvents![0].type).toBe("payment_initiated");
  });

  it("moves a Stripe order to paid and appends an audit entry", async () => {
    const res = await placeOrder({
      paymentMethod: "stripe",
      idempotencyKey: "payment-stripe-002",
    });
    const order = await Order.findById(res.body.orderId);

    const webhook = await request(app)
      .post("/api/v1/order/webhook")
      .set("stripe-signature", "valid-signature")
      .send(eventFor(order));

    expect(webhook.status).toBe(200);

    const confirmed = await Order.findById(order!._id);
    expect(confirmed!.status).toBe("confirmed");
    expect(confirmed!.paymentStatus).toBe("paid");
    const types = confirmed!.paymentEvents!.map((e) => e.type);
    expect(types).toContain("payment_initiated");
    expect(types).toContain("payment_succeeded");
  });

  it("moves a Stripe order to failed when the payment fails", async () => {
    const res = await placeOrder({
      paymentMethod: "stripe",
      idempotencyKey: "payment-stripe-003",
    });
    const order = await Order.findById(res.body.orderId);

    await request(app)
      .post("/api/v1/order/webhook")
      .set("stripe-signature", "valid-signature")
      .send({
        id: "evt_payment_failed_001",
        type: "payment_intent.payment_failed",
        data: {
          object: {
            id: "pi_payment_failed",
            metadata: { orderId: order!._id.toString() },
            last_payment_error: { message: "Card declined" },
          },
        },
      });

    const failed = await Order.findById(order!._id);
    expect(failed!.status).toBe("payment_failed");
    expect(failed!.paymentStatus).toBe("failed");
    expect(failed!.paymentEvents!.map((e) => e.type)).toContain("payment_failed");
  });

  it("moves an unconfirmed Stripe order to unpaid when the session expires", async () => {
    const res = await placeOrder({
      paymentMethod: "stripe",
      idempotencyKey: "payment-stripe-004",
    });
    const order = await Order.findById(res.body.orderId);

    await request(app)
      .post("/api/v1/order/webhook")
      .set("stripe-signature", "valid-signature")
      .send({
        id: "evt_expired_001",
        type: "checkout.session.expired",
        data: {
          object: {
            id: "cs_test_expired",
            metadata: { orderId: order!._id.toString() },
          },
        },
      });

    const expired = await Order.findById(order!._id);
    expect(expired!.status).toBe("cancelled");
    expect(expired!.paymentStatus).toBe("unpaid");
    expect(expired!.paymentEvents!.map((e) => e.type)).toContain(
      "checkout_expired",
    );
  });

  it("refunds a paid cancellation and keeps the money trail", async () => {
    const order = await Order.create({
      user: customer._id,
      restaurant: restaurant._id,
      deliveryDetails: {
        name: customer.fullname,
        email: customer.email,
        address: "12 Customer Street",
        city: "Kolkata",
        pincode: "700001",
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
      status: "confirmed",
      paymentMethod: "stripe",
      paymentIntentId: "pi_paid_cancel",
      paymentStatus: "paid",
    });

    const res = await request(app)
      .post(`/api/v1/order/${order._id}/cancel`)
      .set("Cookie", [`token=${customerToken}`]);

    expect(res.status).toBe(200);
    const stored = await Order.findById(order._id);
    expect(stored!.status).toBe("cancelled");
    expect(stored!.refundStatus).toBe("refunded");
    expect(stored!.paymentStatus).toBe("refunded");

    const types = stored!.paymentEvents!.map((e) => e.type);
    expect(types).toContain("refund_requested");
    expect(types).toContain("refund_succeeded");
  });

  it("marks a cancelled COD order as not_required instead of refunded", async () => {
    const res = await placeOrder({ idempotencyKey: "payment-cod-cancel-001" });
    const orderId = res.body.order._id;

    const cancelled = await request(app)
      .post(`/api/v1/order/${orderId}/cancel`)
      .set("Cookie", [`token=${customerToken}`]);

    expect(cancelled.status).toBe(200);
    const stored = await Order.findById(orderId);
    expect(stored!.paymentStatus).toBe("not_required");
    expect(stored!.refundStatus).toBe("not_applicable");
    expect(stored!.paymentEvents!.map((e) => e.type)).toContain("cancellation");
  });

  it("collects COD cash only when the owner marks the order delivered", async () => {
    const res = await placeOrder({ idempotencyKey: "payment-cod-deliver-001" });
    const orderId = res.body.order._id;

    for (const status of ["preparing", "outfordelivery"]) {
      const update = await request(app)
        .put(`/api/v1/restaurant/order/${orderId}/status`)
        .set("Cookie", [`token=${ownerToken}`])
        .send({ status });
      expect(update.status).toBe(200);
      expect((await Order.findById(orderId))!.paymentStatus).toBe("unpaid");
    }

    const delivered = await request(app)
      .put(`/api/v1/restaurant/order/${orderId}/status`)
      .set("Cookie", [`token=${ownerToken}`])
      .send({ status: "delivered" });

    expect(delivered.status).toBe(200);
    const stored = await Order.findById(orderId);
    expect(stored!.paymentStatus).toBe("paid");
    expect(stored!.paymentEvents!.map((e) => e.type)).toContain("cod_collected");
  });

  it("keeps fulfilment status and money state independent", async () => {
    const res = await placeOrder({ idempotencyKey: "payment-cod-independent-001" });
    const order = await Order.findById(res.body.order._id);

    expect(order!.status).toBe("confirmed");
    expect(order!.paymentStatus).toBe("unpaid");

    // A cancelled unpaid order is not "refunded"; it simply requires no money.
    await Order.updateOne(
      { _id: order!._id },
      { $set: { status: "cancelled", paymentStatus: "not_required" } },
    );
    const stored = await Order.findById(order!._id);
    expect(stored!.status).toBe("cancelled");
    expect(stored!.paymentStatus).toBe("not_required");
  });

  describe("derivePaymentStatus (migration helper)", () => {
    it("maps Stripe fulfilment states", () => {
      expect(derivePaymentStatus({ status: "pending" })).toBe("unpaid");
      expect(derivePaymentStatus({ status: "confirmed" })).toBe("paid");
      expect(derivePaymentStatus({ status: "outfordelivery" })).toBe("paid");
      expect(derivePaymentStatus({ status: "delivered" })).toBe("paid");
      expect(derivePaymentStatus({ status: "payment_failed" })).toBe("failed");
      expect(
        derivePaymentStatus({ status: "cancelled", refundStatus: "pending" }),
      ).toBe("pending");
      expect(
        derivePaymentStatus({ status: "cancelled", refundStatus: "refunded" }),
      ).toBe("refunded");
      expect(
        derivePaymentStatus({ status: "cancelled", refundStatus: "failed" }),
      ).toBe("paid");
    });

    it("maps COD states", () => {
      expect(derivePaymentStatus({ status: "confirmed", paymentMethod: "cod" })).toBe(
        "unpaid",
      );
      expect(derivePaymentStatus({ status: "delivered", paymentMethod: "cod" })).toBe(
        "paid",
      );
      expect(derivePaymentStatus({ status: "cancelled", paymentMethod: "cod" })).toBe(
        "not_required",
      );
    });

    it("never overwrites an existing value", () => {
      expect(
        derivePaymentStatus({ status: "cancelled", paymentStatus: "refunded" }),
      ).toBe("refunded");
    });
  });
});
