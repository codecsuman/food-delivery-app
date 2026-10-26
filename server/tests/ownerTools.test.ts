import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Restaurant } from "../models/restaurant.model.js";
import { Menu } from "../models/menu.model.js";
import { Order } from "../models/order.model.js";
import { Issue } from "../models/issue.model.js";
import orderRoute from "../routes/order.route.js";
import restaurantRoute from "../routes/restaurant.route.js";
import issueRoute from "../routes/issue.route.js";

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/v1/order", orderRoute);
  app.use("/api/v1/restaurant", restaurantRoute);
  app.use("/api/v1/issue", issueRoute);
  return app;
};

const tokenFor = (user: any) =>
  jwt.sign(
    { userId: user._id.toString(), email: user.email, admin: false },
    process.env.SECRET_KEY!,
    { expiresIn: "7d" },
  );

describe("Order receipts, issue reporting and owner analytics", () => {
  let app: express.Express;
  let owner: any;
  let otherOwner: any;
  let customer: any;
  let stranger: any;
  let restaurant: any;
  let menu: any;
  let ownerToken: string;
  let otherOwnerToken: string;
  let customerToken: string;
  let strangerToken: string;

  beforeEach(async () => {
    app = createTestApp();
    await Issue.init();

    const password = await bcrypt.hash("password123", 10);

    owner = await User.create({
      fullname: "Tools Owner",
      email: "tools-owner@example.com",
      password,
      isVerified: true,
    });
    otherOwner = await User.create({
      fullname: "Tools Other Owner",
      email: "tools-other-owner@example.com",
      password,
      isVerified: true,
    });
    customer = await User.create({
      fullname: "Tools Customer",
      email: "tools-customer@example.com",
      password,
      isVerified: true,
    });
    stranger = await User.create({
      fullname: "Tools Stranger",
      email: "tools-stranger@example.com",
      password,
      isVerified: true,
    });

    restaurant = await Restaurant.create({
      user: owner._id,
      restaurantName: "Tools Kitchen",
      address: "11 Tools Road",
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
      name: "Tools Thali",
      description: "A dish used by owner tool tests",
      price: 100,
      image: "https://test.com/thali.jpg",
      restaurant: restaurant._id,
    });
    restaurant.menus.push(menu._id);
    await restaurant.save();

    ownerToken = tokenFor(owner);
    otherOwnerToken = tokenFor(otherOwner);
    customerToken = tokenFor(customer);
    strangerToken = tokenFor(stranger);
  });

  const createOrder = (overrides: Record<string, unknown> = {}) =>
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
          price: 100,
          quantity: 2,
        },
      ],
      subtotal: 200,
      deliveryFee: 50,
      totalAmount: 250,
      status: "delivered",
      paymentMethod: "cod",
      paymentStatus: "paid",
      ...overrides,
    });

  describe("Order receipts", () => {
    it("returns a complete receipt to the customer", async () => {
      const order = await createOrder();

      const res = await request(app)
        .get(`/api/v1/order/${order._id}/receipt`)
        .set("Cookie", [`token=${customerToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.receipt).toMatchObject({
        orderId: order._id.toString(),
        status: "delivered",
        currency: "INR",
        totals: { subtotal: 200, deliveryFee: 50, total: 250 },
        payment: { method: "cod", status: "paid" },
      });
      expect(res.body.receipt.receiptNumber).toMatch(
        /^SF-\d{8}-[A-F0-9]{6}$/,
      );
      expect(res.body.receipt.items).toHaveLength(1);
      expect(res.body.receipt.items[0]).toMatchObject({
        name: menu.name,
        quantity: 2,
        unitPrice: 100,
        lineTotal: 200,
      });
      expect(res.body.receipt.customer.email).toBe(customer.email);
    });

    it("does not leak internal payment or idempotency identifiers", async () => {
      const order = await createOrder({
        paymentMethod: "stripe",
        paymentIntentId: "pi_secret_reference",
        idempotencyKey: "secret-idempotency-key",
      });

      const res = await request(app)
        .get(`/api/v1/order/${order._id}/receipt`)
        .set("Cookie", [`token=${customerToken}`]);

      expect(res.status).toBe(200);
      const serialized = JSON.stringify(res.body);
      expect(serialized).not.toContain("pi_secret_reference");
      expect(serialized).not.toContain("secret-idempotency-key");
      expect(serialized).not.toContain("paymentIntentId");
      expect(serialized).not.toContain("idempotencyKey");
    });

    it("lets the restaurant owner print the same receipt", async () => {
      const order = await createOrder();

      const res = await request(app)
        .get(`/api/v1/order/${order._id}/receipt`)
        .set("Cookie", [`token=${ownerToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.receipt.restaurant.id).toBe(restaurant._id.toString());
    });

    it("blocks unrelated users and anonymous requests", async () => {
      const order = await createOrder();

      const strangerRes = await request(app)
        .get(`/api/v1/order/${order._id}/receipt`)
        .set("Cookie", [`token=${strangerToken}`]);
      expect(strangerRes.status).toBe(403);

      const anonymous = await request(app).get(
        `/api/v1/order/${order._id}/receipt`,
      );
      expect(anonymous.status).toBe(401);
    });

    it("returns 404 for an unknown order", async () => {
      const res = await request(app)
        .get("/api/v1/order/507f1f77bcf86cd799439011/receipt")
        .set("Cookie", [`token=${customerToken}`]);

      expect(res.status).toBe(404);
    });
  });

  describe("Issue reporting", () => {
    const issuePayload = (orderId: string, overrides = {}) => ({
      orderId,
      type: "missing_item",
      description: "The dessert was missing from the bag",
      ...overrides,
    });

    it("lets a customer report an issue on their delivered order", async () => {
      const order = await createOrder();

      const res = await request(app)
        .post("/api/v1/issue")
        .set("Cookie", [`token=${customerToken}`])
        .send(issuePayload(order._id.toString()));

      expect(res.status).toBe(201);
      expect(res.body.issue.status).toBe("open");
      expect(res.body.issue.restaurant).toBe(restaurant._id.toString());
      expect(res.body.issue.user).toBe(customer._id.toString());
    });

    it("cannot report an issue for another customer's order", async () => {
      const order = await createOrder();

      const res = await request(app)
        .post("/api/v1/issue")
        .set("Cookie", [`token=${strangerToken}`])
        .send(issuePayload(order._id.toString()));

      expect(res.status).toBe(404);
      expect(await Issue.countDocuments()).toBe(0);
    });

    it("rejects reports for orders that were never accepted", async () => {
      const order = await createOrder({ status: "pending" });

      const res = await request(app)
        .post("/api/v1/issue")
        .set("Cookie", [`token=${customerToken}`])
        .send(issuePayload(order._id.toString()));

      expect(res.status).toBe(400);
    });

    it("rejects invalid issue types and short descriptions", async () => {
      const order = await createOrder();

      const badType = await request(app)
        .post("/api/v1/issue")
        .set("Cookie", [`token=${customerToken}`])
        .send(issuePayload(order._id.toString(), { type: "exploded" }));
      expect(badType.status).toBe(400);

      const short = await request(app)
        .post("/api/v1/issue")
        .set("Cookie", [`token=${customerToken}`])
        .send(issuePayload(order._id.toString(), { description: "cold" }));
      expect(short.status).toBe(400);
    });

    it("blocks duplicate open reports of the same type", async () => {
      const order = await createOrder();
      const payload = issuePayload(order._id.toString());

      await request(app)
        .post("/api/v1/issue")
        .set("Cookie", [`token=${customerToken}`])
        .send(payload);

      const second = await request(app)
        .post("/api/v1/issue")
        .set("Cookie", [`token=${customerToken}`])
        .send(payload);

      expect(second.status).toBe(409);
      expect(await Issue.countDocuments()).toBe(1);
    });

    it("lists only the customer's own issues", async () => {
      const order = await createOrder();
      await Issue.create({
        order: order._id,
        restaurant: restaurant._id,
        user: customer._id,
        type: "late_delivery",
        description: "The order arrived very late",
      });
      await Issue.create({
        order: order._id,
        restaurant: restaurant._id,
        user: stranger._id,
        type: "cold_food",
        description: "The food was cold on arrival",
      });

      const res = await request(app)
        .get("/api/v1/issue/my")
        .set("Cookie", [`token=${customerToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.issues).toHaveLength(1);
      expect(res.body.issues[0].type).toBe("late_delivery");
    });

    it("lets the owner list and filter issues for their restaurant", async () => {
      const order = await createOrder();
      await Issue.create({
        order: order._id,
        restaurant: restaurant._id,
        user: customer._id,
        type: "missing_item",
        description: "The dessert was missing from the bag",
      });
      await Issue.create({
        order: order._id,
        restaurant: restaurant._id,
        user: customer._id,
        type: "cold_food",
        description: "The curry arrived cold",
        status: "resolved",
      });

      const all = await request(app)
        .get(`/api/v1/issue/restaurant/${restaurant._id}`)
        .set("Cookie", [`token=${ownerToken}`]);
      expect(all.status).toBe(200);
      expect(all.body.totalCount).toBe(2);

      const open = await request(app)
        .get(`/api/v1/issue/restaurant/${restaurant._id}?status=open`)
        .set("Cookie", [`token=${ownerToken}`]);
      expect(open.body.issues).toHaveLength(1);
      expect(open.body.issues[0].type).toBe("missing_item");
    });

    it("blocks a different owner from reading the issue queue", async () => {
      const res = await request(app)
        .get(`/api/v1/issue/restaurant/${restaurant._id}`)
        .set("Cookie", [`token=${otherOwnerToken}`]);

      expect(res.status).toBe(404);
    });

    it("moves an issue through review and records resolution", async () => {
      const order = await createOrder();
      const issue = await Issue.create({
        order: order._id,
        restaurant: restaurant._id,
        user: customer._id,
        type: "missing_item",
        description: "The dessert was missing from the bag",
      });

      const reviewing = await request(app)
        .patch(`/api/v1/issue/${issue._id}/status`)
        .set("Cookie", [`token=${ownerToken}`])
        .send({ status: "in_review" });
      expect(reviewing.status).toBe(200);
      expect(reviewing.body.issue.status).toBe("in_review");

      const resolved = await request(app)
        .patch(`/api/v1/issue/${issue._id}/status`)
        .set("Cookie", [`token=${ownerToken}`])
        .send({
          status: "resolved",
          resolutionNote: "Refunded the dessert value to the customer",
        });

      expect(resolved.status).toBe(200);
      expect(resolved.body.issue.status).toBe("resolved");
      expect(resolved.body.issue.resolutionNote).toContain("Refunded");
      expect(resolved.body.issue.resolvedAt).toBeTruthy();
      expect(resolved.body.issue.resolvedBy).toBe(owner._id.toString());
    });

    it("rejects reopening a terminal issue", async () => {
      const order = await createOrder();
      const issue = await Issue.create({
        order: order._id,
        restaurant: restaurant._id,
        user: customer._id,
        type: "missing_item",
        description: "The dessert was missing from the bag",
        status: "resolved",
      });

      const res = await request(app)
        .patch(`/api/v1/issue/${issue._id}/status`)
        .set("Cookie", [`token=${ownerToken}`])
        .send({ status: "in_review" });

      expect(res.status).toBe(409);
    });

    it("blocks strangers and customers from changing issue status", async () => {
      const order = await createOrder();
      const issue = await Issue.create({
        order: order._id,
        restaurant: restaurant._id,
        user: customer._id,
        type: "missing_item",
        description: "The dessert was missing from the bag",
      });

      const strangerRes = await request(app)
        .patch(`/api/v1/issue/${issue._id}/status`)
        .set("Cookie", [`token=${strangerToken}`])
        .send({ status: "resolved" });
      expect(strangerRes.status).toBe(403);

      const customerRes = await request(app)
        .patch(`/api/v1/issue/${issue._id}/status`)
        .set("Cookie", [`token=${customerToken}`])
        .send({ status: "resolved" });
      expect(customerRes.status).toBe(403);
    });
  });

  describe("Owner analytics", () => {
    it("reports order, revenue and payment figures from server data", async () => {
      // 250 COD delivered/paid, 500 stripe delivered/paid, 300 stripe
      // cancelled/refunded, 200 pending/unpaid.
      await createOrder({ totalAmount: 250, paymentMethod: "cod", paymentStatus: "paid" });
      await createOrder({
        totalAmount: 500,
        paymentMethod: "stripe",
        paymentStatus: "paid",
        cartItems: [
          {
            menuId: menu._id.toString(),
            name: menu.name,
            image: menu.image,
            price: 250,
            quantity: 2,
          },
        ],
      });
      await createOrder({
        totalAmount: 300,
        status: "cancelled",
        refundStatus: "refunded",
        paymentStatus: "refunded",
        cartItems: [
          {
            menuId: menu._id.toString(),
            name: menu.name,
            image: menu.image,
            price: 100,
            quantity: 1,
          },
        ],
      });
      await createOrder({
        totalAmount: 200,
        status: "pending",
        paymentStatus: "unpaid",
        cartItems: [
          {
            menuId: menu._id.toString(),
            name: menu.name,
            image: menu.image,
            price: 200,
            quantity: 1,
          },
        ],
      });

      const res = await request(app)
        .get(`/api/v1/restaurant/${restaurant._id}/analytics`)
        .set("Cookie", [`token=${ownerToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.currency).toBe("INR");
      expect(res.body.range.key).toBe("30d");
      expect(res.body.summary).toMatchObject({
        totalOrders: 4,
        deliveredOrders: 2,
        cancelledOrders: 1,
        salesOrders: 3,
        salesValue: 950,
        paidOrders: 2,
        paidValue: 750,
        refundedOrders: 1,
        refundedValue: 300,
      });
      expect(res.body.summary.averageOrderValue).toBeCloseTo(316.67, 1);

      const byStatus = Object.fromEntries(
        res.body.byStatus.map((row: any) => [row.status, row.count]),
      );
      expect(byStatus.delivered).toBe(2);
      expect(byStatus.cancelled).toBe(1);

      const payments = Object.fromEntries(
        res.body.byPaymentStatus.map((row: any) => [row.status, row.count]),
      );
      expect(payments.paid).toBe(2);
      expect(payments.refunded).toBe(1);
      expect(payments.unpaid).toBe(1);

      expect(res.body.topItems[0]).toMatchObject({
        menuId: menu._id.toString(),
        name: menu.name,
        // The cancelled order's item is excluded from top-selling dishes.
        quantity: 5,
        revenue: 900,
      });
      expect(res.body.daily.length).toBeGreaterThanOrEqual(1);
    });

    it("supports ranges and excludes older orders", async () => {
      await createOrder({ totalAmount: 250 });

      const oldId = new mongoose.Types.ObjectId();
      await Order.collection.insertOne({
        _id: oldId,
        user: customer._id,
        restaurant: restaurant._id,
        deliveryDetails: {
          name: customer.fullname,
          email: customer.email,
          address: "Old Street",
          city: "Kolkata",
          pincode: "700001",
        },
        cartItems: [],
        subtotal: 400,
        deliveryFee: 50,
        totalAmount: 450,
        status: "delivered",
        paymentMethod: "cod",
        paymentStatus: "paid",
        createdAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000),
      });

      const recent = await request(app)
        .get(`/api/v1/restaurant/${restaurant._id}/analytics?range=7d`)
        .set("Cookie", [`token=${ownerToken}`]);
      expect(recent.status).toBe(200);
      expect(recent.body.summary.totalOrders).toBe(1);

      const all = await request(app)
        .get(`/api/v1/restaurant/${restaurant._id}/analytics?range=all`)
        .set("Cookie", [`token=${ownerToken}`]);
      expect(all.status).toBe(200);
      expect(all.body.summary.totalOrders).toBe(2);
      expect(all.body.summary.salesValue).toBe(700);
    });

    it("rejects an unsupported range", async () => {
      const res = await request(app)
        .get(`/api/v1/restaurant/${restaurant._id}/analytics?range=1y`)
        .set("Cookie", [`token=${ownerToken}`]);

      expect(res.status).toBe(400);
    });

    it("does not expose analytics for another owner's restaurant", async () => {
      const res = await request(app)
        .get(`/api/v1/restaurant/${restaurant._id}/analytics`)
        .set("Cookie", [`token=${otherOwnerToken}`]);

      expect(res.status).toBe(404);
    });

    it("requires authentication", async () => {
      const res = await request(app).get(
        `/api/v1/restaurant/${restaurant._id}/analytics`,
      );
      expect(res.status).toBe(401);
    });
  });
});
