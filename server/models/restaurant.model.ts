import mongoose, { Document } from "mongoose";

export interface IRestaurant {
  user: mongoose.Schema.Types.ObjectId;
  restaurantName: string;
  city: string;
  country: string;
  deliveryTime: number;
  deliveryPrice: number;
  cuisines: string[];
  imageUrl: string;
  imagePublicId?: string;
  menus: mongoose.Schema.Types.ObjectId[];
  rating?: number;
  ratingCount?: number;
}

export interface IRestaurantDocument extends IRestaurant, Document {
  createdAt: Date;
  updatedAt: Date;
}

const restaurantSchema = new mongoose.Schema<IRestaurantDocument>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
      index: true, // Keep index for performance, remove unique constraint
    },
    restaurantName: {
      type: String,
      required: [true, "Restaurant name is required"],
      trim: true,
      minlength: [2, "Restaurant name must be at least 2 characters"],
      maxlength: [100, "Restaurant name cannot exceed 100 characters"],
    },
    city: {
      type: String,
      required: [true, "City is required"],
      trim: true,
      maxlength: [50, "City name too long"],
    },
    country: {
      type: String,
      required: [true, "Country is required"],
      trim: true,
      maxlength: [50, "Country name too long"],
    },
    deliveryTime: {
      type: Number,
      required: [true, "Delivery time is required"],
      min: [0, "Delivery time cannot be negative"],
      max: [180, "Delivery time cannot exceed 180 minutes"],
    },
    deliveryPrice: {
      type: Number,
      min: [0, "Delivery price cannot be negative"],
      max: [10000, "Delivery price too high"],
      default: 0,
    },
    cuisines: [
      {
        type: String,
        required: [true, "At least one cuisine is required"],
        trim: true,
      },
    ],
    menus: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Menu",
      },
    ],
    imageUrl: {
      type: String,
      required: [true, "Restaurant image is required"],
    },
    imagePublicId: {
      type: String,
      default: "",
    },
    rating: {
      type: Number,
      default: 0,
      min: [0, "Rating cannot be negative"],
      max: [5, "Rating cannot exceed 5"],
    },
    ratingCount: {
      type: Number,
      default: 0,
      min: [0, "Rating count cannot be negative"],
    },
  },
  { timestamps: true },
);

// Text index for search
restaurantSchema.index({
  restaurantName: "text",
  city: "text",
  country: "text",
});

// Compound and single indexes
restaurantSchema.index({ cuisines: 1 });
restaurantSchema.index({ city: 1, country: 1 });
restaurantSchema.index({ deliveryTime: 1 });
restaurantSchema.index({ createdAt: -1 });

export const Restaurant = mongoose.model<IRestaurantDocument>(
  "Restaurant",
  restaurantSchema,
);
