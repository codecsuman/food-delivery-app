import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Restaurant } from "../models/restaurant.model.js";
import "../models/menu.model.js";
import restaurantRoute from "../routes/restaurant.route.js";
import { uploadImage } from "../utils/cloudinary.js";

const createTestApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/v1/restaurant", restaurantRoute);
  return app;
};

const banner = () =>
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl9sAAAAASUVORK5CYII=",
    "base64",
  );

const validFields = {
  restaurantName: "Spice Garden",
  address: "42 Park Street, Near Metro",
  city: "Kolkata",
  state: "West Bengal",
  country: "India",
  pincode: "700016",
  contact: "9876543210",
  alternateContact: "9123456780",
  deliveryTime: "35",
  deliveryPrice: "40",
  cuisines: JSON.stringify(["Indian", "Chinese"]),
  lat: "22.5535",
  lng: "88.352",
};

describe("Restaurant profile persistence", () => {
  let app: express.Express;
  let owner: any;
  let otherUser: any;
  let token: string;
  let otherToken: string;

  beforeEach(async () => {
    app = createTestApp();
    vi.mocked(uploadImage).mockClear();

    owner = await User.create({
      fullname: "Owner",
      email: "owner@example.com",
      password: await bcrypt.hash("password123", 10),
      isVerified: true,
    });
    otherUser = await User.create({
      fullname: "Other",
      email: "other-owner@example.com",
      password: await bcrypt.hash("password123", 10),
      isVerified: true,
    });

    token = jwt.sign(
      { userId: owner._id.toString(), email: owner.email, admin: false },
      process.env.SECRET_KEY!,
      { expiresIn: "7d" },
    );
    otherToken = jwt.sign(
      {
        userId: otherUser._id.toString(),
        email: otherUser.email,
        admin: false,
      },
      process.env.SECRET_KEY!,
      { expiresIn: "7d" },
    );
  });

  it("persists every restaurant field, coordinates and the banner on create", async () => {
    let req = request(app)
      .post("/api/v1/restaurant")
      .set("Cookie", [`token=${token}`]);
    for (const [key, value] of Object.entries(validFields)) {
      req = req.field(key, value);
    }
    const res = await req.attach("imageFile", banner(), {
      filename: "banner.png",
      contentType: "image/png",
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);

    const stored = await Restaurant.findById(res.body.restaurant._id);
    expect(stored!.restaurantName).toBe("Spice Garden");
    expect(stored!.address).toBe("42 Park Street, Near Metro");
    expect(stored!.city).toBe("Kolkata");
    expect(stored!.state).toBe("West Bengal");
    expect(stored!.country).toBe("India");
    expect(stored!.pincode).toBe("700016");
    expect(stored!.contact).toBe(9876543210);
    expect(stored!.alternateContact).toBe(9123456780);
    expect(stored!.deliveryTime).toBe(35);
    expect(stored!.deliveryPrice).toBe(40);
    expect(stored!.cuisines).toEqual(["Indian", "Chinese"]);
    expect(stored!.location!.coordinates).toEqual([88.352, 22.5535]);
    expect(stored!.imageUrl).toBe("https://test.cloudinary.com/image.jpg");
    expect(vi.mocked(uploadImage)).toHaveBeenCalledTimes(1);
  });

  it("requires address, state and a valid primary phone on create", async () => {
    let req = request(app)
      .post("/api/v1/restaurant")
      .set("Cookie", [`token=${token}`]);
    const incomplete: Record<string, string> = {
      ...validFields,
      address: "",
      state: "",
      contact: "123",
    };
    for (const [key, value] of Object.entries(incomplete)) {
      req = req.field(key, value);
    }
    const res = await req.attach("imageFile", banner(), {
      filename: "banner.png",
      contentType: "image/png",
    });

    expect(res.status).toBe(400);
    expect(await Restaurant.countDocuments()).toBe(0);
  });

  it("updates all editable fields without replacing the banner", async () => {
    const existing = await Restaurant.create({
      user: owner._id,
      restaurantName: "Old Name",
      address: "Old Address",
      city: "Kolkata",
      state: "West Bengal",
      country: "India",
      pincode: "700001",
      contact: 9000000000,
      alternateContact: 9000000001,
      deliveryTime: 20,
      deliveryPrice: 10,
      cuisines: ["Indian"],
      imageUrl: "https://test.com/old.jpg",
      imagePublicId: "old/image",
      location: { type: "Point", coordinates: [88.3639, 22.5726] },
    });

    let req = request(app)
      .put(`/api/v1/restaurant/${existing._id}`)
      .set("Cookie", [`token=${token}`]);
    for (const [key, value] of Object.entries({
      ...validFields,
      restaurantName: "New Name",
    })) {
      req = req.field(key, value);
    }
    const res = await req;

    expect(res.status).toBe(200);
    const stored = await Restaurant.findById(existing._id);
    expect(stored!.restaurantName).toBe("New Name");
    expect(stored!.address).toBe("42 Park Street, Near Metro");
    expect(stored!.state).toBe("West Bengal");
    expect(stored!.contact).toBe(9876543210);
    expect(stored!.alternateContact).toBe(9123456780);
    expect(stored!.location!.coordinates).toEqual([88.352, 22.5535]);
    // No new file sent -> old banner untouched.
    expect(stored!.imageUrl).toBe("https://test.com/old.jpg");
  });

  it("rejects updates from a user who does not own the restaurant", async () => {
    const existing = await Restaurant.create({
      user: owner._id,
      restaurantName: "Owner Only",
      address: "Owner Address",
      city: "Kolkata",
      state: "West Bengal",
      country: "India",
      pincode: "700001",
      contact: 9000000000,
      deliveryTime: 20,
      deliveryPrice: 10,
      cuisines: ["Indian"],
      imageUrl: "https://test.com/old.jpg",
      location: { type: "Point", coordinates: [88.3639, 22.5726] },
    });

    const res = await request(app)
      .put(`/api/v1/restaurant/${existing._id}`)
      .set("Cookie", [`token=${otherToken}`])
      .field("restaurantName", "Hijacked");

    expect(res.status).toBe(404);
    const stored = await Restaurant.findById(existing._id);
    expect(stored!.restaurantName).toBe("Owner Only");
  });

  it("replaces the banner through the verified image upload path", async () => {
    const existing = await Restaurant.create({
      user: owner._id,
      restaurantName: "Banner Test",
      address: "Owner Address",
      city: "Kolkata",
      state: "West Bengal",
      country: "India",
      pincode: "700001",
      contact: 9000000000,
      deliveryTime: 20,
      deliveryPrice: 10,
      cuisines: ["Indian"],
      imageUrl: "https://test.com/old.jpg",
      imagePublicId: "old/image",
      location: { type: "Point", coordinates: [88.3639, 22.5726] },
    });

    const res = await request(app)
      .put(`/api/v1/restaurant/${existing._id}`)
      .set("Cookie", [`token=${token}`])
      .field("restaurantName", "Banner Test")
      .attach("imageFile", banner(), {
        filename: "new-banner.png",
        contentType: "image/png",
      });

    expect(res.status).toBe(200);
    expect(vi.mocked(uploadImage)).toHaveBeenCalledTimes(1);
    const stored = await Restaurant.findById(existing._id);
    expect(stored!.imageUrl).toBe("https://test.cloudinary.com/image.jpg");
  });

  it("only returns the owner's own restaurants through my-restaurants", async () => {
    await Restaurant.create({
      user: owner._id,
      restaurantName: "Mine",
      city: "Kolkata",
      state: "West Bengal",
      country: "India",
      pincode: "700001",
      contact: 9000000000,
      deliveryTime: 20,
      cuisines: ["Indian"],
      imageUrl: "https://test.com/mine.jpg",
      location: { type: "Point", coordinates: [88.3639, 22.5726] },
    });
    await Restaurant.create({
      user: new mongoose.Types.ObjectId(),
      restaurantName: "Not Mine",
      city: "Delhi",
      state: "Delhi",
      country: "India",
      pincode: "110001",
      contact: 9000000001,
      deliveryTime: 20,
      cuisines: ["Indian"],
      imageUrl: "https://test.com/not-mine.jpg",
      location: { type: "Point", coordinates: [77.2, 28.6] },
    });

    const res = await request(app)
      .get("/api/v1/restaurant/my-restaurants")
      .set("Cookie", [`token=${token}`]);

    expect(res.status).toBe(200);
    expect(res.body.restaurants).toHaveLength(1);
    expect(res.body.restaurants[0].restaurantName).toBe("Mine");
  });
});
