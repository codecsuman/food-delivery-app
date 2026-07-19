import { Request, Response } from "express";
import { Restaurant } from "../models/restaurant.model.js";
import { uploadImage, deleteImage } from "../utils/cloudinary.js";
import { Order } from "../models/order.model.js";
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

    const allowedMimes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
    if (!allowedMimes.includes(file.mimetype)) {
      return res.status(400).json({
        success: false,
        message: "Invalid image format. Only JPEG, PNG, and WEBP are allowed",
      });
    }

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

// ======================= GET USER'S RESTAURANTS (multiple) =======================
export const getUserRestaurants = async (req: Request, res: Response) => {
  try {
    const restaurants = await Restaurant.find({ user: req.id })
      .populate("menus")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: restaurants.length,
      restaurants,
    });
  } catch (error) {
    console.error("Get user restaurants error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= GET ALL RESTAURANTS (public) =======================
export const getAllRestaurants = async (_req: Request, res: Response) => {
  try {
    const restaurants = await Restaurant.find()
      .populate("menus")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: restaurants.length,
      data: restaurants,
    });
  } catch (error) {
    console.error("Get all restaurants error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= UPDATE RESTAURANT =======================
export const updateRestaurant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      restaurantName,
      city,
      country,
      deliveryTime,
      deliveryPrice,
      cuisines,
    } = req.body;
    const file = req.file;

    const restaurant = id
      ? await Restaurant.findOne({ _id: id, user: req.id })
      : await Restaurant.findOne({ user: req.id });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found",
      });
    }

    if (restaurantName !== undefined)
      restaurant.restaurantName = restaurantName.trim();
    if (city !== undefined) restaurant.city = city.trim();
    if (country !== undefined) restaurant.country = country.trim();
    if (deliveryTime !== undefined)
      restaurant.deliveryTime = Number(deliveryTime);
    if (deliveryPrice !== undefined)
      restaurant.deliveryPrice = Number(deliveryPrice);

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

    if (file) {
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

// ======================= DELETE RESTAURANT =======================
export const deleteRestaurant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid restaurant ID" });
    }

    const restaurant = await Restaurant.findOne({ _id: id, user: req.id });
    if (!restaurant) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found" });
    }

    const Menu = mongoose.model("Menu");
    await Menu.deleteMany({ restaurant: id });

    if (restaurant.imagePublicId) {
      await deleteImage(restaurant.imagePublicId);
    }

    await Restaurant.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Restaurant deleted successfully",
    });
  } catch (error) {
    console.error("Delete restaurant error:", error);
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
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found" });
    }

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

    const allowedStatuses = [
      "pending",
      "confirmed",
      "preparing",
      "outfordelivery",
      "delivered",
      "cancelled",
    ];
    if (!allowedStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
        allowedStatuses,
      });
    }

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

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

// ======================= SEARCH RESTAURANTS (real-time, with filters) =======================
export const searchRestaurant = async (req: Request, res: Response) => {
  try {
    const searchText = req.params.searchText || "";
    const searchQuery = (req.query.searchQuery as string) || "";
    const selectedCuisines = ((req.query.selectedCuisines as string) || "")
      .split(",")
      .filter((c) => c.trim());
    const city = ((req.query.city as string) || "").trim();
    const minPrice =
      req.query.minPrice !== undefined ? Number(req.query.minPrice) : undefined;
    const maxPrice =
      req.query.maxPrice !== undefined ? Number(req.query.maxPrice) : undefined;

    const Menu = mongoose.model("Menu");
    const andConditions: any[] = [];

    const getMenuMatchingIds = async (
      term: string,
    ): Promise<mongoose.Types.ObjectId[]> => {
      if (!term.trim()) return [];
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

    // Text term (name / city / country / cuisine / menu item name)
    const term = searchText || searchQuery;
    if (term) {
      const orConditions: any[] = [
        { restaurantName: { $regex: term, $options: "i" } },
        { city: { $regex: term, $options: "i" } },
        { country: { $regex: term, $options: "i" } },
        { cuisines: { $regex: term, $options: "i" } },
      ];
      const menuIds = await getMenuMatchingIds(term);
      if (menuIds.length > 0) orConditions.push({ _id: { $in: menuIds } });
      andConditions.push({ $or: orConditions });
    }

    // Explicit location filter (separate from the free-text term)
    if (city) {
      andConditions.push({ city: { $regex: city, $options: "i" } });
    }

    // Cuisine / dish chips — case-insensitive match against restaurant.cuisines
    // OR against menu item names (so "Biryani"/"Burger" work as dish filters too)
    if (selectedCuisines.length > 0) {
      const cuisineRegexes = selectedCuisines.map(
        (c) => new RegExp(`^${c.trim()}$`, "i"),
      );

      const dishMenus = await Menu.find({
        name: { $regex: selectedCuisines.join("|"), $options: "i" },
      }).select("restaurant");
      const dishRestaurantIds = dishMenus
        .map((m: any) => m.restaurant)
        .filter(
          (id: any): id is mongoose.Types.ObjectId =>
            id && mongoose.Types.ObjectId.isValid(id),
        );

      andConditions.push({
        $or: [
          { cuisines: { $in: cuisineRegexes } },
          { _id: { $in: dishRestaurantIds } },
        ],
      });
    }

    // Price range — match restaurants that have at least one menu item in range
    if (minPrice !== undefined || maxPrice !== undefined) {
      const priceFilter: any = {};
      if (minPrice !== undefined && !Number.isNaN(minPrice))
        priceFilter.$gte = minPrice;
      if (maxPrice !== undefined && !Number.isNaN(maxPrice))
        priceFilter.$lte = maxPrice;

      const menusInRange = await Menu.find({ price: priceFilter }).select(
        "restaurant",
      );
      const restaurantIds = menusInRange
        .map((m: any) => m.restaurant)
        .filter(
          (id: any): id is mongoose.Types.ObjectId =>
            id && mongoose.Types.ObjectId.isValid(id),
        );
      andConditions.push({ _id: { $in: restaurantIds } });
    }

    const query = andConditions.length > 0 ? { $and: andConditions } : {};

    const restaurants = await Restaurant.find(query)
      .populate({ path: "menus", select: "name description price image" })
      .select("-imagePublicId")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json({ success: true, count: restaurants.length, data: restaurants });
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
      return res
        .status(400)
        .json({ success: false, message: "Invalid restaurant ID" });
    }

    const restaurant = await Restaurant.findById(id).populate({
      path: "menus",
      options: { sort: { createdAt: -1 } },
    });

    if (!restaurant) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found" });
    }

    return res.status(200).json({ success: true, restaurant });
  } catch (error) {
    console.error("Get single restaurant error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
