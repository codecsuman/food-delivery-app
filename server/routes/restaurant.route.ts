import express from "express";
import {
  createRestaurant,
  getRestaurant,
  getRestaurantOrder,
  getSingleRestaurant,
  searchRestaurant,
  updateOrderStatus,
  updateRestaurant,
  getUserRestaurants,
  getAllRestaurants,
  deleteRestaurant,
} from "../controller/restaurant.controller.js";
import upload from "../middlewares/multer.js";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";

const router = express.Router();

// Create restaurant (any logged-in user)
router.post("/", isAuthenticated, upload.single("imageFile"), createRestaurant);

// Get my restaurant (any logged-in user)
router.get("/", isAuthenticated, getRestaurant);

// Get all user's restaurants (multiple)
router.get("/my-restaurants", isAuthenticated, getUserRestaurants);

// Get all restaurants (public)
router.get("/all", getAllRestaurants);

// Update my restaurant (any logged-in user)
router.put("/", isAuthenticated, upload.single("imageFile"), updateRestaurant);

// Update restaurant by ID
router.put(
  "/:id",
  isAuthenticated,
  upload.single("imageFile"),
  updateRestaurant,
);

// Delete restaurant
router.delete("/:id", isAuthenticated, deleteRestaurant);

// Get orders for my restaurant (any logged-in user)
router.get("/order", isAuthenticated, getRestaurantOrder);

// Update order status (any logged-in user)
router.put("/order/:orderId/status", isAuthenticated, updateOrderStatus);

// Search restaurants (public)
router.get("/search/:searchText", searchRestaurant);
// Additional route for query-only search (from hero section)
router.get("/search", searchRestaurant);

// Get single restaurant (public)
router.get("/:id", getSingleRestaurant);

export default router;
