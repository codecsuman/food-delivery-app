import { Request, Response } from "express";
import { Review } from "../models/review.model.js";
import { Restaurant } from "../models/restaurant.model.js";
import { Order } from "../models/order.model.js";
import mongoose from "mongoose";
import { isValidObjectId } from "../utils/objectId.js";

// ======================= ADD REVIEW =======================
export const addReview = async (req: Request, res: Response) => {
  try {
    const { restaurantId, menuItemId, rating, comment } = req.body;

    if (!restaurantId || !rating || !comment) {
      return res.status(400).json({
        success: false,
        message: "Restaurant ID, rating, and comment are required",
      });
    }

    if (!isValidObjectId(restaurantId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid restaurant ID" });
    }

    if (rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ success: false, message: "Rating must be between 1 and 5" });
    }

    // SECURITY FIX: Verify user has actually ordered from this restaurant and it was delivered
    const hasOrdered = await Order.findOne({
      user: req.id,
      restaurant: restaurantId,
      status: "delivered",
    });

    if (!hasOrdered) {
      return res.status(403).json({
        success: false,
        message: "You can only review restaurants you have ordered from and received delivery from",
      });
    }

    const existingReview = await Review.findOne({
      user: req.id,
      restaurant: restaurantId,
      menuItem: menuItemId || null,
    });

    if (existingReview) {
      return res.status(409).json({
        success: false,
        message: "You have already reviewed this item",
      });
    }

    const review = await Review.create({
      user: req.id,
      restaurant: restaurantId,
      menuItem: menuItemId || null,
      rating,
      comment: comment.trim(),
      userName: req.body.userName || "Anonymous",
      userImage: req.body.userImage || "",
    });

    // ✅ ATOMIC RATING UPDATE: Use aggregation to avoid race condition
    const ratingResult = await Review.aggregate([
      {
        $match: {
          restaurant: new mongoose.Types.ObjectId(restaurantId as string),
        },
      },
      {
        $group: {
          _id: "$restaurant",
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    const avgRating = ratingResult.length > 0 ? ratingResult[0].avgRating : 0;
    const count = ratingResult.length > 0 ? ratingResult[0].count : 0;

    await Restaurant.findByIdAndUpdate(restaurantId, {
      rating: Math.round(avgRating * 10) / 10,
      ratingCount: count,
    });

    const populatedReview = await Review.findById(review._id)
      .populate("user", "fullname profilePicture")
      .populate("restaurant", "restaurantName");

    return res.status(201).json({
      success: true,
      message: "Review added successfully",
      review: populatedReview,
    });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= GET REVIEWS BY RESTAURANT =======================
export const getReviewsByRestaurant = async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;

    if (!isValidObjectId(restaurantId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid restaurant ID" });
    }

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit as string) || 20),
    );
    const skip = (page - 1) * limit;

    const [reviews, totalCount] = await Promise.all([
      Review.find({ restaurant: restaurantId })
        .populate("user", "fullname profilePicture")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments({ restaurant: restaurantId }),
    ]);

    return res.status(200).json({
      success: true,
      count: reviews.length,
      totalCount,
      reviews,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        limit,
      },
    });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= GET USER'S REVIEWS =======================
export const getUserReviews = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit as string) || 20),
    );
    const skip = (page - 1) * limit;

    const [reviews, totalCount] = await Promise.all([
      Review.find({ user: req.id })
        .populate("restaurant", "restaurantName imageUrl")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Review.countDocuments({ user: req.id }),
    ]);

    return res.status(200).json({
      success: true,
      count: reviews.length,
      totalCount,
      reviews,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        limit,
      },
    });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= DELETE REVIEW =======================
export const deleteReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid review ID" });
    }

    const review = await Review.findOne({ _id: id, user: req.id });
    if (!review) {
      return res
        .status(404)
        .json({ success: false, message: "Review not found" });
    }

    const restaurantId = review.restaurant;
    await Review.findByIdAndDelete(id);

    // ✅ ATOMIC RATING UPDATE: Use aggregation after delete
    const ratingResult = await Review.aggregate([
      {
        $match: {
          restaurant: new mongoose.Types.ObjectId(String(restaurantId)),
        },
      },
      {
        $group: {
          _id: "$restaurant",
          avgRating: { $avg: "$rating" },
          count: { $sum: 1 },
        },
      },
    ]);

    const avgRating = ratingResult.length > 0 ? ratingResult[0].avgRating : 0;
    const count = ratingResult.length > 0 ? ratingResult[0].count : 0;

    await Restaurant.findByIdAndUpdate(restaurantId, {
      rating: Math.round(avgRating * 10) / 10,
      ratingCount: count,
    });

    return res
      .status(200)
      .json({ success: true, message: "Review deleted successfully" });
  } catch {
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
