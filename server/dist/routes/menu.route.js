import express from "express";
import upload from "../middlewares/multer.js";
import { isAuthenticated } from "../middlewares/isAuthenticated.js";
import { addMenu, editMenu, deleteMenu, getMenuByRestaurant, getAllMenus, } from "../controller/menu.controller.js";
const router = express.Router();
// Get all menus across restaurants (public — for home page)
router.get("/", getAllMenus);
// Add menu item (any logged-in user)
router.post("/", isAuthenticated, upload.single("image"), addMenu);
// Edit menu item (any logged-in user)
router.put("/:id", isAuthenticated, upload.single("image"), editMenu);
// Delete menu item (any logged-in user)
router.delete("/:id", isAuthenticated, deleteMenu);
// Get menu by restaurant (public)
router.get("/restaurant/:restaurantId", getMenuByRestaurant);
export default router;
