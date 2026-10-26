// =========================
// LOAD ENV FIRST
// =========================
// IMPORTANT: this side-effect import must stay first. It loads .env before
// any other module (mapService, order controller, etc.) reads process.env at
// import time.
import "./config/env.js";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import mongoose from "mongoose";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =========================
// ENV VALIDATION AT STARTUP
// =========================
const requiredEnvVars = [
  "MONGO_URI",
  "SECRET_KEY",
  "FRONTEND_URL",
  "OPENCAGE_API_KEY",
  "STRIPE_SECRET_KEY",
  "WEBHOOK_ENDPOINT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingEnvVars.length > 0) {
  console.error("❌ Missing required environment variables:", missingEnvVars.join(", "));
  process.exit(1);
}

// Validate SECRET_KEY strength
if (process.env.SECRET_KEY!.length < 32) {
  console.error("❌ SECRET_KEY must be at least 32 characters");
  process.exit(1);
}

// Validate FRONTEND_URL format
const allowedOrigins = process.env.FRONTEND_URL!.split(",")
  .map((o) => o.trim())
  .filter(Boolean)
  // Normalise away trailing slashes/paths so `https://app.example.com/`
  // matches the browser's `Origin: https://app.example.com`.
  .map((o) => {
    try {
      return new URL(o).origin;
    } catch {
      return o;
    }
  });
for (const origin of allowedOrigins) {
  try {
    new URL(origin);
  } catch {
    console.error(`❌ Invalid FRONTEND_URL origin: ${origin}`);
    process.exit(1);
  }
}

// =========================
// IMPORTS
// =========================
import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import helmet from "helmet";
import connectDB from "./db/connectDB.js";
import userRoute from "./routes/user.route.js";
import restaurantRoute from "./routes/restaurant.route.js";
import menuRoute from "./routes/menu.route.js";
import orderRoute from "./routes/order.route.js";
import reviewRoute from "./routes/review.route.js";
import mapRoute from "./routes/map.route.js";
import issueRoute from "./routes/issue.route.js";
import { setupTrackingSocket } from "./socketHandlers/trackingSocket.js";
import bodyParser from "body-parser";
import { stripeWebhook } from "./controller/order.controller.js";
import { logger } from "./utils/logger.js";
import { getTransactionSupport } from "./utils/transactions.js";
import { apiRateLimiter } from "./middlewares/rateLimit.js";
import { sanitizeBody } from "./middlewares/validate.js";
import { verifyRequestOrigin } from "./middlewares/verifyOrigin.js";
import { requestLogger } from "./middlewares/requestLogger.js";
import { startAutoCancelJob } from "./services/autoCancelOrders.js";

const app = express();
const PORT = process.env.PORT || 8001;

// Behind a reverse proxy (Render/Vercel/etc.) this makes req.ip reflect the
// real client address, which is required for per-IP rate limiting.
app.set("trust proxy", 1);

// =========================
// SECURITY MIDDLEWARE
// =========================
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        fontSrc: ["'self'"],
        connectSrc: ["'self'", "https:", "wss:"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  })
);

app.use(apiRateLimiter);

const corsOriginCheck = (
  origin: string | undefined,
  callback: (err: Error | null, allow?: boolean) => void
) => {
  if (!origin) return callback(null, true);
  if (allowedOrigins.includes(origin)) {
    return callback(null, true);
  }
  logger.warn({ origin }, "CORS blocked origin");
  return callback(new Error("Not allowed by CORS"));
};

// =========================
// HTTP SERVER & SOCKET.IO
// =========================
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

setupTrackingSocket(io);

// =========================
// MIDDLEWARE
// =========================
app.use(
  cors({
    origin: corsOriginCheck,
    credentials: true,
    // Let browser clients read the correlation id for support/debugging.
    exposedHeaders: ["X-Request-Id"],
  })
);

// Stripe webhook MUST be before express.json() — needs raw body
app.post(
  "/api/v1/order/webhook",
  bodyParser.raw({ type: "application/json" }),
  stripeWebhook
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use(sanitizeBody);
// Reject cookie-authenticated cross-site mutations unless the Origin/Referer
// matches the configured frontend. See middlewares/verifyOrigin.ts.
app.use(verifyRequestOrigin);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Request logging with a correlation id. The id is echoed in the response so a
// browser/network trace can be matched to server logs, and slow requests are
// surfaced at warn level instead of drowning in normal INFO volume.
app.use(requestLogger);

// =========================
// ROUTES
// =========================
app.use("/api/v1/user", userRoute);
app.use("/api/v1/restaurant", restaurantRoute);
app.use("/api/v1/menu", menuRoute);
app.use("/api/v1/order", orderRoute);
app.use("/api/v1/review", reviewRoute);
app.use("/api/v1/map", mapRoute);
app.use("/api/v1/issue", issueRoute);

// =========================
// HEALTH CHECK
// =========================
app.get("/health", async (_req: Request, res: Response) => {
  const dbState = mongoose.connection.readyState;
  const dbStatus = dbState === 1 ? "connected" : dbState === 2 ? "connecting" : "disconnected";

  if (dbState !== 1) {
    return res.status(503).json({
      status: "DEGRADED",
      message: "Database not connected",
      database: dbStatus,
    });
  }

  const transactions = await getTransactionSupport();

  res.status(200).json({
    status: "OK",
    message: "Server is running",
    database: dbStatus,
    transactions,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    // Additive fields for ops dashboards; existing consumers keep working.
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || "1.0.0",
    // Render exposes the deployed commit, which makes it obvious whether the
    // live service is actually running the latest `main` build.
    commit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || null,
    checks: {
      database: dbStatus,
      transactions: transactions.supported ? "supported" : "fallback",
    },
  });
});

// =========================
// 404 HANDLER
// =========================
app.use((_req: Request, res: Response) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// =========================
// ERROR HANDLER
// =========================
app.use((err: any, req: Request, res: Response, _next: any) => {
  logger.error(
    {
      err: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      requestId: (req as any).requestId,
    },
    "Unhandled error"
  );

  if (err instanceof SyntaxError && "status" in err && err.status === 400 && "body" in err) {
    return res.status(400).json({ success: false, message: "Invalid JSON payload" });
  }

  res.status(500).json({ success: false, message: "Internal Server Error" });
});

// =========================
// START SERVER
// =========================
const startServer = async () => {
  try {
    await connectDB();

    // Restart-safe worker: every tick queries MongoDB for overdue orders, so a
    // deploy/crash does not lose or duplicate cancellations. Emitting to the
    // customer tracking room and the restaurant room keeps both views live.
    const stopAutoCancelJob = startAutoCancelJob((order) => {
      const payload = {
        orderId: order._id.toString(),
        restaurantId: order.restaurant.toString(),
        status: order.status,
        cancellationReason: order.cancellationReason,
        cancelledAt: order.cancelledAt,
        cancelledBy: order.cancelledBy,
        refundStatus: order.refundStatus,
      };

      io.to(`order:${order._id}`).emit("order:status", payload);
      io.to(`restaurant:${order.restaurant}`).emit("order:status", payload);
    });

    const server = httpServer.listen(PORT, () => {
      logger.info(`Server running on port ${PORT} in ${process.env.NODE_ENV} mode`);
    });

    const gracefulShutdown = (signal: string) => {
      logger.info({ signal }, "Shutdown signal received");
      stopAutoCancelJob();
      server.close(async () => {
        await mongoose.connection.close(false);
        logger.info("Server closed, database connection closed");
        process.exit(0);
      });
      setTimeout(() => {
        logger.error("Force shutdown timeout");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        logger.error({ port: PORT }, "Port already in use");
      } else {
        logger.error({ err }, "Server error");
      }
      process.exit(1);
    });
  } catch (error) {
    logger.error({ err: error }, "Failed to start server");
    process.exit(1);
  }
};

startServer();