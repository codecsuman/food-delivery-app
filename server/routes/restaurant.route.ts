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
  getFilterOptions,
} from "../controller/restaurant.controller.js";
import { getRestaurantAnalytics } from "../controller/analytics.controller.js";
import upload from "../middlewares/multer.js";
import { isAuthenticated, isAdmin } from "../middlewares/isAuthenticated.js";
import { validate } from "../middlewares/validate.js";
import { createRestaurantSchema, updateRestaurantSchema, updateOrderStatusSchema, idParamSchema, orderIdParamSchema, searchSchema, paginationSchema, restaurantIdParamSchema, analyticsQuerySchema } from "../schemas/validation.js";

const router = express.Router();

// Create restaurant (any logged-in user — but only their own)
router.post("/", isAuthenticated, upload.single("imageFile"), validate(createRestaurantSchema), createRestaurant);

// Get my restaurant (any logged-in user)
router.get("/", isAuthenticated, getRestaurant);

// Get all user's restaurants (multiple)
router.get("/my-restaurants", isAuthenticated, getUserRestaurants);

// Get all restaurants (public) - with pagination
router.get("/all", validate(paginationSchema, "query"), getAllRestaurants);

// Update my restaurant (any logged-in user)
router.put("/", isAuthenticated, upload.single("imageFile"), validate(updateRestaurantSchema), updateRestaurant);

// Update restaurant by ID
router.put(
  "/:id",
  isAuthenticated,
  upload.single("imageFile"),
  validate(updateRestaurantSchema),
  validate(idParamSchema, "params"),
  updateRestaurant
);

// Delete restaurant
router.delete("/:id", isAuthenticated, validate(idParamSchema, "params"), deleteRestaurant);

// Get orders for my restaurant (any logged-in user)
router.get("/order", isAuthenticated, validate(paginationSchema, "query"), getRestaurantOrder);

// Update order status (any logged-in user who owns the restaurant)
router.put(
  "/order/:orderId/status",
  isAuthenticated,
  validate(updateOrderStatusSchema),
  validate(orderIdParamSchema, "params"),
  updateOrderStatus
);

// Search restaurants (public)
router.get("/search/:searchText", validate(searchSchema, "query"), searchRestaurant);
router.get("/search", validate(searchSchema, "query"), searchRestaurant);

// Filter options — distinct cuisines & dishes (public)
router.get("/filters", getFilterOptions);

// Sales analytics for one of my restaurants (owner; ownership checked in controller)
router.get(
  "/:restaurantId/analytics",
  isAuthenticated,
  validate(restaurantIdParamSchema, "params"),
  validate(analyticsQuerySchema, "query"),
  getRestaurantAnalytics
);

// Get single restaurant (public)
router.get("/:id", validate(idParamSchema, "params"), getSingleRestaurant);

export default router;