import mongoose, { Document, Model } from "mongoose";

export interface IUser {
  fullname: string;
  email: string;
  password: string;
  contact: number;
  alternateContact: number;
  address: string;
  pincode: string;
  city: string;
  state: string;
  country: string;
  latitude: number | null;
  longitude: number | null;
  profilePicture: string;
  admin: boolean;
  lastLogin?: Date;
  isVerified?: boolean;
  verificationToken?: string;
  verificationTokenExpiresAt?: Date;
}

export interface IUserDocument extends IUser, Document {
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<IUserDocument>(
  {
    fullname: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [50, "Name cannot exceed 50 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true, // ← This already creates an index automatically
      lowercase: true,
      trim: true,
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Please enter a valid email address",
      ],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      select: false,
      minlength: [6, "Password must be at least 6 characters"],
    },
    contact: {
      type: Number,
      default: null,
      validate: {
        validator: function (v: number | null) {
          if (v === null) return true;
          return /^\d{10}$/.test(v.toString());
        },
        message: "Contact number must be exactly 10 digits",
      },
    },
    alternateContact: {
      type: Number,
      default: null,
      validate: {
        validator: function (v: number | null) {
          if (v === null) return true;
          return /^\d{10}$/.test(v.toString());
        },
        message: "Alternate contact must be exactly 10 digits",
      },
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    pincode: {
      type: String,
      default: "",
      trim: true,
      maxlength: 6,
    },
    city: {
      type: String,
      default: "",
      trim: true,
    },
    state: {
      type: String,
      default: "",
      trim: true,
    },
    country: {
      type: String,
      default: "",
      trim: true,
    },
    // Last confirmed home/delivery position for this customer. Kept in sync
    // with the saved address when the profile is saved from GPS or the map
    // picker. `null` means "not pinned yet" so checkout can geocode the text.
    latitude: {
      type: Number,
      default: null,
      min: [-90, "Latitude must be between -90 and 90"],
      max: [90, "Latitude must be between -90 and 90"],
    },
    longitude: {
      type: Number,
      default: null,
      min: [-180, "Longitude must be between -180 and 180"],
      max: [180, "Longitude must be between -180 and 180"],
    },
    profilePicture: {
      type: String,
      default: "",
    },
    admin: {
      type: Boolean,
      default: false,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    verificationToken: String,
    verificationTokenExpiresAt: Date,
  },
  { timestamps: true },
);

// REMOVE duplicate email index — unique: true already creates it automatically
// userSchema.index({ email: 1 });  ← DELETED (was causing duplicate index warning)

// Keep this — it doesn't conflict with unique fields
userSchema.index({ verificationToken: 1 });

export const User: Model<IUserDocument> = mongoose.model<IUserDocument>(
  "User",
  userSchema,
);
