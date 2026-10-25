import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Restaurant } from "../models/restaurant.model.js";
import { Menu } from "../models/menu.model.js";
import { Review } from "../models/review.model.js";
import { Order } from "../models/order.model.js";
import reviewRoute from "../routes/review.route.js";

const createTestApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/v1/review", reviewRoute);
  return app;
};

describe("Review Security Tests", () => {
  let app: express.Express;
  let testUser: any;
  let testUser2: any;
  let testRestaurant: any;
  let testMenu: any;
  let userToken: string;
  let user2Token: string;

  beforeEach(async () => {
    app = createTestApp();
    
    testUser = await User.create({
      fullname: "Test User",
      email: "test@example.com",
      password: await import("bcryptjs").then(b => b.hash("password123", 10)),
      isVerified: true,
    });

    testUser2 = await User.create({
      fullname: "Test User 2",
      email: "test2@example.com",
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

    // Reviews are only allowed after a delivered order (security rule).
    const deliveredOrder = (user: any) => ({
      user: user._id,
      restaurant: testRestaurant._id,
      deliveryDetails: {
        name: user.fullname,
        email: user.email,
        address: "123 Test Street",
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
      status: "delivered",
      paymentMethod: "cod",
    });

    await Order.create([deliveredOrder(testUser), deliveredOrder(testUser2)]);

    userToken = jwt.sign(
      { userId: testUser._id.toString(), email: testUser.email, admin: false },
      process.env.SECRET_KEY!,
      { expiresIn: "7d" }
    );

    user2Token = jwt.sign(
      { userId: testUser2._id.toString(), email: testUser2.email, admin: false },
      process.env.SECRET_KEY!,
      { expiresIn: "7d" }
    );
  });

  describe("Add Review", () => {
    it("should reject review without authentication", async () => {
      const res = await request(app)
        .post("/api/v1/review/")
        .send({
          restaurantId: testRestaurant._id.toString(),
          rating: 5,
          comment: "Great food!",
        });
      
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject invalid rating", async () => {
      const res = await request(app)
        .post("/api/v1/review/")
        .set("Cookie", [`token=${userToken}`])
        .send({
          restaurantId: testRestaurant._id.toString(),
          rating: 6, // Invalid - max is 5
          comment: "Great food!",
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toContainEqual(expect.stringContaining("rating"));
    });

    it("should reject rating below 1", async () => {
      const res = await request(app)
        .post("/api/v1/review/")
        .set("Cookie", [`token=${userToken}`])
        .send({
          restaurantId: testRestaurant._id.toString(),
          rating: 0,
          comment: "Great food!",
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject short comment", async () => {
      const res = await request(app)
        .post("/api/v1/review/")
        .set("Cookie", [`token=${userToken}`])
        .send({
          restaurantId: testRestaurant._id.toString(),
          rating: 5,
          comment: "Hi", // Too short
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject long comment", async () => {
      const res = await request(app)
        .post("/api/v1/review/")
        .set("Cookie", [`token=${userToken}`])
        .send({
          restaurantId: testRestaurant._id.toString(),
          rating: 5,
          comment: "A".repeat(1001), // Too long
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should prevent duplicate review for same restaurant", async () => {
      // First review
      await request(app)
        .post("/api/v1/review/")
        .set("Cookie", [`token=${userToken}`])
        .send({
          restaurantId: testRestaurant._id.toString(),
          rating: 5,
          comment: "Great food!",
        });

      // Second review for same restaurant
      const res = await request(app)
        .post("/api/v1/review/")
        .set("Cookie", [`token=${userToken}`])
        .send({
          restaurantId: testRestaurant._id.toString(),
          rating: 4,
          comment: "Good food!",
        });
      
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("should allow review from different user", async () => {
      const res = await request(app)
        .post("/api/v1/review/")
        .set("Cookie", [`token=${user2Token}`])
        .send({
          restaurantId: testRestaurant._id.toString(),
          rating: 4,
          comment: "Good food!",
        });
      
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
    });
  });

  describe("Get Reviews", () => {
    beforeEach(async () => {
      await Review.create([
        {
          user: testUser._id,
          restaurant: testRestaurant._id,
          rating: 5,
          comment: "Excellent!",
          userName: "Test User",
        },
        {
          user: testUser2._id,
          restaurant: testRestaurant._id,
          rating: 4,
          comment: "Good!",
          userName: "Test User 2",
        },
      ]);
    });

    it("should get reviews by restaurant", async () => {
      const res = await request(app)
        .get(`/api/v1/review/restaurant/${testRestaurant._id.toString()}`);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.reviews.length).toBe(2);
    });

    it("should reject invalid restaurant ID", async () => {
      const res = await request(app)
        .get("/api/v1/review/restaurant/invalid-id");
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("Delete Review", () => {
    let testReview: any;

    beforeEach(async () => {
      testReview = await Review.create({
        user: testUser._id,
        restaurant: testRestaurant._id,
        rating: 5,
        comment: "To be deleted",
        userName: "Test User",
      });
    });

    it("should reject delete without authentication", async () => {
      const res = await request(app)
        .delete(`/api/v1/review/${testReview._id.toString()}`);
      
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should prevent user from deleting another user's review", async () => {
      const res = await request(app)
        .delete(`/api/v1/review/${testReview._id.toString()}`)
        .set("Cookie", [`token=${user2Token}`]);
      
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should allow owner to delete their review", async () => {
      const res = await request(app)
        .delete(`/api/v1/review/${testReview._id.toString()}`)
        .set("Cookie", [`token=${userToken}`]);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});