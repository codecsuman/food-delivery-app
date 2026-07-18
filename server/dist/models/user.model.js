import mongoose from "mongoose";
const userSchema = new mongoose.Schema({
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
            validator: function (v) {
                if (v === null)
                    return true;
                return /^\d{10}$/.test(v.toString());
            },
            message: "Contact number must be exactly 10 digits",
        },
    },
    address: {
        type: String,
        default: "",
        trim: true,
    },
    city: {
        type: String,
        default: "",
        trim: true,
    },
    country: {
        type: String,
        default: "",
        trim: true,
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
    resetPasswordToken: String,
    resetPasswordTokenExpiresAt: Date,
    verificationToken: String,
    verificationTokenExpiresAt: Date,
}, { timestamps: true });
// REMOVE duplicate email index — unique: true already creates it automatically
// userSchema.index({ email: 1 });  ← DELETED (was causing duplicate index warning)
// Keep these — they don't conflict with unique fields
userSchema.index({ resetPasswordToken: 1 });
userSchema.index({ verificationToken: 1 });
export const User = mongoose.model("User", userSchema);
//# sourceMappingURL=user.model.js.map