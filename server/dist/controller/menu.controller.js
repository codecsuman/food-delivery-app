import { uploadImage, deleteImage, } from "../utils/cloudinary.js";
import { Menu } from "../models/menu.model.js";
import { Restaurant } from "../models/restaurant.model.js";
import mongoose from "mongoose";
// ======================= ADD MENU =======================
export const addMenu = async (req, res) => {
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
                message: "Restaurant not found. Create a restaurant before adding a menu.",
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
        restaurant.menus.push(menu._id);
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
    }
    catch (error) {
        console.error("Add menu error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};
// ======================= EDIT MENU =======================
export const editMenu = async (req, res) => {
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
        if (name !== undefined)
            menu.name = name.trim();
        if (description !== undefined)
            menu.description = description.trim();
        if (price !== undefined)
            menu.price = Number(price);
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
    }
    catch (error) {
        console.error("Edit menu error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};
// ======================= DELETE MENU =======================
export const deleteMenu = async (req, res) => {
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
        if (!restaurant ||
            menu.restaurant.toString() !== restaurant._id.toString()) {
            return res.status(403).json({
                success: false,
                message: "Not authorized to delete this menu item",
            });
        }
        if (menu.imagePublicId) {
            await deleteImage(menu.imagePublicId);
        }
        restaurant.menus = restaurant.menus.filter((menuId) => menuId.toString() !== id);
        await restaurant.save();
        await Menu.findByIdAndDelete(id);
        return res.status(200).json({
            success: true,
            message: "Menu deleted successfully",
        });
    }
    catch (error) {
        console.error("Delete menu error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};
// ======================= GET MENU BY RESTAURANT =======================
export const getMenuByRestaurant = async (req, res) => {
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
    }
    catch (error) {
        console.error("Get menu by restaurant error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};
// ======================= GET ALL MENUS =======================
export const getAllMenus = async (req, res) => {
    try {
        const menus = await Menu.find().sort({ createdAt: -1 }).limit(20);
        return res.status(200).json({
            success: true,
            count: menus.length,
            menus,
        });
    }
    catch (error) {
        console.error("Get all menus error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};
//# sourceMappingURL=menu.controller.js.map