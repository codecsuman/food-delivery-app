import { Request, Response } from "express";
import {
  uploadImage,
  deleteImage,
  getPublicIdFromUrl,
} from "../utils/cloudinary.js";
import { Menu } from "../models/menu.model.js";
import { Restaurant } from "../models/restaurant.model.js";
import { Order } from "../models/order.model.js";
import mongoose from "mongoose";

// ======================= ADD MENU =======================
export const addMenu = async (req: Request, res: Response) => {
  try {
    const { name, description, price } = req.body;
    const file = req.file;

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

    const restaurant = await Restaurant.findOne({ user: req.id });
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message:
          "Restaurant not found. Create a restaurant before adding a menu.",
      });
    }

    const base64Image = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const cloudResponse = await uploadImage(base64Image, "suman-food/menus");

    const menu = await Menu.create({
      name: name.trim(),
      description: description.trim(),
      price: Number(price),
      image: cloudResponse.secure_url,
      imagePublicId: cloudResponse.public_id,
      restaurant: restaurant._id,
    });

    restaurant.menus.push(menu._id as any);
    await restaurant.save();

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

// ======================= EDIT MENU =======================
export const editMenu = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, price } = req.body;
    const file = req.file;

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

    const restaurant = await Restaurant.findOne({ user: req.id });
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    if (menu.restaurant.toString() !== restaurant._id.toString()) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to edit this menu item",
      });
    }

    if (name !== undefined) menu.name = name.trim();
    if (description !== undefined) menu.description = description.trim();
    if (price !== undefined) menu.price = Number(price);

    if (file) {
      if (menu.imagePublicId) {
        await deleteImage(menu.imagePublicId);
      }

      const base64Image = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      const cloudResponse = await uploadImage(base64Image, "suman-food/menus");

      menu.image = cloudResponse.secure_url;
      menu.imagePublicId = cloudResponse.public_id;
    }

    await menu.save();

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

// ======================= DELETE MENU =======================
export const deleteMenu = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

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

    // ✅ CHECK ACTIVE ORDERS: Prevent deleting items in pending/confirmed/preparing orders
    const activeStatuses = [
      "pending",
      "confirmed",
      "preparing",
      "outfordelivery",
    ];
    const activeOrder = await Order.findOne({
      "cartItems.menuId": id,
      status: { $in: activeStatuses },
    });

    if (activeOrder) {
      return res.status(409).json({
        success: false,
        message: "Cannot delete: This item is part of an active order",
        orderId: activeOrder._id,
      });
    }

    if (menu.imagePublicId) {
      await deleteImage(menu.imagePublicId);
    }

    restaurant.menus = restaurant.menus.filter(
      (menuId) => menuId.toString() !== id,
    );
    await restaurant.save();

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

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 50),
    );
    const skip = (page - 1) * limit;

    const [menus, totalCount] = await Promise.all([
      Menu.find({ restaurant: restaurantId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Menu.countDocuments({ restaurant: restaurantId }),
    ]);

    return res.status(200).json({
      success: true,
      count: menus.length,
      totalCount,
      menus,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        limit,
      },
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
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 20),
    );
    const skip = (page - 1) * limit;

    const [menus, totalCount] = await Promise.all([
      Menu.find().sort({ createdAt: -1 }).skip(skip).limit(limit),
      Menu.countDocuments(),
    ]);

    return res.status(200).json({
      success: true,
      count: menus.length,
      totalCount,
      menus,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        limit,
      },
    });
  } catch (error) {
    console.error("Get all menus error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
