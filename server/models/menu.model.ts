import mongoose, { Document } from "mongoose";

export interface IMenu {
  name: string;
  description: string;
  price: number;
  image: string;
  imagePublicId?: string;
  restaurant: mongoose.Schema.Types.ObjectId;
  popular?: boolean;
  orderCount?: number;
}

export interface IMenuDocument extends IMenu, Document {
  createdAt: Date;
  updatedAt: Date;
}

const menuSchema = new mongoose.Schema<IMenuDocument>(
  {
    name: {
      type: String,
      required: [true, "Menu item name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
      minlength: [5, "Description must be at least 5 characters"],
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    price: {
      type: Number,
      required: [true, "Price is required"],
      min: [0, "Price cannot be negative"],
      max: [100000, "Price cannot exceed 100,000"],
    },
    image: {
      type: String,
      required: [true, "Menu image is required"],
    },
    imagePublicId: {
      type: String,
      default: "",
    },
    popular: {
      type: Boolean,
      default: false,
    },
    orderCount: {
      type: Number,
      default: 0,
      min: [0, "Order count cannot be negative"],
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: [true, "Restaurant reference is required"],
    },
  },
  { timestamps: true },
);

// Compound index for search by name + restaurant
menuSchema.index({ name: 1, restaurant: 1 });
menuSchema.index({ name: "text", description: "text" });
menuSchema.index({ price: 1 });
menuSchema.index({ restaurant: 1 });
menuSchema.index({ popular: 1 });
menuSchema.index({ orderCount: -1 });

export const Menu = mongoose.model<IMenuDocument>("Menu", menuSchema);
