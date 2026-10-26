import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";
import express from "express";
import { requestLogger, slowRequestThreshold } from "../middlewares/requestLogger.js";
import { logger } from "../utils/logger.js";

const createTestApp = () => {
  const app = express();
  app.use(requestLogger);
  app.get("/ok", (_req, res) => res.status(200).json({ ok: true }));
  app.get("/boom", (_req, res) => res.status(500).json({ ok: false }));
  app.get("/slow", async (_req, res) => {
    await new Promise((resolve) => setTimeout(resolve, 15));
    res.status(200).json({ ok: true });
  });
  return app;
};

describe("Request correlation and logging", () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
    vi.mocked(logger.info).mockClear();
    vi.mocked(logger.warn).mockClear();
    vi.mocked(logger.error).mockClear();
  });

  it("always returns an X-Request-Id header", async () => {
    const res = await request(app).get("/ok");

    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("echoes a well-formed inbound correlation id", async () => {
    const res = await request(app)
      .get("/ok")
      .set("X-Request-Id", "client-trace-1234");

    expect(res.headers["x-request-id"]).toBe("client-trace-1234");
  });

  it("replaces a malformed inbound correlation id", async () => {
    const res = await request(app)
      .get("/ok")
      .set("X-Request-Id", "bad id with spaces");

    expect(res.headers["x-request-id"]).not.toBe("bad id with spaces");
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("logs 5xx responses at error level with the request id", async () => {
    const res = await request(app).get("/boom");

    expect(res.status).toBe(500);
    const call = vi
      .mocked(logger.error)
      .mock.calls.find(([, message]) => message === "Request failed");
    expect(call).toBeTruthy();
    expect(call![0]).toMatchObject({
      path: "/boom",
      statusCode: 500,
      requestId: res.headers["x-request-id"],
    });
  });

  it("logs slow requests at warn level", async () => {
    const previous = process.env.SLOW_REQUEST_MS;
    process.env.SLOW_REQUEST_MS = "1";
    try {
      expect(slowRequestThreshold()).toBe(1);

      const res = await request(app).get("/slow");
      expect(res.status).toBe(200);

      const call = vi
        .mocked(logger.warn)
        .mock.calls.find(([, message]) => message === "Slow request");
      expect(call).toBeTruthy();
      expect(call![0]).toMatchObject({ path: "/slow" });
    } finally {
      process.env.SLOW_REQUEST_MS = previous;
    }
  });

  it("does not log normal requests as errors or warnings", async () => {
    await request(app).get("/ok");

    expect(
      vi.mocked(logger.error).mock.calls.filter(([, m]) => m === "Request failed"),
    ).toHaveLength(0);
    expect(
      vi.mocked(logger.warn).mock.calls.filter(([, m]) => m === "Slow request"),
    ).toHaveLength(0);
  });
});
