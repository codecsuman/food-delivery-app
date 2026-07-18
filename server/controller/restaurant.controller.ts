import { Request, Response } from "express";
import { Restaurant } from "../models/restaurant.model";
import { uploadImage, deleteImage } from "../utils/cloudinary";
import { Order } from "../models/order.model";
import mongoose from "mongoose";

// ======================= CREATE RESTAURANT =======================
export const createRestaurant = async (req: Request, res: Response) => {
  try {
    const {
      restaurantName,
      city,
      country,
      deliveryTime,
      deliveryPrice,
      cuisines,
    } = req.body;
    const file = req.file;

    // Check if user already has a restaurant
    const existing = await Restaurant.findOne({ user: req.id });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "Restaurant already exists for this user",
      });
    }

    // Validate required fields
    if (!restaurantName || !city || !country || !deliveryTime || !cuisines) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "Restaurant image is required",
      });
    }

    // Validate image type
    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowedMimes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Invalid image format. Only JPEG, PNG, and WEBP are allowed",
      });
    }

    // Parse cuisines safely
    let parsedCuisines: string[];
    try {
      parsedCuisines = Array.isArray(cuisines)
        ? cuisines
        : JSON.parse(cuisines);
      if (!Array.isArray(parsedCuisines)) throw new Error();
    } catch {
      return res.status(400).json({
        success: false,
        message: "Cuisines must be a valid array",
      });
    }

    // Upload image
    const base64Image = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
    const cloudResponse = await uploadImage(
      base64Image,
      "suman-food/restaurants",
    );

    const restaurant = await Restaurant.create({
      user: req.id,
      restaurantName: restaurantName.trim(),
      city: city.trim(),
      country: country.trim(),
      deliveryTime: Number(deliveryTime),
      deliveryPrice: deliveryPrice ? Number(deliveryPrice) : 0,
      cuisines: parsedCuisines.map((c: string) => c.trim()),
      imageUrl: cloudResponse.secure_url,
      imagePublicId: cloudResponse.public_id,
    });

    return res.status(201).json({
      success: true,
      message: "Restaurant created successfully",
      restaurant,
    });
  } catch (error) {
    console.error("Create restaurant error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= GET RESTAURANT (for logged-in user) =======================
export const getRestaurant = async (req: Request, res: Response) => {
  try {
    const restaurant = await Restaurant.findOne({ user: req.id }).populate(
      "menus",
    );

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        restaurant: null,
        message: "Restaurant not found",
      });
    }

    return res.status(200).json({ success: true, restaurant });
  } catch (error) {
    console.error("Get restaurant error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= UPDATE RESTAURANT =======================
export const updateRestaurant = async (req: Request, res: Response) => {
  try {
    const {
      restaurantName,
      city,
      country,
      deliveryTime,
      deliveryPrice,
      cuisines,
    } = req.body;
    const file = req.file;

    const restaurant = await Restaurant.findOne({ user: req.id });
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Update fields only if provided
    if (restaurantName !== undefined)
      restaurant.restaurantName = restaurantName.trim();
    if (city !== undefined) restaurant.city = city.trim();
    if (country !== undefined) restaurant.country = country.trim();
    if (deliveryTime !== undefined)
      restaurant.deliveryTime = Number(deliveryTime);
    if (deliveryPrice !== undefined)
      restaurant.deliveryPrice = Number(deliveryPrice);

    // Parse cuisines if provided
    if (cuisines) {
      try {
        const parsedCuisines = Array.isArray(cuisines)
          ? cuisines
          : JSON.parse(cuisines);
        if (!Array.isArray(parsedCuisines)) throw new Error();
        restaurant.cuisines = parsedCuisines.map((c: string) => c.trim());
      } catch {
        return res.status(400).json({
          success: false,
          message: "Cuisines must be a valid array",
        });
      }
    }

    // Upload new image if provided
    if (file) {
      // Validate image type
      const allowedMimes = [
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/jpg",
      ];
      if (!allowedMimes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          message: "Invalid image format. Only JPEG, PNG, and WEBP are allowed",
        });
      }

      // Delete old image (don't fail if already deleted)
      if (restaurant.imagePublicId) {
        try {
          await deleteImage(restaurant.imagePublicId);
        } catch (deleteError) {
          console.warn("Failed to delete old image:", deleteError);
        }
      }

      const base64Image = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
      const cloudResponse = await uploadImage(
        base64Image,
        "suman-food/restaurants",
      );

      restaurant.imageUrl = cloudResponse.secure_url;
      restaurant.imagePublicId = cloudResponse.public_id;
    }

    await restaurant.save();

    // Re-fetch with populated menus to return complete data
    const updatedRestaurant = await Restaurant.findById(
      restaurant._id,
    ).populate("menus");

    return res.status(200).json({
      success: true,
      message: "Restaurant updated successfully",
      restaurant: updatedRestaurant,
    });
  } catch (error) {
    console.error("Update restaurant error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= GET RESTAURANT ORDERS =======================
export const getRestaurantOrder = async (req: Request, res: Response) => {
  try {
    const restaurant = await Restaurant.findOne({ user: req.id });
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    // Optional pagination
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 20),
    );
    const skip = (page - 1) * limit;

    const [orders, totalCount] = await Promise.all([
      Order.find({ restaurant: restaurant._id })
        .populate("restaurant", "restaurantName imageUrl")
        .populate("user", "fullname email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments({ restaurant: restaurant._id }),
    ]);

    return res.status(200).json({
      success: true,
      orders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit,
      },
    });
  } catch (error) {
    console.error("Get restaurant orders error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= UPDATE ORDER STATUS =======================
export const updateOrderStatus = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Validate status against Order model enum
    const allowedStatuses = [
      "pending",
      "confirmed",
      "preparing",
      "outfordelivery",
      "delivered",
    ];
    if (!allowedStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
        allowedStatuses,
      });
    }

    // Validate orderId
    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Verify ownership
    const restaurant = await Restaurant.findOne({ user: req.id });
    if (
      !restaurant ||
      order.restaurant.toString() !== restaurant._id.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this order",
      });
    }

    order.status = status.toLowerCase();
    await order.save();

    return res.status(200).json({
      success: true,
      status: order.status,
      message: "Order status updated successfully",
    });
  } catch (error) {
    console.error("Update order status error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= SEARCH RESTAURANTS (FIXED & OPTIMIZED) =======================
export const searchRestaurant = async (req: Request, res: Response) => {
  try {
    const searchText = req.params.searchText || "";
    const searchQuery = (req.query.searchQuery as string) || "";
    const selectedCuisines = ((req.query.selectedCuisines as string) || "")
      .split(",")
      .filter((cuisine) => cuisine.trim());

    const andConditions: any[] = [];
    const searchedTerms = new Set<string>();

    // Helper to get menu-matching restaurant IDs
    const getMenuMatchingIds = async (
      term: string,
    ): Promise<mongoose.Types.ObjectId[]> => {
      if (!term.trim()) return [];

      const Menu = mongoose.model("Menu");
      const matchingMenus = await Menu.find({
        name: { $regex: term, $options: "i" },
      }).select("restaurant");

      return matchingMenus
        .map((menu: any) => menu.restaurant)
        .filter(
          (id: any): id is mongoose.Types.ObjectId =>
            id && mongoose.Types.ObjectId.isValid(id),
        );
    };

    // Build search conditions for searchText
    if (searchText) {
      searchedTerms.add(searchText);
      const orConditions: any[] = [
        { restaurantName: { $regex: searchText, $options: "i" } },
        { city: { $regex: searchText, $options: "i" } },
        { country: { $regex: searchText, $options: "i" } },
        { cuisines: { $regex: searchText, $options: "i" } },
      ];

      const menuIds = await getMenuMatchingIds(searchText);
      if (menuIds.length > 0) {
        orConditions.push({ _id: { $in: menuIds } });
      }

      andConditions.push({ $or: orConditions });
    }

    // Build search conditions for searchQuery (only if different from searchText)
    if (searchQuery && searchQuery !== searchText) {
      const orConditions: any[] = [
        { restaurantName: { $regex: searchQuery, $options: "i" } },
        { cuisines: { $regex: searchQuery, $options: "i" } },
      ];

      const menuIds = await getMenuMatchingIds(searchQuery);
      if (menuIds.length > 0) {
        orConditions.push({ _id: { $in: menuIds } });
      }

      andConditions.push({ $or: orConditions });
    }

    // Filter by cuisines
    if (selectedCuisines.length > 0) {
      andConditions.push({ cuisines: { $in: selectedCuisines } });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    // Populate menus so users can see available items
    const restaurants = await Restaurant.find(query)
      .populate({
        path: "menus",
        select: "name description price image",
      })
      .select("-imagePublicId");

    return res.status(200).json({
      success: true,
      count: restaurants.length,
      data: restaurants,
    });
  } catch (error) {
    console.error("Search restaurant error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= GET SINGLE RESTAURANT (public) =======================
export const getSingleRestaurant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid restaurant ID",
      });
    }

    const restaurant = await Restaurant.findById(id).populate({
      path: "menus",
      options: { sort: { createdAt: -1 } },
    });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    return res.status(200).json({
      success: true,
      restaurant,
    });
  } catch (error) {
    console.error("Get single restaurant error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
