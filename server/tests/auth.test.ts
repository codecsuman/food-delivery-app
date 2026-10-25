import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { generateToken, clearToken } from "../utils/generateToken.js";
import userRoute from "../routes/user.route.js";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";

const createTestApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/v1/user", userRoute);
  return app;
};

describe("Authentication Security Tests", () => {
  let app: express.Express;
  let testUser: any;
  let authToken: string;

  beforeEach(async () => {
    app = createTestApp();
    
    // Create test user
    testUser = await User.create({
      fullname: "Test User",
      email: "test@example.com",
      password: await import("bcryptjs").then(b => b.hash("password123", 10)),
      isVerified: true,
    });

    // Generate valid token
    authToken = jwt.sign(
      { userId: testUser._id.toString(), email: testUser.email, admin: false },
      process.env.SECRET_KEY!,
      { expiresIn: "7d" }
    );
  });

  describe("Signup", () => {
    it("should reject signup with missing fields", async () => {
      const res = await request(app).post("/api/v1/user/signup").send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject signup with invalid email", async () => {
      const res = await request(app).post("/api/v1/user/signup").send({
        fullname: "Test User",
        email: "invalid-email",
        password: "password123",
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject signup with short password", async () => {
      const res = await request(app).post("/api/v1/user/signup").send({
        fullname: "Test User",
        email: "test2@example.com",
        password: "123",
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject duplicate email", async () => {
      const res = await request(app).post("/api/v1/user/signup").send({
        fullname: "Test User 2",
        email: "test@example.com",
        password: "password123",
      });
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it("should create user successfully", async () => {
      const res = await request(app).post("/api/v1/user/signup").send({
        fullname: "New User",
        email: "newuser@example.com",
        password: "password123",
      });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.password).toBeUndefined();
    });
  });

  describe("Login", () => {
    it("should reject login with missing fields", async () => {
      const res = await request(app).post("/api/v1/user/login").send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject login with invalid email", async () => {
      const res = await request(app).post("/api/v1/user/login").send({
        email: "nonexistent@example.com",
        password: "password123",
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should reject login with wrong password", async () => {
      const res = await request(app).post("/api/v1/user/login").send({
        email: "test@example.com",
        password: "wrongpassword",
      });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should login successfully and set HttpOnly cookie", async () => {
      const res = await request(app).post("/api/v1/user/login").send({
        email: "test@example.com",
        password: "password123",
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers["set-cookie"]).toBeDefined();
      
      const cookie = res.headers["set-cookie"][0];
      expect(cookie).toContain("HttpOnly");
      expect(cookie).toContain("token=");
    });
  });

  describe("Protected Routes", () => {
    it("should reject requests without token", async () => {
      const res = await request(app).get("/api/v1/user/check-auth");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject requests with invalid token", async () => {
      const res = await request(app)
        .get("/api/v1/user/check-auth")
        .set("Cookie", ["token=invalid-token"]);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should reject requests with expired token", async () => {
      const expiredToken = jwt.sign(
        { userId: testUser._id.toString(), email: testUser.email, admin: false },
        process.env.SECRET_KEY!,
        { expiresIn: "-1h" }
      );
      const res = await request(app)
        .get("/api/v1/user/check-auth")
        .set("Cookie", [`token=${expiredToken}`]);
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should accept valid token", async () => {
      const res = await request(app)
        .get("/api/v1/user/check-auth")
        .set("Cookie", [`token=${authToken}`]);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user._id).toBe(testUser._id.toString());
    });
  });

  describe("Profile Update", () => {
    it("should prevent updating another user's profile", async () => {
      const otherUser = await User.create({
        fullname: "Other User",
        email: "other@example.com",
        password: await import("bcryptjs").then(b => b.hash("password123", 10)),
        isVerified: true,
      });

      const otherToken = jwt.sign(
        { userId: otherUser._id.toString(), email: otherUser.email, admin: false },
        process.env.SECRET_KEY!,
        { expiresIn: "7d" }
      );

      // Try to update testUser's profile with otherUser's token
      const res = await request(app)
        .put("/api/v1/user/profile/update")
        .set("Cookie", [`token=${otherToken}`])
        .send({ fullname: "Hacked Name" });
      
      // Should succeed but only update otherUser's own profile
      expect(res.status).toBe(200);
      
      // Verify testUser unchanged
      const updatedTestUser = await User.findById(testUser._id);
      expect(updatedTestUser!.fullname).toBe("Test User");
    });

    it("should prevent email collision", async () => {
      await User.create({
        fullname: "Another User",
        email: "taken@example.com",
        password: await import("bcryptjs").then(b => b.hash("password123", 10)),
        isVerified: true,
      });

      const res = await request(app)
        .put("/api/v1/user/profile/update")
        .set("Cookie", [`token=${authToken}`])
        .send({ email: "taken@example.com" });
      
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe("Logout", () => {
    it("should clear token cookie", async () => {
      const res = await request(app)
        .post("/api/v1/user/logout")
        .set("Cookie", [`token=${authToken}`]);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      
      const cookie = res.headers["set-cookie"][0];
      expect(cookie).toContain("token=");
      expect(cookie).toContain("Expires=Thu, 01 Jan 1970");
    });
  });
});