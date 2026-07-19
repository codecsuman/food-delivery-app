import mongoose from "mongoose";
const reviewSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User reference is required"],
        index: true,
    },
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Restaurant",
        required: [true, "Restaurant reference is required"],
        index: true,
    },
    menuItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Menu",
        default: null,
    },
    rating: {
        type: Number,
        required: [true, "Rating is required"],
        min: [1, "Rating must be at least 1"],
        max: [5, "Rating cannot exceed 5"],
    },
    comment: {
        type: String,
        required: [true, "Comment is required"],
        trim: true,
        minlength: [3, "Comment must be at least 3 characters"],
        maxlength: [1000, "Comment cannot exceed 1000 characters"],
    },
    userName: {
        type: String,
        required: [true, "User name is required"],
        trim: true,
    },
    userImage: {
        type: String,
        default: "",
    },
}, { timestamps: true });
reviewSchema.index({ restaurant: 1, createdAt: -1 });
reviewSchema.index({ user: 1, createdAt: -1 });
export const Review = mongoose.model("Review", reviewSchema);
