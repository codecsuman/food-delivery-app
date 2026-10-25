import express from "express";
import upload from "../middlewares/multer.js";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import {
  addMenu,
  editMenu,
  deleteMenu,
  getMenuByRestaurant,
  getAllMenus,
  getPopularMenus,
} from "../controller/menu.controller.js";
import { validate } from "../middlewares/validate.js";
import { addMenuSchema, updateMenuSchema, idParamSchema, restaurantIdParamSchema, paginationSchema } from "../schemas/validation.js";

const router = express.Router();

// Get all menus across restaurants (public — for home page)
router.get("/", validate(paginationSchema, "query"), getAllMenus);

// Get popular menus (most ordered) - for home page popular section
router.get("/popular", getPopularMenus);

// Add menu item (any logged-in user — restaurant ownership checked in controller)
router.post("/", isAuthenticated, upload.single("image"), validate(addMenuSchema), addMenu);

// Edit menu item (any logged-in user — restaurant ownership checked in controller)
router.put("/:id", isAuthenticated, upload.single("image"), validate(updateMenuSchema), validate(idParamSchema, "params"), editMenu);

// Delete menu item (any logged-in user — restaurant ownership checked in controller)
router.delete("/:id", isAuthenticated, validate(idParamSchema, "params"), deleteMenu);

// Get menu by restaurant (public)
router.get("/restaurant/:restaurantId", validate(restaurantIdParamSchema, "params"), validate(paginationSchema, "query"), getMenuByRestaurant);

export default router;