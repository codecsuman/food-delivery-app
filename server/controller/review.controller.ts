import { Request, Response } from "express";
import { Review } from "../models/review.model.js";
import { Restaurant } from "../models/restaurant.model.js";
import mongoose from "mongoose";

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

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid restaurant ID" });
    }

    if (rating < 1 || rating > 5) {
      return res
        .status(400)
        .json({ success: false, message: "Rating must be between 1 and 5" });
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

    // Update restaurant rating
    const allReviews = await Review.find({ restaurant: restaurantId });
    const avgRating =
      allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length;

    await Restaurant.findByIdAndUpdate(restaurantId, {
      rating: Math.round(avgRating * 10) / 10,
      ratingCount: allReviews.length,
    });

    const populatedReview = await Review.findById(review._id)
      .populate("user", "fullname profilePicture")
      .populate("restaurant", "restaurantName");

    return res.status(201).json({
      success: true,
      message: "Review added successfully",
      review: populatedReview,
    });
  } catch (error) {
    console.error("Add review error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= GET REVIEWS BY RESTAURANT =======================
export const getReviewsByRestaurant = async (req: Request, res: Response) => {
  try {
    const { restaurantId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid restaurant ID" });
    }

    const reviews = await Review.find({ restaurant: restaurantId })
      .populate("user", "fullname profilePicture")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json({ success: true, count: reviews.length, reviews });
  } catch (error) {
    console.error("Get reviews error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= GET USER'S REVIEWS =======================
export const getUserReviews = async (req: Request, res: Response) => {
  try {
    const reviews = await Review.find({ user: req.id })
      .populate("restaurant", "restaurantName imageUrl")
      .sort({ createdAt: -1 });

    return res
      .status(200)
      .json({ success: true, count: reviews.length, reviews });
  } catch (error) {
    console.error("Get user reviews error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= DELETE REVIEW =======================
export const deleteReview = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
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

    await Review.findByIdAndDelete(id);

    // Recalculate restaurant rating
    const allReviews = await Review.find({ restaurant: review.restaurant });
    const avgRating =
      allReviews.length > 0
        ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
        : 0;

    await Restaurant.findByIdAndUpdate(review.restaurant, {
      rating: Math.round(avgRating * 10) / 10,
      ratingCount: allReviews.length,
    });

    return res
      .status(200)
      .json({ success: true, message: "Review deleted successfully" });
  } catch (error) {
    console.error("Delete review error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
