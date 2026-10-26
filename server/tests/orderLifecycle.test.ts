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

const createTestApp = () => {
  const app = express();
  app.use(cookieParser());
  app.post(
    "/api/v1/order/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhook,
  );
  app.use(express.json());
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

describe("Order lifecycle integrity", () => {
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
      fullname: "Restaurant Owner",
      email: "owner@example.com",
      password,
      isVerified: true,
    });

    customer = await User.create({
      fullname: "Ordering Customer",
      email: "customer@example.com",
      password,
      isVerified: true,
    });

    restaurant = await Restaurant.create({
      user: owner._id,
      restaurantName: "Lifecycle Kitchen",
      address: "45 Restaurant Road",
      city: "Kolkata",
      state: "West Bengal",
      country: "India",
      pincode: "700001",
      contact: 9876543210,
      alternateContact: 9123456780,
      deliveryTime: 30,
      deliveryPrice: 50,
      cuisines: ["Indian"],
      imageUrl: "https://test.com/restaurant.jpg",
      location: { type: "Point", coordinates: [88.3639, 22.5726] },
    });

    menu = await Menu.create({
      name: "Lifecycle Thali",
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

  const createOrder = async (overrides: Record<string, unknown> = {}) =>
    Order.create({
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
          price: 200,
          quantity: 1,
        },
      ],
      subtotal: 200,
      deliveryBaseFee: 50,
      deliveryExtraFee: 0,
      deliveryFee: 50,
      totalAmount: 250,
      status: "confirmed",
      paymentMethod: "cod",
      ...overrides,
    });

  it("returns the same COD order for a repeated idempotency key", async () => {
    const payload = checkoutPayload({ idempotencyKey: "checkout-retry-0001" });

    const first = await request(app)
      .post("/api/v1/order/checkout/create-checkout-session")
      .set("Cookie", [`token=${customerToken}`])
      .send(payload);

    const second = await request(app)
      .post("/api/v1/order/checkout/create-checkout-session")
      .set("Cookie", [`token=${customerToken}`])
      .send(payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.idempotentReplay).toBe(true);
    expect(second.body.order._id).toBe(first.body.order._id);
    expect(second.body.order.totalAmount).toBe(250);
    expect(await Order.countDocuments({ user: customer._id })).toBe(1);
    expect((await Menu.findById(menu._id))!.orderCount).toBe(1);
  });

  it("resumes the original Stripe session without creating a second order", async () => {
    const payload = checkoutPayload({
      paymentMethod: "stripe",
      idempotencyKey: "checkout-retry-0002",
    });

    const first = await request(app)
      .post("/api/v1/order/checkout/create-checkout-session")
      .set("Cookie", [`token=${customerToken}`])
      .send(payload);

    const second = await request(app)
      .post("/api/v1/order/checkout/create-checkout-session")
      .set("Cookie", [`token=${customerToken}`])
      .send(payload);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.body.idempotentReplay).toBe(true);
    expect(second.body.orderId).toBe(first.body.orderId);
    expect(second.body.session?.url).toContain("checkout.stripe.com");
    expect(await Order.countDocuments({ user: customer._id })).toBe(1);
  });

  it("deletes the persisted order when Stripe session creation fails", async () => {
    vi.mocked(stripeMock.checkout.sessions.create).mockRejectedValueOnce(
      new Error("Stripe unavailable"),
    );

    const res = await request(app)
      .post("/api/v1/order/checkout/create-checkout-session")
      .set("Cookie", [`token=${customerToken}`])
      .send(
        checkoutPayload({
          paymentMethod: "stripe",
          idempotencyKey: "checkout-stripe-failure-01",
        }),
      );

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(await Order.countDocuments({ user: customer._id })).toBe(0);
  });

  it("freezes the delivery address and coordinates on the order", async () => {
    const res = await request(app)
      .post("/api/v1/order/checkout/create-checkout-session")
      .set("Cookie", [`token=${customerToken}`])
      .send(checkoutPayload({ idempotencyKey: "checkout-snapshot-0001" }));

    expect(res.status).toBe(200);
    const orderId = res.body.order._id;

    await User.findByIdAndUpdate(customer._id, {
      address: "99 Somewhere Else",
      city: "Delhi",
      state: "Delhi",
      pincode: "110001",
      latitude: 28.6139,
      longitude: 77.209,
    });

    const fetched = await request(app)
      .get(`/api/v1/order/${orderId}`)
      .set("Cookie", [`token=${customerToken}`]);

    expect(fetched.status).toBe(200);
    expect(fetched.body.order.deliveryDetails).toMatchObject({
      name: customer.fullname,
      address: "12 Customer Street",
      city: "Kolkata",
      state: "West Bengal",
      country: "India",
      pincode: "700001",
      lat: 22.5726,
      lng: 88.3639,
    });
  });

  it("does not confirm an order until Stripe reports a captured payment", async () => {
    const order = await createOrder({
      status: "pending",
      paymentMethod: "stripe",
      paymentIntentId: "pi_pending_test",
    });

    const unpaidEvent = {
      id: "evt_unpaid_001",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_unpaid",
          metadata: { orderId: order._id.toString() },
          amount_total: 25000,
          payment_intent: "pi_pending_test",
          payment_status: "unpaid",
        },
      },
    };

    const unpaid = await request(app)
      .post("/api/v1/order/webhook")
      .set("stripe-signature", "valid-signature")
      .send(unpaidEvent);

    expect(unpaid.status).toBe(200);
    expect((await Order.findById(order._id))!.status).toBe("pending");
    expect((await Menu.findById(menu._id))!.orderCount).toBe(0);

    const paidEvent = {
      id: "evt_paid_001",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_paid",
          metadata: { orderId: order._id.toString() },
          amount_total: 25000,
          payment_intent: "pi_paid_test",
          payment_status: "paid",
        },
      },
    };

    const paid = await request(app)
      .post("/api/v1/order/webhook")
      .set("stripe-signature", "valid-signature")
      .send(paidEvent);

    expect(paid.status).toBe(200);
    const confirmed = await Order.findById(order._id);
    expect(confirmed!.status).toBe("confirmed");
    expect(confirmed!.paymentIntentId).toBe("pi_paid_test");
    expect((await Menu.findById(menu._id))!.orderCount).toBe(1);
  });

  it("exposes the primary phone to customers but keeps the alternate private", async () => {
    const order = await createOrder();

    const asCustomer = await request(app)
      .get(`/api/v1/order/${order._id}`)
      .set("Cookie", [`token=${customerToken}`]);

    expect(asCustomer.status).toBe(200);
    expect(asCustomer.body.order.restaurant.contact).toBe(9876543210);
    expect(asCustomer.body.order.restaurant.alternateContact).toBeUndefined();
    expect(asCustomer.body.order.restaurant.address).toBe("45 Restaurant Road");

    const asOwner = await request(app)
      .get(`/api/v1/order/${order._id}`)
      .set("Cookie", [`token=${ownerToken}`]);

    expect(asOwner.status).toBe(200);
    expect(asOwner.body.order.restaurant.contact).toBe(9876543210);
    expect(asOwner.body.order.restaurant.alternateContact).toBe(9123456780);

    const ownerDashboard = await request(app)
      .get("/api/v1/restaurant/order")
      .set("Cookie", [`token=${ownerToken}`]);

    expect(ownerDashboard.status).toBe(200);
    expect(ownerDashboard.body.orders[0].restaurant.alternateContact).toBe(
      9123456780,
    );

    // The public restaurant detail must not leak the private number.
    const publicDetail = await request(app).get(
      `/api/v1/restaurant/${restaurant._id}`,
    );
    expect(publicDetail.status).toBe(200);
    expect(publicDetail.body.restaurant.contact).toBe(9876543210);
    expect(publicDetail.body.restaurant.alternateContact).toBeUndefined();
  });

  it("runs the full COD order workflow and rejects invalid transitions", async () => {
    const checkout = await request(app)
      .post("/api/v1/order/checkout/create-checkout-session")
      .set("Cookie", [`token=${customerToken}`])
      .send(checkoutPayload({ idempotencyKey: "checkout-lifecycle-001" }));

    expect(checkout.status).toBe(200);
    const orderId = checkout.body.order._id;

    for (const status of ["preparing", "outfordelivery", "delivered"]) {
      const update = await request(app)
        .put(`/api/v1/restaurant/order/${orderId}/status`)
        .set("Cookie", [`token=${ownerToken}`])
        .send({ status });

      expect(update.status).toBe(200);
      expect(update.body.status).toBe(status);
    }

    const fetched = await request(app)
      .get(`/api/v1/order/${orderId}`)
      .set("Cookie", [`token=${customerToken}`]);

    expect(fetched.status).toBe(200);
    expect(fetched.body.order.status).toBe("delivered");

    const invalid = await request(app)
      .put(`/api/v1/restaurant/order/${orderId}/status`)
      .set("Cookie", [`token=${ownerToken}`])
      .send({ status: "preparing" });

    expect(invalid.status).toBe(400);
  });

  it("records cancellation metadata once and is not repeatable", async () => {
    const order = await createOrder();

    const first = await request(app)
      .post(`/api/v1/order/${order._id}/cancel`)
      .set("Cookie", [`token=${customerToken}`]);

    expect(first.status).toBe(200);
    expect(first.body.order.status).toBe("cancelled");
    expect(first.body.order.cancellationReason).toBe("Cancelled by customer");
    expect(first.body.order.cancelledBy).toBe("customer");
    expect(first.body.order.cancelledAt).toBeTruthy();
    expect(first.body.order.refundStatus).toBe("not_applicable");

    const second = await request(app)
      .post(`/api/v1/order/${order._id}/cancel`)
      .set("Cookie", [`token=${customerToken}`]);

    expect(second.status).toBe(409);
    expect(second.body.success).toBe(false);
  });

  it("refunds a paid Stripe order exactly once on cancellation", async () => {
    const order = await createOrder({
      paymentMethod: "stripe",
      paymentIntentId: "pi_paid_cancel_test",
    });

    const first = await request(app)
      .post(`/api/v1/order/${order._id}/cancel`)
      .set("Cookie", [`token=${customerToken}`]);

    expect(first.status).toBe(200);
    expect(first.body.order.refundStatus).toBe("refunded");
    expect(first.body.order.refundId).toBe("re_test_123");
    expect(stripeMock.refunds.create).toHaveBeenCalledTimes(1);
    expect(stripeMock.refunds.create).toHaveBeenCalledWith(
      { payment_intent: "pi_paid_cancel_test", reason: "requested_by_customer" },
      { idempotencyKey: `order_cancel_refund_${order._id.toString()}` },
    );

    const second = await request(app)
      .post(`/api/v1/order/${order._id}/cancel`)
      .set("Cookie", [`token=${customerToken}`]);

    expect(second.status).toBe(409);
    expect(stripeMock.refunds.create).toHaveBeenCalledTimes(1);
  });
});
