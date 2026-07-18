import express from "express";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import {
  createCheckoutSession,
  getOrders,
  getOrderBySessionId,
  stripeWebhook,
} from "../controller/order.controller.js";

const router = express.Router();

// Get user's orders (protected)
router.get("/", isAuthenticated, getOrders);

// Create Stripe checkout session (protected)
router.post(
  "/checkout/create-checkout-session",
  isAuthenticated,
  createCheckoutSession,
);

// Get order by Stripe session ID (protected)
router.get("/session/:sessionId", isAuthenticated, getOrderBySessionId);

// Stripe webhook (raw body - must NOT use express.json())
router.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  stripeWebhook,
);

export default router;
