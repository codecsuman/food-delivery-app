import express from "express";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import {
  createCheckoutSession,
  getOrders,
  getOrderBySessionId,
  getOrderById,
} from "../controller/order.controller.js";

const router = express.Router();

// Get user's orders (protected)
router.get("/", isAuthenticated, getOrders);

// Get order by ID (protected)
router.get("/:orderId", isAuthenticated, getOrderById);

// Create Stripe checkout session (protected)
router.post(
  "/checkout/create-checkout-session",
  isAuthenticated,
  createCheckoutSession,
);

// Get order by Stripe session ID (protected)
router.get("/session/:sessionId", isAuthenticated, getOrderBySessionId);

export default router;
