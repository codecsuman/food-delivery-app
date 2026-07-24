import { Request, Response } from "express";
import { Restaurant } from "../models/restaurant.model.js";
import { Order } from "../models/order.model.js";
import { Menu } from "../models/menu.model.js";
import Stripe from "stripe";
import mongoose from "mongoose";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

type CheckoutSessionRequest = {
  cartItems: {
    menuId: string;
    name: string;
    image: string;
    price: number;
    quantity: number;
  }[];
  deliveryDetails: {
    name: string;
    email: string;
    address: string;
    city: string;
    lat?: number;
    lng?: number;
  };
  restaurantId: string;
};

// ======================= GET ORDERS (for user) =======================
export const getOrders = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      50,
      Math.max(1, parseInt(req.query.limit as string) || 20),
    );
    const skip = (page - 1) * limit;

    const [orders, totalCount] = await Promise.all([
      Order.find({ user: req.id })
        .populate("restaurant", "restaurantName imageUrl")
        .populate("user", "fullname email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments({ user: req.id }),
    ]);

    return res.status(200).json({
      success: true,
      count: orders.length,
      orders,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit,
      },
    });
  } catch (error) {
    console.error("Get orders error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= GET ORDER BY ID =======================
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findById(orderId)
      .populate(
        "restaurant",
        "restaurantName imageUrl user lat lng deliveryTime deliveryPrice",
      )
      .populate("user", "fullname email");

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const orderUserId =
      (order.user as any)._id?.toString() || (order.user as any).toString();

    const isOrderOwner = orderUserId === req.id;
    const isRestaurantOwner =
      (order.restaurant as any)?.user?.toString() === req.id;

    if (!isOrderOwner && !isRestaurantOwner) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    return res.status(200).json({ success: true, order });
  } catch (error) {
    console.error("Get order by id error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= CREATE CHECKOUT SESSION =======================
export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const checkoutSessionRequest: CheckoutSessionRequest = req.body;

    if (!checkoutSessionRequest.cartItems?.length) {
      return res
        .status(400)
        .json({ success: false, message: "Cart items are required" });
    }
    if (!checkoutSessionRequest.deliveryDetails) {
      return res
        .status(400)
        .json({ success: false, message: "Delivery details are required" });
    }
    if (!checkoutSessionRequest.restaurantId) {
      return res
        .status(400)
        .json({ success: false, message: "Restaurant ID is required" });
    }

    const restaurant = await Restaurant.findById(
      checkoutSessionRequest.restaurantId,
    ).populate("menus");
    if (!restaurant) {
      return res
        .status(404)
        .json({ success: false, message: "Restaurant not found" });
    }

    const totalAmount = checkoutSessionRequest.cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const paymentMethod = (req.body.paymentMethod as string) || "stripe";

    // ========== CASH ON DELIVERY (COD) ==========
    if (paymentMethod === "cod") {
      const order = await Order.create({
        restaurant: restaurant._id,
        user: req.id,
        deliveryDetails: checkoutSessionRequest.deliveryDetails,
        cartItems: checkoutSessionRequest.cartItems,
        totalAmount,
        status: "confirmed",
        paymentMethod: "cod",
      });

      for (const item of checkoutSessionRequest.cartItems) {
        try {
          await Menu.findByIdAndUpdate(item.menuId, {
            $inc: { orderCount: 1 },
          });
        } catch (menuErr) {
          console.warn(
            `Failed to update orderCount for menu ${item.menuId}:`,
            menuErr,
          );
        }
      }

      return res.status(200).json({
        success: true,
        message: "Order placed successfully with Cash on Delivery",
        order,
        paymentMethod: "cod",
      });
    }

    // ========== STRIPE PAYMENT ==========
    const order = await Order.create({
      restaurant: restaurant._id,
      user: req.id,
      deliveryDetails: checkoutSessionRequest.deliveryDetails,
      cartItems: checkoutSessionRequest.cartItems,
      totalAmount,
      status: "pending",
      paymentMethod: "stripe",
    });

    const lineItems = createLineItems(checkoutSessionRequest, restaurant.menus);

    if (restaurant.deliveryPrice > 0) {
      lineItems.push({
        price_data: {
          currency: "inr",
          product_data: { name: "Delivery Fee" } as any,
          unit_amount: Math.round(restaurant.deliveryPrice * 100),
        },
        quantity: 1,
      } as any);
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      shipping_address_collection: {
        allowed_countries: ["IN", "GB", "US", "CA"],
      },
      line_items: lineItems,
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL}/order/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cart`,
      metadata: {
        orderId: order._id.toString(),
        images: JSON.stringify(
          checkoutSessionRequest.cartItems.map((item) => item.image),
        ),
      },
    });

    if (!session.url) {
      return res.status(400).json({
        success: false,
        message: "Error while creating checkout session",
      });
    }

    order.paymentIntentId = session.id;
    await order.save();

    return res.status(200).json({ success: true, session, orderId: order._id });
  } catch (error) {
    console.error("Create checkout session error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= CANCEL ORDER =======================
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findById(orderId);

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const orderUserId =
      (order.user as any)._id?.toString() || (order.user as any).toString();

    if (orderUserId !== req.id) {
      return res.status(403).json({
        success: false,
        message: "Not authorized to cancel this order",
      });
    }

    // Only allow cancellation for orders that haven't been delivered yet
    const nonCancellableStatuses = ["delivered", "cancelled", "payment_failed"];
    if (nonCancellableStatuses.includes(order.status)) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel an order that is already ${order.status}`,
      });
    }

    // If Stripe payment and paymentIntentId exists, process refund
    if (order.paymentMethod === "stripe" && order.paymentIntentId) {
      try {
        // paymentIntentId in your schema stores the session.id, but after webhook
        // it gets updated to the actual payment_intent string.
        // We need to handle both cases.
        let paymentIntentId = order.paymentIntentId;

        // If it looks like a session ID (starts with cs_), retrieve the session to get payment_intent
        if (paymentIntentId.startsWith("cs_")) {
          const session =
            await stripe.checkout.sessions.retrieve(paymentIntentId);
          paymentIntentId = session.payment_intent as string;
        }

        if (paymentIntentId && paymentIntentId.startsWith("pi_")) {
          await stripe.refunds.create({
            payment_intent: paymentIntentId,
            reason: "requested_by_customer",
          });
        }
      } catch (refundError: any) {
        console.error("Stripe refund error:", refundError.message);
        // Continue to cancel the order even if refund fails (log it)
      }
    }

    order.status = "cancelled";
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order,
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};

// ======================= STRIPE WEBHOOK =======================
export const stripeWebhook = async (req: Request, res: Response) => {
  let event: Stripe.Event;

  try {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).send("Missing stripe-signature header");
    }

    const secret = process.env.WEBHOOK_ENDPOINT_SECRET!;
    event = stripe.webhooks.constructEvent(
      req.body,
      signature as string,
      secret,
    );
  } catch (error: any) {
    console.error("Webhook signature verification failed:", error.message);
    return res.status(400).send(`Webhook error: ${error.message}`);
  }

  if (event.type === "checkout.session.completed") {
    try {
      const session = event.data.object as Stripe.Checkout.Session;
      const order = await Order.findById(session.metadata?.orderId);

      if (!order) {
        console.error(`Webhook: order ${session.metadata?.orderId} not found`);
        return res.status(200).send();
      }

      if (order.status !== "pending") {
        console.log(
          `Webhook: order ${order._id} already processed (status: ${order.status})`,
        );
        return res.status(200).send();
      }

      if (session.amount_total) {
        order.totalAmount = session.amount_total / 100;
      }
      order.status = "confirmed";
      order.paymentIntentId = session.payment_intent as string;
      await order.save();

      for (const item of order.cartItems) {
        try {
          await Menu.findByIdAndUpdate(item.menuId, {
            $inc: { orderCount: 1 },
          });
        } catch (menuErr) {
          console.warn(
            `Failed to update orderCount for menu ${item.menuId}:`,
            menuErr,
          );
        }
      }

      console.log(`Order ${order._id} confirmed via webhook`);
    } catch (error) {
      console.error("Error handling webhook event:", error);
      return res.status(200).send();
    }
  }

  if (event.type === "payment_intent.payment_failed") {
    try {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const order = await Order.findOne({ paymentIntentId: paymentIntent.id });
      if (order) {
        if (order.status === "pending") {
          order.status = "payment_failed";
          await order.save();
          console.log(`Order ${order._id} payment failed`);
        }
      }
    } catch (error) {
      console.error("Error handling payment failure:", error);
    }
  }

  res.status(200).send();
};

// ======================= CREATE LINE ITEMS =======================
export const createLineItems = (
  checkoutSessionRequest: CheckoutSessionRequest,
  menuItems: any[],
) => {
  const lineItems: any[] = checkoutSessionRequest.cartItems.map((cartItem) => {
    const menuItem = menuItems.find(
      (item: any) => item._id.toString() === cartItem.menuId,
    );
    if (!menuItem) {
      throw new Error(`Menu item ${cartItem.menuId} not found`);
    }

    const productData: any = { name: menuItem.name };
    if (menuItem.image) {
      productData.images = [menuItem.image];
    }

    return {
      price_data: {
        currency: "inr",
        product_data: productData,
        unit_amount: Math.round(menuItem.price * 100),
      },
      quantity: cartItem.quantity,
    };
  });

  return lineItems;
};

// ======================= GET ORDER BY SESSION ID =======================
export const getOrderBySessionId = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session.metadata?.orderId) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found for this session" });
    }

    const order = await Order.findById(session.metadata.orderId)
      .populate(
        "restaurant",
        "restaurantName imageUrl user lat lng deliveryTime deliveryPrice",
      )
      .populate("user", "fullname email");

    if (!order) {
      return res
        .status(404)
        .json({ success: false, message: "Order not found" });
    }

    const orderUserId =
      (order.user as any)._id?.toString() || (order.user as any).toString();
    const isOrderOwner = orderUserId === req.id;
    const isRestaurantOwner =
      (order.restaurant as any)?.user?.toString() === req.id;

    if (!isOrderOwner && !isRestaurantOwner) {
      return res
        .status(403)
        .json({ success: false, message: "Not authorized" });
    }

    return res.status(200).json({ success: true, order, session });
  } catch (error) {
    console.error("Get order by session error:", error);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
  }
};
