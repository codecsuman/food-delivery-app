import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model.js";
import { Restaurant } from "../models/restaurant.model.js";
import { Menu } from "../models/menu.model.js";
import { Order } from "../models/order.model.js";
import { WebhookEvent } from "../models/webhookEvent.model.js";
import { stripeWebhook } from "../controller/order.controller.js";
import {
  claimWebhookEvent,
  completeWebhookEvent,
  failWebhookEvent,
} from "../services/webhookEvents.js";

const createTestApp = () => {
  const app = express();
  app.post(
    "/api/v1/order/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhook,
  );
  return app;
};

describe("Durable Stripe webhook idempotency", () => {
  let app: express.Express;
  let order: any;
  let menu: any;

  beforeEach(async () => {
    app = createTestApp();
    // Make sure the unique eventId index exists before the concurrency test.
    await WebhookEvent.init();

    const password = await bcrypt.hash("password123", 10);
    const customer = await User.create({
      fullname: "Webhook Customer",
      email: "webhook-customer@example.com",
      password,
      isVerified: true,
    });
    const owner = await User.create({
      fullname: "Webhook Owner",
      email: "webhook-owner@example.com",
      password,
      isVerified: true,
    });

    const restaurant = await Restaurant.create({
      user: owner._id,
      restaurantName: "Webhook Kitchen",
      address: "1 Webhook Road",
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
      name: "Webhook Thali",
      description: "A complete test meal",
      price: 200,
      image: "https://test.com/thali.jpg",
      restaurant: restaurant._id,
    });

    restaurant.menus.push(menu._id);
    await restaurant.save();

    order = await Order.create({
      user: customer._id,
      restaurant: restaurant._id,
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
      cartItems: [
        {
          menuId: menu._id.toString(),
          name: menu.name,
          image: menu.image,
          price: menu.price,
          quantity: 1,
        },
      ],
      subtotal: 200,
      deliveryFee: 50,
      totalAmount: 250,
      status: "pending",
      paymentMethod: "stripe",
      paymentIntentId: "cs_test_webhook",
    });
  });

  const paidEvent = (eventId = "evt_durable_paid_001", orderId = order?._id) => ({
    id: eventId,
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_test_webhook",
        metadata: { orderId: orderId?.toString?.() ?? orderId },
        amount_total: 25000,
        payment_intent: "pi_webhook_paid",
        payment_status: "paid",
      },
    },
  });

  it("increments menu analytics only once when Stripe redelivers an event", async () => {
    const event = paidEvent();

    const first = await request(app)
      .post("/api/v1/order/webhook")
      .set("stripe-signature", "valid-signature")
      .send(event);
    const second = await request(app)
      .post("/api/v1/order/webhook")
      .set("stripe-signature", "valid-signature")
      .send(event);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    expect((await Order.findById(order._id))!.status).toBe("confirmed");
    expect((await Menu.findById(menu._id))!.orderCount).toBe(1);

    const records = await WebhookEvent.find({ eventId: "evt_durable_paid_001" });
    expect(records).toHaveLength(1);
    expect(records[0].status).toBe("processed");
  });

  it("keeps the dedupe record in MongoDB, not process memory", async () => {
    await request(app)
      .post("/api/v1/order/webhook")
      .set("stripe-signature", "valid-signature")
      .send(paidEvent("evt_persisted_001"));

    // A fresh claim for the same id must be rejected purely from database
    // state (this is what survives a deploy/restart or a second instance).
    const claim = await claimWebhookEvent(
      "evt_persisted_001",
      "checkout.session.completed",
    );

    expect(claim.claimed).toBe(false);
    if (!claim.claimed) expect(claim.reason).toBe("duplicate");
  });

  it("allows a retry after a recorded failure", async () => {
    const eventId = "evt_retry_after_failure_001";

    const firstClaim = await claimWebhookEvent(
      eventId,
      "checkout.session.completed",
    );
    expect(firstClaim.claimed).toBe(true);
    await failWebhookEvent(eventId, new Error("Mongo temporarily unavailable"));

    const storedFailed = await WebhookEvent.findOne({ eventId });
    expect(storedFailed!.status).toBe("failed");
    expect(storedFailed!.lastError).toContain("Mongo temporarily unavailable");

    const retried = await request(app)
      .post("/api/v1/order/webhook")
      .set("stripe-signature", "valid-signature")
      .send(paidEvent(eventId));

    expect(retried.status).toBe(200);
    expect((await Order.findById(order._id))!.status).toBe("confirmed");

    const storedProcessed = await WebhookEvent.findOne({ eventId });
    expect(storedProcessed!.status).toBe("processed");
    expect(storedProcessed!.attempts).toBeGreaterThanOrEqual(2);
  });

  it("lets exactly one concurrent delivery claim the same event", async () => {
    const claims = await Promise.all(
      Array.from({ length: 5 }, () =>
        claimWebhookEvent("evt_concurrent_001", "checkout.session.completed"),
      ),
    );

    expect(claims.filter((claim) => claim.claimed)).toHaveLength(1);
    expect(claims.filter((claim) => !claim.claimed)).toHaveLength(4);

    const records = await WebhookEvent.find({ eventId: "evt_concurrent_001" });
    expect(records).toHaveLength(1);
  });

  it("does not confirm or count analytics for an unpaid session", async () => {
    const event = paidEvent("evt_unpaid_durable_001");
    (event.data.object as any).payment_status = "unpaid";

    const res = await request(app)
      .post("/api/v1/order/webhook")
      .set("stripe-signature", "valid-signature")
      .send(event);

    expect(res.status).toBe(200);
    expect((await Order.findById(order._id))!.status).toBe("pending");
    expect((await Menu.findById(menu._id))!.orderCount).toBe(0);

    // Unpaid deliveries are acknowledged and remembered so they are not
    // processed on every redelivery.
    const record = await WebhookEvent.findOne({ eventId: "evt_unpaid_durable_001" });
    expect(record!.status).toBe("processed");
  });

  it("marks an event processed after a successful handler run", async () => {
    await claimWebhookEvent("evt_complete_001", "payment_intent.succeeded");
    await completeWebhookEvent("evt_complete_001", "order-123");

    const record = await WebhookEvent.findOne({ eventId: "evt_complete_001" }).lean();
    expect(record!.status).toBe("processed");
    expect(record!.orderId).toBe("order-123");
    expect(record!.processedAt).toBeInstanceOf(Date);
  });

  it("stores no Stripe payload data, only identifiers and status", async () => {
    await request(app)
      .post("/api/v1/order/webhook")
      .set("stripe-signature", "valid-signature")
      .send(paidEvent("evt_no_payload_001"));

    const record = await WebhookEvent.findOne({
      eventId: "evt_no_payload_001",
    }).lean();

    const serialized = JSON.stringify(record);
    expect(serialized).not.toContain("4242");
    expect(serialized).not.toContain("pi_webhook_paid");
    expect(Object.keys(record!)).not.toContain("payload");
  });

  it("rejects an invalid signature without storing an event", async () => {
    const res = await request(app)
      .post("/api/v1/order/webhook")
      .set("stripe-signature", "bad-signature")
      .send(paidEvent("evt_bad_signature_001"));

    expect(res.status).toBe(400);
    expect(await WebhookEvent.countDocuments()).toBe(0);
  });

  it("keeps the order idempotent across two different event ids", async () => {
    await request(app)
      .post("/api/v1/order/webhook")
      .set("stripe-signature", "valid-signature")
      .send(paidEvent("evt_first_001"));

    await request(app)
      .post("/api/v1/order/webhook")
      .set("stripe-signature", "valid-signature")
      .send(paidEvent("evt_second_002"));

    expect((await Menu.findById(menu._id))!.orderCount).toBe(1);
    expect(
      await WebhookEvent.countDocuments({
        eventId: { $in: ["evt_first_001", "evt_second_002"] },
      }),
    ).toBe(2);
  });

  it("does not leave a claim behind when the payload has no order id", async () => {
    const event = {
      id: "evt_missing_order_001",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_missing",
          metadata: {},
          amount_total: 25000,
          payment_status: "paid",
        },
      },
    };

    const res = await request(app)
      .post("/api/v1/order/webhook")
      .set("stripe-signature", "valid-signature")
      .send(event);

    expect(res.status).toBe(200);
    const record = await WebhookEvent.findOne({
      eventId: "evt_missing_order_001",
    });
    expect(record!.status).toBe("processed");
  });

  it("never exposes raw webhook errors to the caller", async () => {
    // Force the handler to fail by making the order id invalid for Mongoose.
    const event = {
      id: "evt_handler_failure_001",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_failure",
          metadata: { orderId: "not-an-object-id" },
          amount_total: 25000,
          payment_status: "paid",
        },
      },
    };

    const res = await request(app)
      .post("/api/v1/order/webhook")
      .set("stripe-signature", "valid-signature")
      .send(event);

    expect(res.status).toBe(500);
    expect(res.text).toBe("Webhook processing failed");

    const record = await WebhookEvent.findOne({
      eventId: "evt_handler_failure_001",
    });
    expect(record!.status).toBe("failed");
    expect(record!.lastError).toBeTruthy();
  });
});
