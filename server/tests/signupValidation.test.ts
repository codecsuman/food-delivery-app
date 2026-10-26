import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { signup } from "../controller/user.controller.js";
import { User } from "../models/user.model.js";

/**
 * These tests mount the controller directly (no Zod middleware) to prove the
 * controller itself cannot persist invalid input or accept privilege fields.
 */
const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.post("/signup", signup);
  return app;
};

describe("Signup input hardening", () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
  });

  const payload = (overrides: Record<string, unknown> = {}) => ({
    fullname: "Signup User",
    email: "signup@example.com",
    password: "password123",
    ...overrides,
  });

  it("rejects a non-numeric contact with 400 instead of persisting NaN", async () => {
    const res = await request(app).post("/signup").send(payload({ contact: "abc" }));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(await User.countDocuments()).toBe(0);
  });

  it("rejects an object contact", async () => {
    const res = await request(app)
      .post("/signup")
      .send(payload({ contact: { $ne: null } }));

    expect(res.status).toBe(400);
  });

  it("rejects boolean and wrong-length contacts instead of returning 500", async () => {
    const booleanRes = await request(app)
      .post("/signup")
      .send(payload({ contact: true }));
    expect(booleanRes.status).toBe(400);

    const shortRes = await request(app)
      .post("/signup")
      .send(payload({ email: "short-contact@example.com", contact: "12345" }));
    expect(shortRes.status).toBe(400);

    const longRes = await request(app)
      .post("/signup")
      .send(payload({ email: "long-contact@example.com", contact: "12345678901" }));
    expect(longRes.status).toBe(400);

    expect(await User.countDocuments()).toBe(0);
  });

  it("rejects non-text identity fields", async () => {
    const res = await request(app)
      .post("/signup")
      .send(payload({ fullname: 12345 }));

    expect(res.status).toBe(400);
  });

  it("treats an empty contact as not provided", async () => {
    const res = await request(app).post("/signup").send(payload({ contact: "" }));

    expect(res.status).toBe(201);
    const user = await User.findOne({ email: "signup@example.com" });
    expect(user!.contact).toBeNull();
  });

  it("accepts a valid 10-digit contact", async () => {
    const res = await request(app)
      .post("/signup")
      .send(payload({ contact: "9876543210" }));

    expect(res.status).toBe(201);
    const user = await User.findOne({ email: "signup@example.com" });
    expect(user!.contact).toBe(9876543210);
  });

  it("never grants admin or driver privileges from signup input", async () => {
    const res = await request(app).post("/signup").send(
      payload({
        admin: true,
        isAdmin: true,
        role: "driver",
        isDriver: true,
      }),
    );

    expect(res.status).toBe(201);
    const user = await User.findOne({ email: "signup@example.com" });
    expect(user!.admin).toBe(false);
    expect((user as any).role).toBeUndefined();
    // The response must not leak the password hash either.
    expect(res.body.user.password).toBeUndefined();
  });

  it("returns 409 for a duplicate email", async () => {
    await request(app).post("/signup").send(payload());
    const res = await request(app).post("/signup").send(payload());

    expect(res.status).toBe(409);
    expect(await User.countDocuments()).toBe(1);
  });

  it("rejects a missing or short password before touching the database", async () => {
    const missing = await request(app)
      .post("/signup")
      .send({ fullname: "No Password", email: "nopass@example.com" });
    const short = await request(app)
      .post("/signup")
      .send(payload({ email: "short@example.com", password: "123" }));

    expect(missing.status).toBe(400);
    expect(short.status).toBe(400);
    expect(await User.countDocuments()).toBe(0);
  });
});
