import mongoose, { Document } from "mongoose";

type DeliveryDetails = {
  email: string;
  name: string;
  address: string;
  city: string;
};

type CartItems = {
  menuId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "outfordelivery"
  | "delivered"
  | "payment_failed";

export interface IOrder extends Document {
  user: mongoose.Schema.Types.ObjectId;
  restaurant: mongoose.Schema.Types.ObjectId;
  deliveryDetails: DeliveryDetails;
  cartItems: CartItems[];
  totalAmount: number;
  status: OrderStatus;
  paymentIntentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderSchema = new mongoose.Schema<IOrder>(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User reference is required"],
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: [true, "Restaurant reference is required"],
    },
    deliveryDetails: {
      email: {
        type: String,
        required: [true, "Email is required"],
        lowercase: true,
      },
      name: { type: String, required: [true, "Name is required"], trim: true },
      address: {
        type: String,
        required: [true, "Address is required"],
        trim: true,
      },
      city: { type: String, required: [true, "City is required"], trim: true },
    },
    cartItems: [
      {
        menuId: { type: String, required: [true, "Menu ID is required"] },
        name: {
          type: String,
          required: [true, "Item name is required"],
          trim: true,
        },
        image: { type: String, required: [true, "Item image is required"] },
        price: {
          type: Number,
          required: [true, "Price is required"],
          min: [0, "Price cannot be negative"],
        },
        quantity: {
          type: Number,
          required: [true, "Quantity is required"],
          min: [1, "Quantity must be at least 1"],
        },
      },
    ],
    totalAmount: {
      type: Number,
      required: [true, "Total amount is required"],
      min: [0, "Total amount cannot be negative"],
      default: 0,
    },
    status: {
      type: String,
      enum: {
        values: [
          "pending",
          "confirmed",
          "preparing",
          "outfordelivery",
          "delivered",
          "payment_failed",
        ],
        message: "Status {VALUE} is not valid",
      },
      required: true,
      default: "pending",
    },
    paymentIntentId: {
      type: String,
      default: "",
    },
  },
  { timestamps: true },
);

orderSchema.index({ user: 1 });
orderSchema.index({ restaurant: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ user: 1, status: 1 });

export const Order = mongoose.model<IOrder>("Order", orderSchema);
