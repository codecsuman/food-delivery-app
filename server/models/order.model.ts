import mongoose, { Document } from "mongoose";

type DeliveryDetails = {
  email: string;
  name: string;
  address: string;
  city: string;
  state?: string;
  country?: string;
  pincode: string;
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
  subtotal: number;
  deliveryFee: number;
  deliveryBaseFee: number;
  deliveryExtraFee: number;
  deliveryDistanceKm: number;
  estimatedDeliveryMinutes: number;
  totalAmount: number;
  status: OrderStatus;
  paymentIntentId?: string;
  paymentMethod?: "stripe" | "cod";
  // Contact snapshot captured when the order is placed. Historical orders keep
  // the phone number that was valid at checkout even if the restaurant later
  // edits its profile.
  restaurantName?: string;
  restaurantContact?: number | null;
  restaurantAlternateContact?: number | null;
  // Client-generated key that makes retried checkout requests idempotent.
  idempotencyKey?: string;
  cancellationReason?: string;
  cancelledAt?: Date;
  cancelledBy?: "customer" | "restaurant" | "system";
  refundStatus?: "not_applicable" | "pending" | "refunded" | "failed";
  refundId?: string;
  currentEta?: number; // FIX: added — written by trackingSocket.ts
  currentDistance?: number; // FIX: added — written by trackingSocket.ts
  // Latest known driver position, stored on every accepted update so a
  // customer opening the tracking page sees the current location immediately
  // instead of waiting for the next socket event (or seeing the restaurant).
  driverLocation?: [number, number]; // [lng, lat]
  driverLocationUpdatedAt?: Date;
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
      state: { type: String, trim: true, default: "" },
      country: { type: String, trim: true, default: "" },
      pincode: {
        type: String,
        trim: true,
        match: [/^\d{6}$/, "Pincode must be exactly 6 digits"],
        default: "",
      },
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
        image: { type: String, default: "" },
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
    // Server-calculated price breakdown stored with the order so the customer,
    // restaurant and payment provider all show the same numbers.
    subtotal: { type: Number, min: [0, "Subtotal cannot be negative"], default: 0 },
    deliveryFee: { type: Number, min: [0, "Delivery fee cannot be negative"], default: 0 },
    deliveryBaseFee: { type: Number, min: 0, default: 0 },
    deliveryExtraFee: { type: Number, min: 0, default: 0 },
    deliveryDistanceKm: { type: Number, min: 0, default: 0 },
    estimatedDeliveryMinutes: { type: Number, min: 0, default: 0 },
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
    restaurantName: { type: String, trim: true, maxlength: 100 },
    restaurantContact: { type: Number, default: null },
    restaurantAlternateContact: { type: Number, default: null },
    // Sparse unique index below: only orders that supply a key participate, so
    // older orders and anonymous checkout attempts are unaffected.
    idempotencyKey: {
      type: String,
      trim: true,
      maxlength: [128, "Idempotency key is too long"],
    },
    cancellationReason: { type: String, trim: true, maxlength: 500 },
    cancelledAt: { type: Date },
    cancelledBy: {
      type: String,
      enum: {
        values: ["customer", "restaurant", "system"],
        message: "Cancellation source {VALUE} is not valid",
      },
    },
    refundStatus: {
      type: String,
      enum: {
        values: ["not_applicable", "pending", "refunded", "failed"],
        message: "Refund status {VALUE} is not valid",
      },
    },
    refundId: { type: String, trim: true },
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
    driverLocation: {
      type: [Number], // [lng, lat]
      default: undefined,
    },
    driverLocationUpdatedAt: {
      type: Date,
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
// Idempotent checkout: one order per (user, idempotencyKey). The partial
// filter keeps the index valid for every order created before this feature.
orderSchema.index(
  { user: 1, idempotencyKey: 1 },
  {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: "string" } },
  },
);
// Efficient lookup for the restart-safe auto-cancellation worker.
orderSchema.index({ status: 1, createdAt: 1 });

export const Order = mongoose.model<IOrder>("Order", orderSchema);
