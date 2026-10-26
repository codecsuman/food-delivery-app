import express from "express";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import {
  createCheckoutSession,
  getOrders,
  getOrderBySessionId,
  getOrderById,
  cancelOrder,
  getOrderReceipt,
} from "../controller/order.controller.js";
import { checkoutRateLimiter } from "../middlewares/rateLimit.js";
import { validate } from "../middlewares/validate.js";
import {
  checkoutSchema,
  orderIdParamSchema,
  stripeSessionIdParamSchema,
} from "../schemas/validation.js";

const router = express.Router();

// Get user's orders (protected)
router.get("/", isAuthenticated, getOrders);

// Create Stripe checkout session (protected) - with rate limiting and validation
router.post(
  "/checkout/create-checkout-session",
  isAuthenticated,
  checkoutRateLimiter,
  validate(checkoutSchema),
  createCheckoutSession
);

// Get order by Stripe session ID (protected)
// IMPORTANT: this must be declared BEFORE `/:orderId`, otherwise Express
// matches "session" as the orderId and the request always fails validation.
router.get(
  "/session/:sessionId",
  isAuthenticated,
  validate(stripeSessionIdParamSchema, "params"),
  getOrderBySessionId
);

// Get a structured receipt for an order (customer, restaurant owner, or admin)
router.get(
  "/:orderId/receipt",
  isAuthenticated,
  validate(orderIdParamSchema, "params"),
  getOrderReceipt
);

// Get order by ID (protected)
router.get("/:orderId", isAuthenticated, validate(orderIdParamSchema, "params"), getOrderById);

// Cancel order (protected)
router.post("/:orderId/cancel", isAuthenticated, validate(orderIdParamSchema, "params"), cancelOrder);

export default router;
