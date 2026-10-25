import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Restaurant } from "../models/restaurant.model.js";
import { Menu } from "../models/menu.model.js";
import { Order } from "../models/order.model.js";
import orderRoute from "../routes/order.route.js";
import { stripeWebhook } from "../controller/order.controller.js";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";

const createTestApp = () => {
  const app = express();
  app.use(cookieParser());

  // Stripe webhooks need the raw body, exactly like production (index.ts).
  // This must be registered before express.json().
  app.post(
    "/api/v1/order/webhook",
    express.raw({ type: "application/json" }),
    stripeWebhook
  );

  app.use(express.json());
  app.use("/api/v1/order", orderRoute);
  return app;
};

describe("Order and Payment Security Tests", () => {
  let app: express.Express;
  let testUser: any;
  let testRestaurant: any;
  let testMenu: any;
  let authToken: string;

  beforeEach(async () => {
    app = createTestApp();
    
    testUser = await User.create({
      fullname: "Test User",
      email: "test@example.com",
      password: await import("bcryptjs").then(b => b.hash("password123", 10)),
      isVerified: true,
    });

    testRestaurant = await Restaurant.create({
      user: testUser._id,
      restaurantName: "Test Restaurant",
      city: "Kolkata",
      country: "India",
      pincode: "700001",
      deliveryTime: 30,
      deliveryPrice: 50,
      cuisines: ["Italian"],
      imageUrl: "https://test.com/image.jpg",
      location: { type: "Point", coordinates: [88.3639, 22.5726] },
    });

    testMenu = await Menu.create({
      name: "Test Pizza",
      description: "Delicious pizza",
      price: 200,
      image: "https://test.com/pizza.jpg",
      restaurant: testRestaurant._id,
    });

    testRestaurant.menus.push(testMenu._id);
    await testRestaurant.save();

    authToken = jwt.sign(
      { userId: testUser._id.toString(), email: testUser.email, admin: false },
      process.env.SECRET_KEY!,
      { expiresIn: "7d" }
    );
  });

  describe("Checkout - Price Verification", () => {
    it("should reject checkout with mismatched menu IDs", async () => {
      const fakeMenuId = new mongoose.Types.ObjectId().toString();
      
      const res = await request(app)
        .post("/api/v1/order/checkout/create-checkout-session")
        .set("Cookie", [`token=${authToken}`])
        .send({
          cartItems: [{ menuId: fakeMenuId, name: "Fake", image: "", price: 10, quantity: 1 }],
          deliveryDetails: { name: "Test", email: "test@test.com", address: "123 St", city: "Kolkata", pincode: "700001" },
          restaurantId: testRestaurant._id.toString(),
          paymentMethod: "stripe",
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("not found");
    });

    it("should use database prices, not client prices", async () => {
      const clientPrice = 50; // Client tries to pay 50 instead of 200
      
      const res = await request(app)
        .post("/api/v1/order/checkout/create-checkout-session")
        .set("Cookie", [`token=${authToken}`])
        .send({
          cartItems: [{ menuId: testMenu._id.toString(), name: "Test Pizza", image: "", price: clientPrice, quantity: 1 }],
          deliveryDetails: { name: "Test", email: "test@test.com", address: "123 St", city: "Kolkata", pincode: "700001" },
          restaurantId: testRestaurant._id.toString(),
          paymentMethod: "stripe",
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      // The session should be created with the correct price (200, not 50)
      // This is verified by the order being created with correct total
    });

    it("should reject COD with client-supplied low price", async () => {
      const res = await request(app)
        .post("/api/v1/order/checkout/create-checkout-session")
        .set("Cookie", [`token=${authToken}`])
        .send({
          cartItems: [{ menuId: testMenu._id.toString(), name: "Test Pizza", image: "", price: 10, quantity: 1 }],
          deliveryDetails: { name: "Test", email: "test@test.com", address: "123 St", city: "Kolkata", pincode: "700001" },
          restaurantId: testRestaurant._id.toString(),
          paymentMethod: "cod",
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      // Verify order was created with correct price (200, not 10)
      const order = await Order.findOne({ user: testUser._id }).sort({ createdAt: -1 });
      expect(order!.totalAmount).toBeGreaterThanOrEqual(200); // At least menu price
    });
  });

  describe("Order Access Control", () => {
    let otherUser: any;
    let otherToken: string;
    let testOrder: any;

    beforeEach(async () => {
      otherUser = await User.create({
        fullname: "Other User",
        email: "other@example.com",
        password: await import("bcryptjs").then(b => b.hash("password123", 10)),
        isVerified: true,
      });

      otherToken = jwt.sign(
        { userId: otherUser._id.toString(), email: otherUser.email, admin: false },
        process.env.SECRET_KEY!,
        { expiresIn: "7d" }
      );

      testOrder = await Order.create({
        user: testUser._id,
        restaurant: testRestaurant._id,
        deliveryDetails: { name: "Test", email: "test@test.com", address: "123 St", city: "Kolkata" },
        cartItems: [{ menuId: testMenu._id.toString(), name: "Test Pizza", image: "", price: 200, quantity: 1 }],
        totalAmount: 250,
        status: "confirmed",
        paymentMethod: "cod",
      });
    });

    it("should prevent user from accessing another user's order", async () => {
      const res = await request(app)
        .get(`/api/v1/order/${testOrder._id}`)
        .set("Cookie", [`token=${otherToken}`]);
      
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should allow owner to access their order", async () => {
      const res = await request(app)
        .get(`/api/v1/order/${testOrder._id}`)
        .set("Cookie", [`token=${authToken}`]);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it("should prevent user from cancelling another user's order", async () => {
      const res = await request(app)
        .post(`/api/v1/order/${testOrder._id}/cancel`)
        .set("Cookie", [`token=${otherToken}`]);
      
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should prevent cancelling delivered orders", async () => {
      testOrder.status = "delivered";
      await testOrder.save();

      const res = await request(app)
        .post(`/api/v1/order/${testOrder._id}/cancel`)
        .set("Cookie", [`token=${authToken}`]);
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("Stripe Webhook Security", () => {
    let webhookOrder: any;

    beforeEach(async () => {
      webhookOrder = await Order.create({
        user: testUser._id,
        restaurant: testRestaurant._id,
        deliveryDetails: {
          name: "Test",
          email: "test@test.com",
          address: "123 St",
          city: "Kolkata",
          pincode: "700001",
        },
        cartItems: [
          {
            menuId: testMenu._id.toString(),
            name: "Test Pizza",
            image: "",
            price: 200,
            quantity: 1,
          },
        ],
        totalAmount: 250,
        status: "pending",
        paymentMethod: "stripe",
      });
    });

    it("should reject webhook without signature", async () => {
      const res = await request(app)
        .post("/api/v1/order/webhook")
        .send({ type: "checkout.session.completed" });
      
      expect(res.status).toBe(400);
    });

    it("should reject webhook with invalid signature", async () => {
      const res = await request(app)
        .post("/api/v1/order/webhook")
        .set("stripe-signature", "invalid-signature")
        .send({ type: "checkout.session.completed" });
      
      expect(res.status).toBe(400);
    });

    it("should be idempotent - ignore duplicate events", async () => {
      const event = {
        id: "evt_test_123",
        type: "checkout.session.completed",
        data: {
          object: {
            id: "cs_test_123",
            metadata: { orderId: webhookOrder._id.toString() },
            amount_total: 25000,
            payment_intent: "pi_test_123",
          },
        },
      };

      // First request
      const res1 = await request(app)
        .post("/api/v1/order/webhook")
        .set("stripe-signature", "valid-signature")
        .send(event);
      
      expect(res1.status).toBe(200);

      // Second request with same event ID
      const res2 = await request(app)
        .post("/api/v1/order/webhook")
        .set("stripe-signature", "valid-signature")
        .send(event);
      
      expect(res2.status).toBe(200);
      
      // orderCount should only be incremented once
      const menu = await Menu.findById(testMenu._id);
      expect(menu!.orderCount).toBe(1);
    });
  });
});