// =========================
// LOAD ENV FIRST
// =========================
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, ".env") });

// =========================
// IMPORTS
// =========================
import express, { Request, Response } from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDB from "./db/connectDB.js";
import userRoute from "./routes/user.route.js";
import restaurantRoute from "./routes/restaurant.route.js";
import menuRoute from "./routes/menu.route.js";
import orderRoute from "./routes/order.route.js";
import reviewRoute from "./routes/review.route.js";
import mapRoute from "./routes/map.route.js";
import { setupTrackingSocket } from "./socketHandlers/trackingSocket.js";
import bodyParser from "body-parser";
import { stripeWebhook } from "./controller/order.controller.js";

const app = express();
const PORT = process.env.PORT || 8001;

// =========================
// HTTP SERVER & SOCKET.IO
// =========================
const httpServer = createServer(app);
const io = new SocketServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  },
});

setupTrackingSocket(io);

// =========================
// MIDDLEWARE
// =========================
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  }),
);

app.post(
  "/api/v1/order/webhook",
  bodyParser.raw({ type: "application/json" }),
  stripeWebhook,
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =========================
// ROUTES
// =========================
app.use("/api/v1/user", userRoute);
app.use("/api/v1/restaurant", restaurantRoute);
app.use("/api/v1/menu", menuRoute);
app.use("/api/v1/order", orderRoute);
app.use("/api/v1/review", reviewRoute);
app.use("/api/v1/map", mapRoute);

// =========================
// HEALTH CHECK
// =========================
app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "OK", message: "Server is running" });
});

// =========================
// ERROR HANDLER
// =========================
app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error(err.stack);
  res
    .status(500)
    .json({ success: false, message: err.message || "Internal Server Error" });
});

// =========================
// START SERVER
// =========================
const startServer = async () => {
  try {
    await connectDB();

    const server = httpServer.listen(PORT, () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`✅ Socket.IO ready for live tracking`);
    });

    const gracefulShutdown = (signal: string) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(() => {
        console.log("✅ Server closed.");
        process.exit(0);
      });
      setTimeout(() => {
        console.error("❌ Force shutdown after timeout.");
        process.exit(1);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    server.on("error", (err: any) => {
      if (err.code === "EADDRINUSE") {
        console.error(`\n❌ Port ${PORT} is already in use!`);
        process.exit(1);
      } else {
        console.error("Server error:", err);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
