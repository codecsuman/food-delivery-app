import { describe, it, expect } from "vitest";
import mongoose from "mongoose";
import { Menu } from "../models/menu.model.js";
import { Order } from "../models/order.model.js";
import { refreshOrderItemImages } from "../services/orderImages.js";

const makeMenu = (image: string) =>
  Menu.create({
    name: "Snapshot Dish",
    description: "Used by the order image refresh test",
    price: 150,
    image,
    restaurant: new mongoose.Types.ObjectId(),
    isAvailable: true,
  });

const makeOrder = (menuId: string, image: string) =>
  Order.create({
    user: new mongoose.Types.ObjectId(),
    restaurant: new mongoose.Types.ObjectId(),
    deliveryDetails: {
      email: "customer@example.com",
      name: "Test Customer",
      address: "1 Test Street",
      city: "Kolkata",
      state: "West Bengal",
      country: "India",
      pincode: "700001",
    },
    cartItems: [
      {
        menuId,
        name: "Snapshot Dish",
        image,
        price: 150,
        quantity: 1,
      },
    ],
    subtotal: 150,
    deliveryFee: 0,
    totalAmount: 150,
    status: "confirmed",
    paymentMethod: "cod",
  });

describe("Order item image refresh", () => {
  it("repoints a stale snapshot at the menu's current image", async () => {
    const menu = await makeMenu("https://cdn.example.com/new-dish.jpg");
    const order = await makeOrder(
      menu._id.toString(),
      "https://res.cloudinary.com/demo/deleted-asset.jpg",
    );

    await refreshOrderItemImages([order]);

    expect(order.cartItems[0].image).toBe("https://cdn.example.com/new-dish.jpg");
  });

  it("leaves the snapshot alone when the menu no longer exists", async () => {
    const missingMenuId = new mongoose.Types.ObjectId().toString();
    const order = await makeOrder(missingMenuId, "https://cdn.example.com/gone.jpg");

    await refreshOrderItemImages([order]);

    expect(order.cartItems[0].image).toBe("https://cdn.example.com/gone.jpg");
  });

  it("does not touch an item that is already current", async () => {
    const menu = await makeMenu("https://cdn.example.com/current.jpg");
    const order = await makeOrder(menu._id.toString(), "https://cdn.example.com/current.jpg");

    await refreshOrderItemImages([order]);

    expect(order.cartItems[0].image).toBe("https://cdn.example.com/current.jpg");
  });
});
