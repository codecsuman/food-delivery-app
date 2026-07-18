import { Request, Response } from "express";
import {
  uploadImage,
  deleteImage,
  getPublicIdFromUrl,
} from "../utils/cloudinary.ts";
import { Menu } from "../models/menu.model.ts";
import { Restaurant } from "../models/restaurant.model.ts";
import mongoose from "mongoose";

// ======================= ADD MENU (FIXED) =======================
export const addMenu = async (req: Request, res: Response) => {
  try {
    const { name, description, price } = req.body;
    const file = req.file;

    // Validate required fields
    if (!name || !description || !price) {
      return res.status(400).json({
        success: false,
        message: "Name, description and price are required",
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Menu image is required",
      });
    }

    // Find restaurant for this user
    const restaurant = await Restaurant.findOne({ user: req.id });
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message:
          "Restaurant not found. Create a restaurant before adding a menu.",
      });
    }

    // Upload image to Cloudinary
    const base64Image = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const cloudResponse = await uploadImage(base64Image, "suman-food/menus");

    // Create menu with restaurant reference
    const menu = await Menu.create({
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      image: cloudResponse.secure_url,
      imagePublicId: cloudResponse.public_id,
      restaurant: restaurant._id,
    });

    // Link menu to restaurant
    restaurant.menus.push(menu._id as any);
    await restaurant.save();

    // FIXED: Return menu with restaurant as string for frontend compatibility
    const menuResponse = {
      _id: menu._id,
      name: menu.name,
      description: menu.description,
      price: menu.price,
      image: menu.image,
      restaurant: restaurant._id.toString(),
    };

    return res.status(201).json({
      success: true,
      message: "Menu added successfully",
      menu: menuResponse,
    });
  } catch (error) {
    console.error("Add menu error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= EDIT MENU (FIXED) =======================
export const editMenu = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, price } = req.body;
    const file = req.file;

    // Validate menu ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu ID",
      });
    }

    const menu = await Menu.findById(id);
    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found",
      });
    }

    // Ownership check: verify this menu belongs to the user's restaurant
    const restaurant = await Restaurant.findOne({ user: req.id });
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Check if menu belongs to this restaurant
    if (menu.restaurant.toString() !== restaurant._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to edit this menu item",
      });
    }

    // Update fields only if provided
    if (name !== undefined) menu.name = name.trim();
    if (description !== undefined) menu.description = description.trim();
    if (price !== undefined) menu.price = Number(price);

    // Upload new image if provided
    if (file) {
      // Delete old image
      if (menu.imagePublicId) {
        await deleteImage(menu.imagePublicId);
      }

      const base64Image = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      const cloudResponse = await uploadImage(base64Image, "suman-food/menus");

      menu.image = cloudResponse.secure_url;
      menu.imagePublicId = cloudResponse.public_id;
    }

    await menu.save();

    // FIXED: Return menu with restaurant as string for frontend compatibility
    const menuResponse = {
      _id: menu._id,
      name: menu.name,
      description: menu.description,
      price: menu.price,
      image: menu.image,
      restaurant: menu.restaurant.toString(),
    };

    return res.status(200).json({
      success: true,
      message: "Menu updated successfully",
      menu: menuResponse,
    });
  } catch (error) {
    console.error("Edit menu error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= DELETE MENU (FIXED) =======================
export const deleteMenu = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Validate menu ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid menu ID",
      });
    }

    const menu = await Menu.findById(id);
    if (!menu) {
      return res.status(404).json({
        success: false,
        message: "Menu not found",
      });
    }

    // Ownership check
    const restaurant = await Restaurant.findOne({ user: req.id });
    if (
      !restaurant ||
      menu.restaurant.toString() !== restaurant._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to delete this menu item",
      });
    }

    // Delete image from Cloudinary
    if (menu.imagePublicId) {
      await deleteImage(menu.imagePublicId);
    }

    // Remove menu reference from restaurant
    restaurant.menus = restaurant.menus.filter(
      (menuId) => menuId.toString() !== id,
    );
    await restaurant.save();

    // Delete menu
    await Menu.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Menu deleted successfully",
    });
  } catch (error) {
    console.error("Delete menu error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= GET MENU BY RESTAURANT =======================
export const getMenuByRestaurant = async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid restaurant ID",
      });
    }

    const menus = await Menu.find({ restaurant: restaurantId }).sort({
      createdAt: -1,
    });

    return res.status(200).json({
      success: true,
      count: menus.length,
      menus,
    });
  } catch (error) {
    console.error("Get menu by restaurant error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= GET ALL MENUS =======================
export const getAllMenus = async (req: Request, res: Response) => {
  try {
    const menus = await Menu.find().sort({ createdAt: -1 }).limit(20); // optional: cap how many show on home page

    return res.status(200).json({
      success: true,
      count: menus.length,
      menus,
    });
  } catch (error) {
    console.error("Get all menus error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
