import mongoose, { Document } from "mongoose";

type DeliveryDetails = {
  email: string;
  name: string;
  address: string;
  city: string;
  lat?: number;
  lng?: number;
};

type CartItems = {
  menuId: string;
  name: string;
  image: string;
  price: number;
  quantity: number;
};

// FIX: new type for trackingHistory entries written by trackingSocket.ts
type TrackingHistoryEntry = {
  location: [number, number]; // [lng, lat]
  status: string;
  timestamp: Date;
};

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "preparing"
  | "outfordelivery"
  | "delivered"
  | "payment_failed"
  | "cancelled";

export interface IOrder extends Document {
  user: mongoose.Schema.Types.ObjectId;
  restaurant: mongoose.Schema.Types.ObjectId;
  deliveryDetails: DeliveryDetails;
  cartItems: CartItems[];
  totalAmount: number;
  status: OrderStatus;
  paymentIntentId?: string;
  paymentMethod?: "stripe" | "cod";
  currentEta?: number; // FIX: added — written by trackingSocket.ts
  currentDistance?: number; // FIX: added — written by trackingSocket.ts
  trackingHistory?: TrackingHistoryEntry[]; // FIX: added — written by trackingSocket.ts
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
      lat: { type: Number },
      lng: { type: Number },
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
          "cancelled",
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
    paymentMethod: {
      type: String,
      enum: {
        values: ["stripe", "cod"],
        message: "Payment method {VALUE} is not valid",
      },
      default: "stripe",
    },
    // FIX: added — these three fields were being written by trackingSocket.ts
    // but never declared in the schema, so Mongoose silently dropped them.
    currentEta: {
      type: Number,
      default: null,
    },
    currentDistance: {
      type: Number,
      default: null,
    },
    trackingHistory: [
      {
        location: {
          type: [Number], // [lng, lat]
          required: true,
        },
        status: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true },
);

orderSchema.index({ user: 1 });
orderSchema.index({ restaurant: 1 });
orderSchema.index({ status: 1 });
orderSchema.index({ createdAt: -1 });
orderSchema.index({ user: 1, status: 1 });
orderSchema.index({ paymentMethod: 1 });

export const Order = mongoose.model<IOrder>("Order", orderSchema);
