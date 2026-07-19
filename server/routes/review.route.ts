import express from "express";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import {
  addReview,
  getReviewsByRestaurant,
  getUserReviews,
  deleteReview,
} from "../controller/review.controller.js";

const router = express.Router();

// Add review (protected)
router.post("/", isAuthenticated, addReview);

// Get reviews by restaurant (public)
router.get("/restaurant/:restaurantId", getReviewsByRestaurant);

// Get user's reviews (protected)
router.get("/my-reviews", isAuthenticated, getUserReviews);

// Delete review (protected)
router.delete("/:id", isAuthenticated, deleteReview);

export default router;
