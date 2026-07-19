// =========================
// LOAD ENV FIRST - Must be before any other imports
// =========================
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Load .env from the same directory as this file (server/)
dotenv.config({ path: path.resolve(__dirname, ".env") });
// Debug: Check if env loaded (remove in production)
console.log("🔧 PORT from env:", process.env.PORT);
console.log("🔧 CLOUDINARY_CLOUD_NAME:", process.env.CLOUDINARY_CLOUD_NAME ? "✅ Loaded" : "❌ Missing");
console.log("🔧 MAILTRAP_API_TOKEN:", process.env.MAILTRAP_API_TOKEN ? "✅ Loaded" : "❌ Missing");
// =========================
// NOW import everything else
// =========================
import express from "express";
import cookieParser from "cookie-parser";
import cors from "cors";
import connectDB from "./db/connectDB.js";
import userRoute from "./routes/user.route.js";
import restaurantRoute from "./routes/restaurant.route.js";
import menuRoute from "./routes/menu.route.js";
import orderRoute from "./routes/order.route.js";
import bodyParser from "body-parser";
import { stripeWebhook } from "./controller/order.controller.js";
const app = express();
const PORT = process.env.PORT || 8001;
// =========================
// CORS
// =========================
app.use(cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
}));
// =========================
// STRIPE WEBHOOK (raw body, must be BEFORE express.json)
// =========================
app.post("/api/v1/order/webhook", bodyParser.raw({ type: "application/json" }), stripeWebhook);
// =========================
// BODY PARSERS (AFTER webhook)
// =========================
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());
// =========================
// STATIC FILES
// =========================
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
// =========================
// API ROUTES
// =========================
app.use("/api/v1/user", userRoute);
app.use("/api/v1/restaurant", restaurantRoute);
app.use("/api/v1/menu", menuRoute);
app.use("/api/v1/order", orderRoute);
// =========================
// HEALTH CHECK
// =========================
app.get("/health", (_req, res) => {
    res.status(200).json({ status: "OK", message: "Server is running" });
});
// =========================
// ERROR HANDLER
// =========================
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: err.message || "Internal Server Error",
    });
});
// =========================
// START SERVER
// =========================
const startServer = async () => {
    try {
        await connectDB();
        const server = app.listen(PORT, () => {
            console.log(`✅ Server running on port ${PORT}`);
        });
        const gracefulShutdown = (signal) => {
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
        server.on("error", (err) => {
            if (err.code === "EADDRINUSE") {
                console.error(`\n❌ Port ${PORT} is already in use!`);
                console.error(`   Run: taskkill /F /IM node.exe`);
                process.exit(1);
            }
            else {
                console.error("Server error:", err);
                process.exit(1);
            }
        });
    }
    catch (error) {
        console.error("Failed to start server:", error);
        process.exit(1);
    }
};
startServer();
