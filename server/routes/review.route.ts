import express from "express";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import {
  addReview,
  getReviewsByRestaurant,
  getUserReviews,
  deleteReview,
} from "../controller/review.controller.js";
import { reviewRateLimiter } from "../middlewares/rateLimit.js";
import { validate } from "../middlewares/validate.js";
import { addReviewSchema, idParamSchema, restaurantIdParamSchema } from "../schemas/validation.js";

const router = express.Router();

// Add review (protected) - with rate limiting and validation
router.post("/", isAuthenticated, reviewRateLimiter, validate(addReviewSchema), addReview);

// Get reviews by restaurant (public)
router.get("/restaurant/:restaurantId", validate(restaurantIdParamSchema, "params"), getReviewsByRestaurant);

// Get user's reviews (protected)
router.get("/my-reviews", isAuthenticated, getUserReviews);

// Delete review (protected)
router.delete("/:id", isAuthenticated, validate(idParamSchema, "params"), deleteReview);

export default router;