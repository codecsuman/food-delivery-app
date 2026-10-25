import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import express from "express";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Restaurant } from "../models/restaurant.model.js";
import { Menu } from "../models/menu.model.js";
import { Order } from "../models/order.model.js";
import restaurantRoute from "../routes/restaurant.route.js";
import menuRoute from "../routes/menu.route.js";

// Regression coverage for the owner dashboard:
// GET /restaurant/, PUT /restaurant/:id, GET /menu/restaurant/:restaurantId,
// GET /restaurant/order and PUT /restaurant/order/:orderId/status.
//
// These routes used to validate `req.params` with a bare string schema (or
// the server was running a stale build that still did), which made every
// dashboard request fail with:
//   "Validation failed: expected string, received object"
const createTestApp = () => {
  const app = express();
  app.use(cookieParser());
  app.use(express.json());
  app.use("/api/v1/restaurant", restaurantRoute);
  app.use("/api/v1/menu", menuRoute);
  return app;
};

const signToken = (userId: string, email: string) =>
  jwt.sign({ userId, email, admin: false }, process.env.SECRET_KEY!, {
    expiresIn: "7d",
  });

describe("Owner dashboard restaurant/menu/order flow", () => {
  let app: express.Express;
  let owner: any;
  let stranger: any;
  let restaurant: any;
  let menu: any;
  let order: any;
  let ownerCookie: string;
  let strangerCookie: string;

  beforeEach(async () => {
    app = createTestApp();

    const password = await import("bcryptjs").then((b) =>
      b.hash("password123", 10),
    );

    owner = await User.create({
      fullname: "Dashboard Owner",
      email: "dashboard-owner@example.com",
      password,
      isVerified: true,
    });
    stranger = await User.create({
      fullname: "Another Owner",
      email: "other-owner@example.com",
      password,
      isVerified: true,
    });

    restaurant = await Restaurant.create({
      user: owner._id,
      restaurantName: "Dashboard Restaurant",
      city: "Kolkata",
      country: "India",
      pincode: "700001",
      deliveryTime: 30,
      deliveryPrice: 20,
      cuisines: ["Indian"],
      imageUrl: "https://test.com/restaurant.jpg",
      location: { type: "Point", coordinates: [88.3639, 22.5726] },
    });

    menu = await Menu.create({
      name: "Dashboard Pizza",
      description: "A pizza used by the dashboard regression test",
      price: 200,
      image: "https://test.com/pizza.jpg",
      restaurant: restaurant._id,
    });

    restaurant.menus.push(menu._id);
    await restaurant.save();

    order = await Order.create({
      user: owner._id,
      restaurant: restaurant._id,
      deliveryDetails: {
        name: "Dashboard Owner",
        email: "dashboard-owner@example.com",
        address: "12 Test Street",
        city: "Kolkata",
        pincode: "700001",
      },
      cartItems: [
        {
          menuId: menu._id.toString(),
          name: menu.name,
          image: menu.image,
          price: menu.price,
          quantity: 1,
        },
      ],
      totalAmount: 220,
      status: "confirmed",
      paymentMethod: "cod",
    });

    ownerCookie = `token=${signToken(owner._id.toString(), owner.email)}`;
    strangerCookie = `token=${signToken(
      stranger._id.toString(),
      stranger.email,
    )}`;
  });

  it("returns the owner's restaurant with populated menus", async () => {
    const res = await request(app)
      .get("/api/v1/restaurant/?t=123")
      .set("Cookie", ownerCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.restaurant.restaurantName).toBe("Dashboard Restaurant");
    expect(res.body.restaurant.menus).toHaveLength(1);
    expect(res.body.restaurant.menus[0].name).toBe("Dashboard Pizza");
  });

  it("updates a restaurant through the :id route", async () => {
    const res = await request(app)
      .put(`/api/v1/restaurant/${restaurant._id}`)
      .set("Cookie", ownerCookie)
      .send({
        restaurantName: "Dashboard Restaurant Updated",
        deliveryPrice: 45,
        cuisines: ["Indian", "Chinese"],
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.restaurant.restaurantName).toBe(
      "Dashboard Restaurant Updated",
    );
    expect(res.body.restaurant.deliveryPrice).toBe(45);
    expect(res.body.restaurant.cuisines).toEqual(["Indian", "Chinese"]);
  });

  it("refuses to let another owner update the restaurant", async () => {
    const res = await request(app)
      .put(`/api/v1/restaurant/${restaurant._id}`)
      .set("Cookie", strangerCookie)
      .send({ restaurantName: "Hijacked" });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("lists menus for a restaurant through the param route", async () => {
    const res = await request(app).get(
      `/api/v1/menu/restaurant/${restaurant._id}`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.count).toBe(1);
    expect(res.body.menus[0].name).toBe("Dashboard Pizza");
  });

  it("edits a menu item through the param route", async () => {
    const res = await request(app)
      .put(`/api/v1/menu/${menu._id}`)
      .set("Cookie", ownerCookie)
      .send({ name: "Dashboard Pizza Updated", price: 250 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.menu.name).toBe("Dashboard Pizza Updated");
    expect(res.body.menu.price).toBe(250);
  });

  it("lists orders across the owner's restaurants", async () => {
    const res = await request(app)
      .get("/api/v1/restaurant/order")
      .set("Cookie", ownerCookie);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.orders).toHaveLength(1);
    expect(res.body.orders[0]._id).toBe(order._id.toString());
    expect(res.body.pagination.totalCount).toBe(1);
  });

  it("advances an order status from the dashboard", async () => {
    const res = await request(app)
      .put(`/api/v1/restaurant/order/${order._id}/status`)
      .set("Cookie", ownerCookie)
      .send({ status: "preparing" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.status).toBe("preparing");

    const saved = await Order.findById(order._id);
    expect(saved!.status).toBe("preparing");
  });

  it("refuses order status updates from a different owner", async () => {
    const res = await request(app)
      .put(`/api/v1/restaurant/order/${order._id}/status`)
      .set("Cookie", strangerCookie)
      .send({ status: "preparing" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it("returns 400 (not 500) for a malformed restaurant id", async () => {
    const res = await request(app)
      .put("/api/v1/restaurant/not-an-object-id")
      .set("Cookie", ownerCookie)
      .send({ restaurantName: "Still Valid" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Validation failed");
  });

  it("returns 400 for a 12-byte restaurantId query param", async () => {
    const res = await request(app)
      .get("/api/v1/restaurant/?restaurantId=123456789012")
      .set("Cookie", ownerCookie);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Invalid restaurant ID");
  });

  it("returns 400 for a malformed order id", async () => {
    const res = await request(app)
      .put("/api/v1/restaurant/order/not-an-object-id/status")
      .set("Cookie", ownerCookie)
      .send({ status: "preparing" });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
