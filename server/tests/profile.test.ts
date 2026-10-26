import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User } from "../models/user.model.js";
import userRoute from "../routes/user.route.js";

const createTestApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/v1/user", userRoute);
  return app;
};

describe("Profile persistence", () => {
  let app: express.Express;
  let user: any;
  let authToken: string;

  beforeEach(async () => {
    app = createTestApp();

    user = await User.create({
      fullname: "Profile User",
      email: "profile@example.com",
      password: await bcrypt.hash("password123", 10),
      contact: 9876543210,
      alternateContact: 9123456780,
      address: "Old Address",
      pincode: "700001",
      city: "Kolkata",
      state: "West Bengal",
      country: "India",
      latitude: 22.5726,
      longitude: 88.3639,
      isVerified: true,
    });

    authToken = jwt.sign(
      {
        userId: user._id.toString(),
        email: user.email,
        admin: false,
      },
      process.env.SECRET_KEY!,
      { expiresIn: "7d" },
    );
  });

  it("persists alternate phone, address, pincode, city/state/country and coordinates", async () => {
    const res = await request(app)
      .put("/api/v1/user/profile/update")
      .set("Cookie", [`token=${authToken}`])
      .send({
        contact: "9000000001",
        alternateContact: "9000000002",
        address: "12 Park Street, Flat 4B",
        pincode: "700016",
        city: "Kolkata",
        state: "West Bengal",
        country: "India",
        latitude: 22.5535,
        longitude: 88.352,
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Re-fetch exactly like the client does after a refresh.
    const profile = await request(app)
      .get("/api/v1/user/profile")
      .set("Cookie", [`token=${authToken}`]);

    expect(profile.status).toBe(200);
    expect(profile.body.user.contact).toBe(9000000001);
    expect(profile.body.user.alternateContact).toBe(9000000002);
    expect(profile.body.user.address).toBe("12 Park Street, Flat 4B");
    expect(profile.body.user.pincode).toBe("700016");
    expect(profile.body.user.city).toBe("Kolkata");
    expect(profile.body.user.state).toBe("West Bengal");
    expect(profile.body.user.country).toBe("India");
    expect(profile.body.user.latitude).toBe(22.5535);
    expect(profile.body.user.longitude).toBe(88.352);
  });

  it("preserves unrelated fields on a partial update", async () => {
    const res = await request(app)
      .put("/api/v1/user/profile/update")
      .set("Cookie", [`token=${authToken}`])
      .send({ alternateContact: "9000000009" });

    expect(res.status).toBe(200);

    const profile = await request(app)
      .get("/api/v1/user/profile")
      .set("Cookie", [`token=${authToken}`]);

    expect(profile.body.user.fullname).toBe("Profile User");
    expect(profile.body.user.contact).toBe(9876543210);
    expect(profile.body.user.address).toBe("Old Address");
    expect(profile.body.user.pincode).toBe("700001");
    expect(profile.body.user.city).toBe("Kolkata");
    expect(profile.body.user.latitude).toBe(22.5726);
    expect(profile.body.user.longitude).toBe(88.3639);
    expect(profile.body.user.alternateContact).toBe(9000000009);
  });

  it("clears optional phone and pincode with empty strings", async () => {
    const res = await request(app)
      .put("/api/v1/user/profile/update")
      .set("Cookie", [`token=${authToken}`])
      .send({ alternateContact: "", pincode: "" });

    expect(res.status).toBe(200);

    const profile = await request(app)
      .get("/api/v1/user/profile")
      .set("Cookie", [`token=${authToken}`]);

    expect(profile.body.user.alternateContact).toBeNull();
    expect(profile.body.user.pincode).toBe("");
    // Clearing two fields must not touch the rest of the profile.
    expect(profile.body.user.contact).toBe(9876543210);
    expect(profile.body.user.address).toBe("Old Address");
  });

  it("clears saved coordinates when explicitly set to null", async () => {
    const res = await request(app)
      .put("/api/v1/user/profile/update")
      .set("Cookie", [`token=${authToken}`])
      .send({ latitude: null, longitude: null });

    expect(res.status).toBe(200);

    const profile = await request(app)
      .get("/api/v1/user/profile")
      .set("Cookie", [`token=${authToken}`]);

    expect(profile.body.user.latitude).toBeNull();
    expect(profile.body.user.longitude).toBeNull();
  });

  it("rejects a partially typed phone number", async () => {
    const res = await request(app)
      .put("/api/v1/user/profile/update")
      .set("Cookie", [`token=${authToken}`])
      .send({ alternateContact: "90000" });

    expect(res.status).toBe(400);

    const stored = await User.findById(user._id);
    expect(stored!.alternateContact).toBe(9123456780);
  });

  it("rejects a partially typed pincode", async () => {
    const res = await request(app)
      .put("/api/v1/user/profile/update")
      .set("Cookie", [`token=${authToken}`])
      .send({ pincode: "7000" });

    expect(res.status).toBe(400);

    const stored = await User.findById(user._id);
    expect(stored!.pincode).toBe("700001");
  });

  it("rejects out-of-range coordinates without changing stored data", async () => {
    const res = await request(app)
      .put("/api/v1/user/profile/update")
      .set("Cookie", [`token=${authToken}`])
      .send({ latitude: 123, longitude: 88.36 });

    expect(res.status).toBe(400);

    const stored = await User.findById(user._id);
    expect(stored!.latitude).toBe(22.5726);
    expect(stored!.longitude).toBe(88.3639);
  });

  it("requires authentication", async () => {
    const res = await request(app)
      .put("/api/v1/user/profile/update")
      .send({ alternateContact: "9000000002" });

    expect(res.status).toBe(401);
  });

  it("never returns the password hash in profile responses", async () => {
    const profile = await request(app)
      .get("/api/v1/user/profile")
      .set("Cookie", [`token=${authToken}`]);

    expect(profile.status).toBe(200);
    expect(profile.body.user.password).toBeUndefined();
  });
});
