import mongoose from "mongoose";
const restaurantSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: [true, "User reference is required"],
        unique: true, // This automatically creates an index - NO need for index: true
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
}, { timestamps: true });
// Text index for search
restaurantSchema.index({
    restaurantName: "text",
    city: "text",
    country: "text",
});
// Compound and single indexes (user index is already created by unique: true above)
restaurantSchema.index({ cuisines: 1 });
restaurantSchema.index({ city: 1, country: 1 });
restaurantSchema.index({ deliveryTime: 1 });
restaurantSchema.index({ createdAt: -1 });
export const Restaurant = mongoose.model("Restaurant", restaurantSchema);
//# sourceMappingURL=restaurant.model.js.map