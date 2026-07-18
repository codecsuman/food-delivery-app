import mongoose from "mongoose";
const menuSchema = new mongoose.Schema({
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
    restaurant: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Restaurant",
        required: [true, "Restaurant reference is required"],
        // REMOVED: index: true (we use schema.index() below instead)
    },
}, { timestamps: true });
// Compound index for search by name + restaurant
menuSchema.index({ name: 1, restaurant: 1 });
menuSchema.index({ name: "text", description: "text" });
menuSchema.index({ price: 1 });
menuSchema.index({ restaurant: 1 }); // Single index for restaurant lookups
export const Menu = mongoose.model("Menu", menuSchema);
//# sourceMappingURL=menu.model.js.map