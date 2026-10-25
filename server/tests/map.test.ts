import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Restaurant } from "../models/restaurant.model.js";
import mapRoute from "../routes/map.route.js";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";

const createTestApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/v1/map", mapRoute);
  return app;
};

describe("Map and Geocoding Security Tests", () => {
  let app: express.Express;
  let testUser: any;
  let testRestaurant: any;
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

    authToken = jwt.sign(
      { userId: testUser._id.toString(), email: testUser.email, admin: false },
      process.env.SECRET_KEY!,
      { expiresIn: "7d" }
    );
  });

  describe("Pincode Validation", () => {
    it("should reject invalid pincode format", async () => {
      const res = await request(app)
        .get("/api/v1/map/pincode/12345")
        .set("Cookie", [`token=${authToken}`]);
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject non-numeric pincode", async () => {
      const res = await request(app)
        .get("/api/v1/map/pincode/abcdef")
        .set("Cookie", [`token=${authToken}`]);
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return pincode data for valid pincode", async () => {
      const res = await request(app)
        .get("/api/v1/map/pincode/700001")
        .set("Cookie", [`token=${authToken}`]);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.pincode).toBe("700001");
    });
  });

  describe("Address Validation", () => {
    it("should reject missing address or pincode", async () => {
      const res = await request(app)
        .post("/api/v1/map/validate-address")
        .set("Cookie", [`token=${authToken}`])
        .send({ address: "Test Address" });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should validate address and pincode", async () => {
      const res = await request(app)
        .post("/api/v1/map/validate-address")
        .set("Cookie", [`token=${authToken}`])
        .send({ address: "123 Test Street", pincode: "700001" });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.coordinates).toBeDefined();
    });

    it("should prefer the map-pin coordinates over the geocoder result", async () => {
      const res = await request(app)
        .post("/api/v1/map/validate-address")
        .set("Cookie", [`token=${authToken}`])
        .send({
          address: "123 Test Street",
          pincode: "700001",
          lat: 22.6,
          lng: 88.5,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.coordinates).toEqual([88.5, 22.6]);
      expect(res.body.source).toBe("map-pin");
    });
  });

  describe("Delivery Check", () => {
    it("should reject missing parameters", async () => {
      const res = await request(app)
        .post("/api/v1/map/check-delivery")
        .set("Cookie", [`token=${authToken}`])
        .send({});
      
      expect(res.status).toBe(400);
    });

    it("should check delivery availability", async () => {
      const res = await request(app)
        .post("/api/v1/map/check-delivery")
        .set("Cookie", [`token=${authToken}`])
        .send({
          restaurantId: testRestaurant._id.toString(),
          customerAddress: "123 Test Street",
          customerPincode: "700001",
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deliverable).toBeDefined();
    });

    it("should reject non-existent restaurant", async () => {
      const fakeId = new mongoose.Types.ObjectId().toString();
      
      const res = await request(app)
        .post("/api/v1/map/check-delivery")
        .set("Cookie", [`token=${authToken}`])
        .send({
          restaurantId: fakeId,
          customerAddress: "123 Test Street",
          customerPincode: "700001",
        });
      
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    it("should accept exact map-pin coordinates", async () => {
      const res = await request(app)
        .post("/api/v1/map/check-delivery")
        .set("Cookie", [`token=${authToken}`])
        .send({
          restaurantId: testRestaurant._id.toString(),
          customerAddress: "123 Test Street",
          customerPincode: "700001",
          lat: 22.6,
          lng: 88.5,
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deliverable).toBeDefined();
    });
  });

  describe("Coordinate Validation", () => {
    it("should reject null island coordinates [0,0]", async () => {
      const res = await request(app)
        .post("/api/v1/map/tracking/route")
        .set("Cookie", [`token=${authToken}`])
        .send({
          driverCoords: [0, 0],
          customerCoords: [88.3639, 22.5726],
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject invalid coordinate format", async () => {
      const res = await request(app)
        .post("/api/v1/map/tracking/route")
        .set("Cookie", [`token=${authToken}`])
        .send({
          driverCoords: [88.3639], // Missing latitude
          customerCoords: [88.3639, 22.5726],
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject out-of-range coordinates", async () => {
      const res = await request(app)
        .post("/api/v1/map/tracking/route")
        .set("Cookie", [`token=${authToken}`])
        .send({
          driverCoords: [200, 22.5726], // Invalid longitude
          customerCoords: [88.3639, 22.5726],
        });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should accept valid coordinates", async () => {
      const res = await request(app)
        .post("/api/v1/map/tracking/route")
        .set("Cookie", [`token=${authToken}`])
        .send({
          driverCoords: [88.3739, 22.5826],
          customerCoords: [88.3639, 22.5726],
        });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.routeCoordinates).toBeDefined();
    });
  });

  describe("Reverse Geocode", () => {
    it("should reject missing coordinates", async () => {
      const res = await request(app)
        .post("/api/v1/map/reverse-geocode")
        .set("Cookie", [`token=${authToken}`])
        .send({ lng: 88.3639 });
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reverse geocode valid coordinates", async () => {
      const res = await request(app)
        .post("/api/v1/map/reverse-geocode")
        .set("Cookie", [`token=${authToken}`])
        .send({ lng: 88.3639, lat: 22.5726 });
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.address).toBeDefined();
    });
  });

  describe("Autocomplete Proxy", () => {
    it("should reject short queries", async () => {
      const res = await request(app)
        .get("/api/v1/map/autocomplete?q=ab")
        .set("Cookie", [`token=${authToken}`]);
      
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return suggestions for valid query", async () => {
      const res = await request(app)
        .get("/api/v1/map/autocomplete?q=Park Street Kolkata")
        .set("Cookie", [`token=${authToken}`]);
      
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.suggestions).toBeDefined();
    });
  });
});