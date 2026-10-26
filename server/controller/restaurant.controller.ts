import { Request, Response } from "express";
import { Restaurant } from "../models/restaurant.model.js";
import { uploadImage, deleteImage } from "../utils/cloudinary.js";
import { Order } from "../models/order.model.js";
import { logger } from "../utils/logger.js";
import mongoose from "mongoose";
import { isValidObjectId } from "../utils/objectId.js";
import { refundOrderPayment } from "../services/orderRefunds.js";
import { emitOrderStatus } from "../socketHandlers/orderEvents.js";
import { refreshOrderItemImages } from "../services/orderImages.js";
import {
  paymentEvent,
  paymentStatusOnCancellation,
  paymentStatusAfterRefund,
} from "../services/orderPayments.js";

const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled", "payment_failed"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["outfordelivery", "cancelled"],
  outfordelivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
  payment_failed: [],
};

// ======================= CREATE RESTAURANT =======================
export const createRestaurant = async (req: Request, res: Response) => {
  try {
    const {
      restaurantName,
      address,
      city,
      state,
      country,
      pincode,
      contact,
      alternateContact,
      deliveryTime,
      deliveryPrice,
      cuisines,
      lat,
      lng,
    } = req.body;
    const file = req.file;

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
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      country: country.trim(),
      pincode: pincode.trim(),
      contact: Number(contact),
      alternateContact: alternateContact ? Number(alternateContact) : null,
      deliveryTime: Number(deliveryTime),
      deliveryPrice: deliveryPrice ? Number(deliveryPrice) : 0,
      cuisines: parsedCuisines.map((c: string) => c.trim()),
      imageUrl: cloudResponse.secure_url,
      imagePublicId: cloudResponse.public_id,
      location: {
        type: "Point",
        coordinates: [Number(lng), Number(lat)],
      },
    });

    return res.status(201).json({
      success: true,
      message: "Restaurant created successfully",
      restaurant,
    });
  } catch (error: any) {
    logger.error({ err: error }, "Create restaurant error");
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= GET RESTAURANT (for logged-in user) =======================
export const getRestaurant = async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.query as { restaurantId?: string };

    if (restaurantId && !isValidObjectId(restaurantId)) {
      return res.status(400).json({
        success: false,
        restaurant: null,
        message: "Invalid restaurant ID",
      });
    }

    const restaurant = await Restaurant.findOne(
      restaurantId
        ? { _id: restaurantId, user: req.id }
        : { user: req.id },
    ).populate("menus");

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        restaurant: null,
        message: "Restaurant not found",
      });
    }

    return res.status(200).json({ success: true, restaurant });
  } catch {
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
  } catch {
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
      // Alternate contact is private to the owner.
      .select("-alternateContact")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: restaurants.length,
      restaurants,
    });
  } catch {
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
      address,
      city,
      state,
      country,
      pincode,
      contact,
      alternateContact,
      deliveryTime,
      deliveryPrice,
      cuisines,
      lat,
      lng,
    } = req.body;
    const file = req.file;

    // The client may update via PUT /restaurant/:id (preferred) or PUT
    // /restaurant/ for backwards compatibility. In the latter case resolve the
    // restaurant that belongs to the current user.
    const restaurant = id
      ? await Restaurant.findOne({ _id: id, user: req.id })
      : await Restaurant.findOne({ user: req.id });

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: "Restaurant not found or you are not authorized",
      });
    }

    if (restaurantName !== undefined)
      restaurant.restaurantName = restaurantName.trim();
    if (address !== undefined) restaurant.address = address.trim();
    if (city !== undefined) restaurant.city = city.trim();
    if (state !== undefined) restaurant.state = state.trim();
    if (country !== undefined) restaurant.country = country.trim();
    if (pincode !== undefined) restaurant.pincode = pincode.trim();
    if (contact !== undefined)
      restaurant.contact = contact ? Number(contact) : null;
    if (alternateContact !== undefined)
      restaurant.alternateContact = alternateContact
        ? Number(alternateContact)
        : null;
    if (deliveryTime !== undefined)
      restaurant.deliveryTime = Number(deliveryTime);
    if (deliveryPrice !== undefined)
      restaurant.deliveryPrice = Number(deliveryPrice);

    if (lat !== undefined && lng !== undefined) {
      restaurant.location = {
        type: "Point",
        coordinates: [Number(lng), Number(lat)],
      };
    }

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
        } catch {
          // Failed to delete old image
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
  } catch (error: any) {
    logger.error({ err: error }, "Update restaurant error");
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= DELETE RESTAURANT =======================
export const deleteRestaurant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
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
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= GET RESTAURANT ORDERS =======================
export const getRestaurantOrder = async (req: Request, res: Response) => {
  try {
    // Owners can have multiple restaurants. If a restaurantId is supplied,
    // scope to it; otherwise return orders across all of the owner's
    // restaurants (the previous `findOne` silently ignored every restaurant
    // after the first).
    const requestedRestaurantId = req.query.restaurantId as string | undefined;

    if (requestedRestaurantId && !isValidObjectId(requestedRestaurantId)) {
      return res.status(400).json({ success: false, message: "Invalid restaurant ID" });
    }

    const restaurants = await Restaurant.find(
      requestedRestaurantId
        ? { _id: requestedRestaurantId, user: req.id }
        : { user: req.id },
    ).select("_id");

    if (restaurants.length === 0) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found" });
    }

    const restaurantIds = restaurants.map((r) => r._id);
    const filter = { restaurant: { $in: restaurantIds } };

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 20),
    );
    const skip = (page - 1) * limit;

    const [orders, totalCount] = await Promise.all([
      Order.find(filter)
        .populate(
          "restaurant",
          "restaurantName imageUrl contact alternateContact address city state pincode location",
        )
        .populate("user", "fullname email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    // Repoint stale Cloudinary URLs at the menu's current photo, otherwise the
    // dashboard shows broken item images (and logs a 404 on every visit).
    await refreshOrderItemImages(orders);

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
  } catch {
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
      "payment_failed",
    ];
    if (!allowedStatuses.includes(status.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value",
        allowedStatuses,
      });
    }

    if (!isValidObjectId(orderId)) {
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

    const ownsRestaurant = await Restaurant.exists({
      _id: order.restaurant,
      user: req.id,
    });
    if (!ownsRestaurant) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to update this order",
      });
    }

    const currentStatus = order.status;
    const newStatus = status.toLowerCase();
    const allowedNextStatuses = STATUS_TRANSITIONS[currentStatus] || [];

    if (newStatus === "cancelled" && currentStatus === "cancelled") {
      return res.status(409).json({
        success: false,
        message: "This order is already cancelled",
        currentStatus,
      });
    }

    if (
      !allowedNextStatuses.includes(newStatus) &&
      currentStatus !== newStatus
    ) {
      return res.status(400).json({
        success: false,
        message: `Cannot transition from "${currentStatus}" to "${newStatus}"`,
        currentStatus,
        allowedNextStatuses,
      });
    }

    const isCancelling = newStatus === "cancelled";
    const isDelivered = newStatus === "delivered";
    const initialRefundStatus =
      isCancelling &&
      order.paymentMethod === "stripe" &&
      order.paymentIntentId
        ? "pending"
        : "not_applicable";

    const cancellationPaymentStatus = isCancelling
      ? paymentStatusOnCancellation(order)
      : undefined;

    // One audit entry per transition. COD cash is only "collected" when the
    // restaurant marks the order delivered.
    const auditEvent = isCancelling
      ? paymentEvent(
          initialRefundStatus === "pending"
            ? "refund_requested"
            : "cancellation",
          cancellationPaymentStatus!,
          { amount: order.totalAmount, note: "Cancelled by restaurant" },
        )
      : isDelivered && order.paymentMethod === "cod"
        ? paymentEvent("cod_collected", "paid", { amount: order.totalAmount })
        : null;

    // Conditional update: an auto-cancel worker (or another dashboard tab) may
    // have changed the status since we read it. Losing that race is a conflict,
    // never a silent overwrite.
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: order._id, status: currentStatus },
      {
        $set: {
          status: newStatus,
          ...(isCancelling
            ? {
                cancellationReason: "Cancelled by restaurant",
                cancelledAt: new Date(),
                cancelledBy: "restaurant",
                refundStatus: initialRefundStatus,
                paymentStatus: cancellationPaymentStatus,
              }
            : {}),
          ...(isDelivered && order.paymentMethod === "cod"
            ? { paymentStatus: "paid" }
            : {}),
        },
        ...(auditEvent ? { $push: { paymentEvents: auditEvent } } : {}),
      },
      { new: true },
    );

    if (!updatedOrder) {
      return res.status(409).json({
        success: false,
        message: "This order was updated by another request. Please refresh.",
      });
    }

    if (initialRefundStatus === "pending") {
      const outcome = await refundOrderPayment(
        updatedOrder,
        "requested_by_customer",
      );

      const nextPaymentStatus =
        outcome.status === "not_applicable"
          ? "unpaid"
          : paymentStatusAfterRefund(
              cancellationPaymentStatus ?? "unpaid",
              outcome.status,
            );

      await Order.updateOne(
        { _id: updatedOrder._id },
        {
          $set: {
            refundStatus: outcome.status,
            paymentStatus: nextPaymentStatus,
            ...(outcome.refundId ? { refundId: outcome.refundId } : {}),
          },
          $push: {
            paymentEvents: paymentEvent(
              outcome.status === "refunded"
                ? "refund_succeeded"
                : outcome.status === "failed"
                  ? "refund_failed"
                  : "cancellation",
              nextPaymentStatus,
              {
                amount: updatedOrder.totalAmount,
                ...(outcome.refundId ? { providerId: outcome.refundId } : {}),
                ...(outcome.error
                  ? { note: outcome.error.slice(0, 300) }
                  : {}),
              },
            ),
          },
        },
      );

      updatedOrder.refundStatus = outcome.status;
      updatedOrder.paymentStatus = nextPaymentStatus;
      if (outcome.refundId) updatedOrder.refundId = outcome.refundId;
    }

    // Push the change to the customer's tracking page and every other
    // dashboard tab. Without this the customer only saw the new status after
    // the 10 s polling fallback (or a manual refresh).
    emitOrderStatus({
      orderId: updatedOrder._id.toString(),
      restaurantId: updatedOrder.restaurant.toString(),
      status: updatedOrder.status,
      totalAmount: updatedOrder.totalAmount,
      cancellationReason: updatedOrder.cancellationReason,
      cancelledAt: updatedOrder.cancelledAt,
      cancelledBy: updatedOrder.cancelledBy,
      refundStatus: updatedOrder.refundStatus,
      paymentStatus: updatedOrder.paymentStatus,
    });

    return res.status(200).json({
      success: true,
      status: updatedOrder.status,
      order: updatedOrder,
      message: "Order status updated successfully",
    });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= SEARCH RESTAURANTS =======================
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
    const andConditions: mongoose.FilterQuery<typeof Restaurant>[] = [];

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

    const term = searchText || searchQuery;
    if (term) {
      const orConditions: mongoose.FilterQuery<typeof Restaurant>[] = [
        { restaurantName: { $regex: term, $options: "i" } },
        { city: { $regex: term, $options: "i" } },
        { country: { $regex: term, $options: "i" } },
        { cuisines: { $regex: term, $options: "i" } },
      ];
      const menuIds = await getMenuMatchingIds(term);
      if (menuIds.length > 0) orConditions.push({ _id: { $in: menuIds } });
      andConditions.push({ $or: orConditions });
    }

    if (city) {
      andConditions.push({ city: { $regex: city, $options: "i" } });
    }

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
      .select("-imagePublicId -alternateContact")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json({ success: true, count: restaurants.length, restaurants });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= GET FILTER OPTIONS =======================
export const getFilterOptions = async (_req: Request, res: Response) => {
  try {
    const Menu = mongoose.model("Menu");

    const [cuisines, dishes] = await Promise.all([
      Restaurant.distinct("cuisines"),
      Menu.distinct("name"),
    ]);

    return res.status(200).json({
      success: true,
      cuisines: cuisines.filter(Boolean).sort(),
      dishes: dishes.filter(Boolean).sort(),
    });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= GET SINGLE RESTAURANT =======================
export const getSingleRestaurant = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid restaurant ID" });
    }

    const restaurant = await Restaurant.findById(id)
      .populate({
        path: "menus",
        options: { sort: { createdAt: -1 } },
      })
      // Alternate contact is only exposed through owner-authorized endpoints.
      .select("-alternateContact");

    if (!restaurant) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found" });
    }

    return res.status(200).json({ success: true, restaurant });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
