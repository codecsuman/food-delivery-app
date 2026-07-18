import express from "express";
import {
  createRestaurant,
  getRestaurant,
  getRestaurantOrder,
  getSingleRestaurant,
  searchRestaurant,
  updateOrderStatus,
  updateRestaurant,
} from "../controller/restaurant.controller.ts";
import upload from "../middlewares/multer.ts";
import { isAuthenticated } from "../middlewares/isAuthenticated.ts";

const router = express.Router();

// Create restaurant (any logged-in user)
router.post("/", isAuthenticated, upload.single("imageFile"), createRestaurant);

// Get my restaurant (any logged-in user)
router.get("/", isAuthenticated, getRestaurant);

// Update my restaurant (any logged-in user)
router.put("/", isAuthenticated, upload.single("imageFile"), updateRestaurant);

// Get orders for my restaurant (any logged-in user)
router.get("/order", isAuthenticated, getRestaurantOrder);

// Update order status (any logged-in user)
router.put("/order/:orderId/status", isAuthenticated, updateOrderStatus);

// Search restaurants (public) - FIXED: Also support query-based search
router.get("/search/:searchText", searchRestaurant);
// FIXED: Additional route for query-only search (from hero section)
router.get("/search", searchRestaurant);

// Get single restaurant (public)
router.get("/:id", getSingleRestaurant);

export default router;
