import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import { verifyRequestOrigin } from "../middlewares/verifyOrigin.js";

const ALLOWED_ORIGIN = "http://localhost:5173";

const createTestApp = () => {
  const app = express();
  app.use(verifyRequestOrigin);
  app.all("/mutate", (_req, res) => res.status(200).json({ ok: true }));
  app.get("/read", (_req, res) => res.status(200).json({ ok: true }));
  app.post("/api/v1/order/webhook", (_req, res) => res.status(200).send("ok"));
  return app;
};

describe("Origin/Referer protection for state-changing requests", () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
  });

  it("allows same-site requests that carry no Origin (server, mobile, CLI)", async () => {
    const res = await request(app).post("/mutate");
    expect(res.status).toBe(200);
  });

  it("allows an allow-listed Origin", async () => {
    const res = await request(app)
      .post("/mutate")
      .set("Origin", ALLOWED_ORIGIN);
    expect(res.status).toBe(200);
  });

  it("blocks a different Origin", async () => {
    const res = await request(app)
      .post("/mutate")
      .set("Origin", "https://evil.example.com");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("allows an allow-listed Referer", async () => {
    const res = await request(app)
      .post("/mutate")
      .set("Referer", `${ALLOWED_ORIGIN}/checkout`);
    expect(res.status).toBe(200);
  });

  it("blocks a different Referer", async () => {
    const res = await request(app)
      .post("/mutate")
      .set("Referer", "https://evil.example.com/checkout");
    expect(res.status).toBe(403);
  });

  it("does not block safe methods", async () => {
    const res = await request(app)
      .get("/read")
      .set("Origin", "https://evil.example.com");
    expect(res.status).toBe(200);
  });

  it("does not block CORS preflight", async () => {
    const res = await request(app)
      .options("/mutate")
      .set("Origin", "https://evil.example.com");
    expect(res.status).not.toBe(403);
  });

  it("blocks all mutation verbs", async () => {
    for (const method of ["put", "patch", "delete"] as const) {
      const res = await request(app)
        [method]("/mutate")
        .set("Origin", "https://evil.example.com");
      expect(res.status).toBe(403);
    }
  });

  it("blocks a malformed Origin instead of ignoring it", async () => {
    const res = await request(app)
      .post("/mutate")
      .set("Origin", "not a url");
    expect(res.status).toBe(403);
  });

  it("allows same-origin requests when the API serves the frontend", async () => {
    const res = await request(app)
      .post("/mutate")
      .set("Host", "api.example.com")
      .set("Origin", "https://api.example.com");
    expect(res.status).toBe(200);
  });

  it("exempts the Stripe webhook (signature-authenticated)", async () => {
    const res = await request(app)
      .post("/api/v1/order/webhook")
      .set("Origin", "https://stripe.com");
    expect(res.status).toBe(200);
  });

  it("supports a comma-separated FRONTEND_URL allow-list", async () => {
    const previous = process.env.FRONTEND_URL;
    process.env.FRONTEND_URL = `${ALLOWED_ORIGIN},https://app.example.com`;
    try {
      const allowed = await request(app)
        .post("/mutate")
        .set("Origin", "https://app.example.com");
      expect(allowed.status).toBe(200);

      const blocked = await request(app)
        .post("/mutate")
        .set("Origin", "https://other.example.com");
      expect(blocked.status).toBe(403);
    } finally {
      process.env.FRONTEND_URL = previous;
    }
  });
});
