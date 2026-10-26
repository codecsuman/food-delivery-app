import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Restaurant } from "../models/restaurant.model.js";
import { Menu } from "../models/menu.model.js";
import { Order } from "../models/order.model.js";
import menuRoute from "../routes/menu.route.js";
import orderRoute from "../routes/order.route.js";

const createTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use("/api/v1/menu", menuRoute);
  app.use("/api/v1/order", orderRoute);
  return app;
};

const tokenFor = (user: any) =>
  jwt.sign(
    { userId: user._id.toString(), email: user.email, admin: false },
    process.env.SECRET_KEY!,
    { expiresIn: "7d" },
  );

describe("Dish availability", () => {
  let app: express.Express;
  let owner: any;
  let otherOwner: any;
  let customer: any;
  let restaurant: any;
  let ownerToken: string;
  let otherOwnerToken: string;
  let customerToken: string;

  beforeEach(async () => {
    app = createTestApp();

    const password = await bcrypt.hash("password123", 10);

    owner = await User.create({
      fullname: "Availability Owner",
      email: "availability-owner@example.com",
      password,
      isVerified: true,
    });
    otherOwner = await User.create({
      fullname: "Other Owner",
      email: "other-owner@example.com",
      password,
      isVerified: true,
    });
    customer = await User.create({
      fullname: "Availability Customer",
      email: "availability-customer@example.com",
      password,
      isVerified: true,
    });

    restaurant = await Restaurant.create({
      user: owner._id,
      restaurantName: "Availability Kitchen",
      address: "9 Availability Road",
      city: "Kolkata",
      state: "West Bengal",
      country: "India",
      pincode: "700001",
      contact: 9876543210,
      deliveryTime: 30,
      deliveryPrice: 50,
      cuisines: ["Indian"],
      imageUrl: "https://test.com/restaurant.jpg",
      location: { type: "Point", coordinates: [88.3639, 22.5726] },
    });

    ownerToken = tokenFor(owner);
    otherOwnerToken = tokenFor(otherOwner);
    customerToken = tokenFor(customer);
  });

  const addMenu = (fields: Record<string, string> = {}, token = ownerToken) => {
    const req = request(app)
      .post("/api/v1/menu")
      .set("Cookie", [`token=${token}`])
      .field("name", "Availability Dish")
      .field("description", "A dish used by availability tests")
      .field("price", "100")
      .field("restaurantId", restaurant._id.toString());

    for (const [key, value] of Object.entries(fields)) {
      req.field(key, value);
    }

    return req.attach("image", Buffer.from("fake-image"), "dish.jpg");
  };

  const createMenuDirectly = async (overrides: Record<string, unknown> = {}) => {
    const menu = await Menu.create({
      name: "Direct Dish",
      description: "Created directly for tests",
      price: 100,
      image: "https://test.com/dish.jpg",
      restaurant: restaurant._id,
      ...overrides,
    });
    restaurant.menus.push(menu._id);
    await restaurant.save();
    return menu;
  };

  const checkout = (menuIds: string[], idempotencyKey: string) =>
    request(app)
      .post("/api/v1/order/checkout/create-checkout-session")
      .set("Cookie", [`token=${customerToken}`])
      .send({
        cartItems: menuIds.map((menuId) => ({
          menuId,
          name: "Availability Dish",
          image: "https://test.com/dish.jpg",
          price: 100,
          quantity: 1,
        })),
        deliveryDetails: {
          name: customer.fullname,
          email: customer.email,
          address: "12 Customer Street",
          city: "Kolkata",
          state: "West Bengal",
          country: "India",
          pincode: "700001",
          lat: 22.5726,
          lng: 88.3639,
        },
        restaurantId: restaurant._id.toString(),
        paymentMethod: "cod",
        idempotencyKey,
      });

  it("defaults new dishes to available", async () => {
    const res = await addMenu();

    expect(res.status).toBe(201);
    expect(res.body.menu.isAvailable).toBe(true);

    const stored = await Menu.findById(res.body.menu._id);
    expect(stored!.isAvailable).toBe(true);
  });

  it("lets an owner add a dish that is already unavailable", async () => {
    const res = await addMenu({ isAvailable: "false" });

    expect(res.status).toBe(201);
    expect(res.body.menu.isAvailable).toBe(false);
    expect((await Menu.findById(res.body.menu._id))!.isAvailable).toBe(false);
  });

  it("lets the owner toggle availability without touching orders", async () => {
    const menu = await createMenuDirectly();

    const off = await request(app)
      .patch(`/api/v1/menu/${menu._id}/availability`)
      .set("Cookie", [`token=${ownerToken}`])
      .send({ isAvailable: false });

    expect(off.status).toBe(200);
    expect(off.body.menu.isAvailable).toBe(false);
    expect((await Menu.findById(menu._id))!.isAvailable).toBe(false);

    const on = await request(app)
      .patch(`/api/v1/menu/${menu._id}/availability`)
      .set("Cookie", [`token=${ownerToken}`])
      .send({ isAvailable: true });

    expect(on.status).toBe(200);
    expect((await Menu.findById(menu._id))!.isAvailable).toBe(true);
  });

  it("blocks a different owner from changing availability", async () => {
    const menu = await createMenuDirectly();

    const res = await request(app)
      .patch(`/api/v1/menu/${menu._id}/availability`)
      .set("Cookie", [`token=${otherOwnerToken}`])
      .send({ isAvailable: false });

    expect(res.status).toBe(403);
    expect((await Menu.findById(menu._id))!.isAvailable).toBe(true);
  });

  it("requires authentication", async () => {
    const menu = await createMenuDirectly();

    const res = await request(app)
      .patch(`/api/v1/menu/${menu._id}/availability`)
      .send({ isAvailable: false });

    expect(res.status).toBe(401);
  });

  it("rejects a non-boolean availability value", async () => {
    const menu = await createMenuDirectly();

    const res = await request(app)
      .patch(`/api/v1/menu/${menu._id}/availability`)
      .set("Cookie", [`token=${ownerToken}`])
      .send({ isAvailable: "maybe" });

    expect(res.status).toBe(400);
    expect((await Menu.findById(menu._id))!.isAvailable).toBe(true);
  });

  it("includes isAvailable in the public menu listing", async () => {
    await createMenuDirectly({ name: "Visible Dish", isAvailable: true });
    await createMenuDirectly({ name: "Hidden Dish", isAvailable: false });

    const res = await request(app).get(
      `/api/v1/menu/restaurant/${restaurant._id}`,
    );

    expect(res.status).toBe(200);
    const byName = Object.fromEntries(
      res.body.menus.map((menu: any) => [menu.name, menu.isAvailable]),
    );
    expect(byName["Visible Dish"]).toBe(true);
    expect(byName["Hidden Dish"]).toBe(false);
  });

  it("rejects checkout when a dish is unavailable", async () => {
    const menu = await createMenuDirectly({ isAvailable: false });

    const res = await checkout([menu._id.toString()], "availability-blocked-001");

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("currently unavailable");
    expect(await Order.countDocuments()).toBe(0);
  });

  it("rejects a mixed cart containing an unavailable dish", async () => {
    const available = await createMenuDirectly({ isAvailable: true });
    const unavailable = await createMenuDirectly({
      name: "Sold Out Dish",
      isAvailable: false,
    });

    const res = await checkout(
      [available._id.toString(), unavailable._id.toString()],
      "availability-mixed-001",
    );

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Sold Out Dish");
    expect(await Order.countDocuments()).toBe(0);
  });

  it("allows checkout again once the dish is re-enabled", async () => {
    const menu = await createMenuDirectly({ isAvailable: false });

    const blocked = await checkout([menu._id.toString()], "availability-reenable-001");
    expect(blocked.status).toBe(400);

    await request(app)
      .patch(`/api/v1/menu/${menu._id}/availability`)
      .set("Cookie", [`token=${ownerToken}`])
      .send({ isAvailable: true });

    const allowed = await checkout([menu._id.toString()], "availability-reenable-002");
    expect(allowed.status).toBe(200);
    expect(allowed.body.order).toBeTruthy();
    expect(await Order.countDocuments()).toBe(1);
  });

  it("keeps legacy dishes without the field orderable", async () => {
    // Simulate a document created before `isAvailable` existed.
    const id = new mongoose.Types.ObjectId();
    await Menu.collection.insertOne({
      _id: id,
      name: "Legacy Dish",
      description: "Created before the availability field",
      price: 100,
      image: "https://test.com/legacy.jpg",
      restaurant: restaurant._id,
      popular: false,
      orderCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await Restaurant.updateOne(
      { _id: restaurant._id },
      { $push: { menus: id } },
    );

    const raw = await Menu.collection.findOne({ _id: id });
    expect(raw!.isAvailable).toBeUndefined();

    const res = await checkout([id.toString()], "availability-legacy-001");
    expect(res.status).toBe(200);
    expect(res.body.order).toBeTruthy();
  });
});
