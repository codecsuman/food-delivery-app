import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import mongoose from "mongoose";
import { Restaurant } from "../models/restaurant.model.js";
// Register the Menu model so `populate("menus")` works in the isolated test app.
import "../models/menu.model.js";
import restaurantRoute from "../routes/restaurant.route.js";
import reviewRoute from "../routes/review.route.js";

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use("/api/v1/restaurant", restaurantRoute);
  app.use("/api/v1/review", reviewRoute);
  return app;
};

describe("Restaurant detail and review lookups", () => {
  let app: express.Express;
  let restaurant: any;

  beforeEach(async () => {
    app = createTestApp();

    restaurant = await Restaurant.create({
      user: new mongoose.Types.ObjectId(),
      restaurantName: "Test Restaurant",
      city: "Kolkata",
      country: "India",
      pincode: "700001",
      deliveryTime: 30,
      deliveryPrice: 20,
      cuisines: ["Indian"],
      imageUrl: "https://test.com/restaurant.jpg",
      location: { type: "Point", coordinates: [88.3639, 22.5726] },
    });
  });

  it("returns 200 for an existing restaurant id", async () => {
    const res = await request(app).get(
      `/api/v1/restaurant/${restaurant._id.toString()}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.restaurant.restaurantName).toBe("Test Restaurant");
  });

  it("returns 400 for a malformed restaurant id", async () => {
    const res = await request(app).get("/api/v1/restaurant/not-an-object-id");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for a 24-character id that is not hexadecimal", async () => {
    const res = await request(app).get(
      "/api/v1/restaurant/zzzzzzzzzzzzzzzzzzzzzzzz",
    );

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 for a 12-byte id that mongoose would otherwise accept", async () => {
    const res = await request(app).get("/api/v1/restaurant/123456789012");

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/valid/i);
  });

  it("returns 404 for a valid but nonexistent restaurant id", async () => {
    const missingId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/v1/restaurant/${missingId}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/not found/i);
  });

  it("returns reviews for an existing restaurant", async () => {
    const res = await request(app).get(
      `/api/v1/review/restaurant/${restaurant._id.toString()}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.reviews).toEqual([]);
  });

  it("returns 400 for a malformed review restaurant id", async () => {
    const res = await request(app).get(
      "/api/v1/review/restaurant/not-an-object-id",
    );

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
