import { Request, Response } from "express";
import { Restaurant } from "../models/restaurant.model.js";
import { Order } from "../models/order.model.js";
import { Menu } from "../models/menu.model.js";
import Stripe from "stripe";
import mongoose from "mongoose";
import { logger } from "../utils/logger.js";
import { runWithOptionalTransaction } from "../utils/transactions.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const MIN_ORDER_AMOUNT = Number(process.env.MIN_ORDER_AMOUNT) || 50;

// In-memory store for processed webhook events
// NOTE: In production, replace this with Redis and a TTL (e.g., 24 hours) to avoid memory leaks
const processedWebhookEvents = new Map<string, number>();
const EVENT_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

// Periodically clean up expired events to prevent memory leak
setInterval(() => {
  const now = Date.now();
  for (const [eventId, timestamp] of processedWebhookEvents.entries()) {
    if (now - timestamp > EVENT_EXPIRY_MS) {
      processedWebhookEvents.delete(eventId);
    }
  }
}, 60 * 60 * 1000); // Clean every hour

interface VerifiedCartItem {
  menuId: string;
  name: string;
  image: string;
  price: number; // VERIFIED from database
  quantity: number;
}

type CheckoutSessionRequest = {
  cartItems: {
    menuId: string;
    name: string;
    image: string;
    price: number; // Client-supplied (NOT TRUSTED)
    quantity: number;
  }[];
  deliveryDetails: {
    name: string;
    email: string;
    address: string;
    city: string;
    pincode: string;
    lat?: number;
    lng?: number;
  };
  restaurantId: string;
  paymentMethod?: "stripe" | "cod";
};

// ======================= STATUS TRANSITION UTILITY =======================
const STATUS_TRANSITIONS: Record<string, string[]> = {
  pending: ["confirmed", "cancelled", "payment_failed"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["outfordelivery", "cancelled"],
  outfordelivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
  payment_failed: ["confirmed", "cancelled"],
};

function validateStatusTransition(current: string, next: string) {
  if (current === next) return true;
  const allowed = STATUS_TRANSITIONS[current] || [];
  return allowed.includes(next);
}

export const getOrders = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const skip = (page - 1) * limit;

    const [orders, totalCount] = await Promise.all([
      Order.find({ user: req.id })
        .populate("restaurant", "restaurantName imageUrl location")
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
  } catch {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ======================= GET ORDER BY ID =======================
export const getOrderById = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findById(orderId)
      .populate("restaurant", "restaurantName imageUrl user location deliveryTime deliveryPrice")
      .populate("user", "fullname email");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const orderUserId = (order.user as any)._id?.toString() || (order.user as any).toString();
    const isOrderOwner = orderUserId === req.id;
    const isRestaurantOwner = (order.restaurant as any)?.user?.toString() === req.id;

    if (!isOrderOwner && !isRestaurantOwner) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    return res.status(200).json({ success: true, order });
  } catch {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ======================= VERIFY AND CALCULATE PRICES =======================
async function verifyCartPrices(
  cartItems: CheckoutSessionRequest["cartItems"],
  menuItems: any[]
): Promise<{ verifiedItems: VerifiedCartItem[]; cartTotal: number; errors: string[] }> {
  const verifiedItems: VerifiedCartItem[] = [];
  const errors: string[] = [];
  let cartTotal = 0;

  for (const cartItem of cartItems) {
    const menuItem = menuItems.find((item: any) => item._id.toString() === cartItem.menuId);

    if (!menuItem) {
      errors.push(`Menu item ${cartItem.menuId} not found`);
      continue;
    }

    // VERIFY: Use database price, not client-supplied price
    const verifiedPrice = menuItem.price;
    const quantity = Math.max(1, Math.floor(cartItem.quantity));

    // Optional: Log price discrepancies for monitoring
    if (cartItem.price !== verifiedPrice) {
      logger.warn(
        { menuId: cartItem.menuId, clientPrice: cartItem.price, dbPrice: verifiedPrice },
        "Price mismatch detected in checkout"
      );
    }

    verifiedItems.push({
      menuId: cartItem.menuId,
      name: menuItem.name,
      image: menuItem.image || cartItem.image,
      price: verifiedPrice,
      quantity,
    });

    cartTotal += verifiedPrice * quantity;
  }

  return { verifiedItems, cartTotal, errors };
}

// ======================= CREATE CHECKOUT SESSION =======================
export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const checkoutSessionRequest: CheckoutSessionRequest = req.body;

    if (!checkoutSessionRequest.cartItems?.length) {
      return res.status(400).json({ success: false, message: "Cart items are required" });
    }
    if (!checkoutSessionRequest.deliveryDetails) {
      return res.status(400).json({ success: false, message: "Delivery details are required" });
    }
    if (!checkoutSessionRequest.restaurantId) {
      return res.status(400).json({ success: false, message: "Restaurant ID is required" });
    }

    const restaurant = await Restaurant.findById(checkoutSessionRequest.restaurantId).populate("menus");
    if (!restaurant) {
      return res.status(404).json({ success: false, message: "Restaurant not found" });
    }

    // VERIFY PRICES FROM DATABASE
    const { verifiedItems, cartTotal, errors } = await verifyCartPrices(
      checkoutSessionRequest.cartItems,
      restaurant.menus
    );

    if (errors.length > 0) {
      return res.status(400).json({ success: false, message: errors.join("; ") });
    }

    if (verifiedItems.length === 0) {
      return res.status(400).json({ success: false, message: "No valid items in cart" });
    }

    const deliveryFee = restaurant.deliveryPrice || 0;
    const totalAmount = cartTotal + deliveryFee;

    if (totalAmount < MIN_ORDER_AMOUNT) {
      return res.status(400).json({
        success: false,
        message: `Minimum order amount is ₹${MIN_ORDER_AMOUNT}`,
      });
    }

    const paymentMethod = checkoutSessionRequest.paymentMethod || "stripe";

    // ========== CASH ON DELIVERY (COD) ==========
    if (paymentMethod === "cod") {
      let createdOrderId: string | null = null;
      const appliedMenuIds: string[] = [];

      try {
        const order = await runWithOptionalTransaction(
          async (session) => {
            // A fallback retry must not reuse compensation state from a failed
            // transactional attempt.
            if (!session) {
              createdOrderId = null;
              appliedMenuIds.length = 0;
            }

            const sessionOptions = session ? { session } : undefined;
            const [created] = await Order.create(
              [
                {
                  restaurant: restaurant._id,
                  user: req.id,
                  deliveryDetails: checkoutSessionRequest.deliveryDetails,
                  cartItems: verifiedItems,
                  totalAmount,
                  status: "confirmed",
                  paymentMethod: "cod",
                },
              ],
              sessionOptions
            );
            createdOrderId = created._id.toString();

            // Keep menu analytics in the same transaction when available.
            for (const item of verifiedItems) {
              await Menu.findByIdAndUpdate(
                item.menuId,
                { $inc: { orderCount: 1 } },
                sessionOptions
              );
              appliedMenuIds.push(item.menuId);
            }

            return created;
          },
          async () => {
            // Compensating writes for standalone MongoDB: undo anything that
            // was persisted before the failure.
            if (createdOrderId) {
              await Order.findByIdAndDelete(createdOrderId);
            }
            for (const menuId of appliedMenuIds) {
              await Menu.findByIdAndUpdate(menuId, { $inc: { orderCount: -1 } });
            }
          }
        );

        return res.status(200).json({
          success: true,
          message: "Order placed successfully with Cash on Delivery",
          order,
          paymentMethod: "cod",
        });
      } catch (txnError) {
        logger.error({ err: txnError }, "COD order creation failed");
        return res.status(500).json({ success: false, message: "Order failed, please try again" });
      }
    }

    // ========== STRIPE PAYMENT ==========
    let lineItems;
    try {
      lineItems = createLineItems(verifiedItems);
    } catch (err: any) {
      return res.status(400).json({ success: false, message: err.message });
    }

    if (deliveryFee > 0) {
      lineItems.push({
        price_data: {
          currency: "inr",
          product_data: { name: "Delivery Fee", images: [] },
          unit_amount: Math.round(deliveryFee * 100),
        },
        quantity: 1,
      });
    }

    // Create order with verified prices
    const order = await Order.create({
      restaurant: restaurant._id,
      user: req.id,
      deliveryDetails: checkoutSessionRequest.deliveryDetails,
      cartItems: verifiedItems,
      totalAmount,
      status: "pending",
      paymentMethod: "stripe",
    });

    try {
      const stripeSession = await stripe.checkout.sessions.create({
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
          images: JSON.stringify(verifiedItems.map((item) => item.image)),
        },
        payment_intent_data: {
          metadata: {
            orderId: order._id.toString(),
          },
        },
      });

      if (!stripeSession.url) {
        await Order.findByIdAndDelete(order._id);
        return res.status(400).json({
          success: false,
          message: "Error while creating checkout session",
        });
      }

      order.paymentIntentId = stripeSession.id;
      await order.save();

      return res.status(200).json({ success: true, session: stripeSession, orderId: order._id });
    } catch (stripeErr) {
      await Order.findByIdAndDelete(order._id);
      logger.error({ err: stripeErr }, "Stripe session creation failed");
      return res.status(500).json({
        success: false,
        message: "Failed to create payment session",
      });
    }
  } catch (error) {
    logger.error({ err: error }, "Checkout session error");
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ======================= CREATE LINE ITEMS (uses verified prices) =======================
function createLineItems(verifiedItems: VerifiedCartItem[]) {
  return verifiedItems.map((item) => ({
    price_data: {
      currency: "inr",
      product_data: {
        name: item.name,
        images: item.image ? [item.image] : undefined,
      },
      unit_amount: Math.round(item.price * 100),
    },
    quantity: item.quantity,
  }));
}

// ======================= CANCEL ORDER =======================
export const cancelOrder = async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(orderId)) {
      return res.status(400).json({ success: false, message: "Invalid order ID" });
    }

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const orderUserId = (order.user as any)._id?.toString() || (order.user as any).toString();
    if (orderUserId !== req.id) {
      return res.status(403).json({ success: false, message: "Not authorized to cancel this order" });
    }

    if (!validateStatusTransition(order.status, "cancelled")) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel an order that is already ${order.status}`,
      });
    }

    if (order.paymentMethod === "stripe" && order.paymentIntentId) {
      try {
        let paymentIntentId = order.paymentIntentId;
        if (paymentIntentId.startsWith("cs_")) {
          const session = await stripe.checkout.sessions.retrieve(paymentIntentId);
          paymentIntentId = session.payment_intent as string;
        }
        if (paymentIntentId && paymentIntentId.startsWith("pi_")) {
          await stripe.refunds.create({
            payment_intent: paymentIntentId,
            reason: "requested_by_customer",
          });
        }
      } catch (refundErr) {
        logger.error({ err: refundErr, orderId }, "Stripe refund failed");
      }
    }

    order.status = "cancelled";
    await order.save();

    return res.status(200).json({
      success: true,
      message: "Order cancelled successfully",
      order,
    });
  } catch {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ======================= STRIPE WEBHOOK (IDEMPOTENT) =======================
export const stripeWebhook = async (req: Request, res: Response) => {
  let event: Stripe.Event;

  try {
    const signature = req.headers["stripe-signature"];
    if (!signature) {
      return res.status(400).send("Missing stripe-signature header");
    }

    const secret = process.env.WEBHOOK_ENDPOINT_SECRET!;
    event = stripe.webhooks.constructEvent(req.body, signature as string, secret);
  } catch (error: any) {
    logger.warn({ err: error.message }, "Webhook signature verification failed");
    return res.status(400).send(`Webhook error: ${error.message}`);
  }

  if (processedWebhookEvents.has(event.id)) {
    logger.info({ eventId: event.id, type: event.type }, "Duplicate webhook event ignored");
    return res.status(200).send();
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;

      if (!orderId) {
        logger.warn({ eventId: event.id }, "Webhook missing orderId metadata");
        return res.status(200).send();
      }

      const order = await Order.findById(orderId);
      if (!order) {
        logger.warn({ eventId: event.id, orderId }, "Webhook: order not found");
        return res.status(200).send();
      }

      // Only process if still pending (idempotency)
      if (order.status !== "pending") {
        logger.info({ eventId: event.id, orderId, status: order.status }, "Order already processed");
        return res.status(200).send();
      }

      // Verify amount matches
      const expectedAmount = Math.round(order.totalAmount * 100);
      if (session.amount_total && session.amount_total !== expectedAmount) {
        logger.warn(
          { eventId: event.id, orderId, expected: expectedAmount, received: session.amount_total },
          "Webhook amount mismatch"
        );
      }

      // Use a real transaction when available; standalone MongoDB uses the
      // compensating-write path in runWithOptionalTransaction.
      const previousState = {
        totalAmount: order.totalAmount,
        status: order.status,
        paymentIntentId: order.paymentIntentId,
      };
      const appliedMenuIds: string[] = [];

      try {
        await runWithOptionalTransaction(
          async (dbSession) => {
            if (!dbSession) {
              appliedMenuIds.length = 0;
            }

            const sessionOptions = dbSession ? { session: dbSession } : undefined;
            order.totalAmount = (session.amount_total || expectedAmount) / 100;
            order.status = "confirmed";
            order.paymentIntentId = session.payment_intent as string;
            await order.save(sessionOptions);

            // Keep menu analytics in the same transaction when available.
            for (const item of order.cartItems) {
              await Menu.findByIdAndUpdate(
                item.menuId,
                { $inc: { orderCount: 1 } },
                sessionOptions
              );
              appliedMenuIds.push(String(item.menuId));
            }
          },
          async () => {
            // Restore the order and undo menu increments if a standalone
            // deployment fails partway through the confirmation.
            await Order.findByIdAndUpdate(orderId, {
              $set: {
                totalAmount: previousState.totalAmount,
                status: previousState.status,
                ...(previousState.paymentIntentId
                  ? { paymentIntentId: previousState.paymentIntentId }
                  : {}),
              },
              ...(previousState.paymentIntentId
                ? {}
                : { $unset: { paymentIntentId: 1 } }),
            });

            for (const menuId of appliedMenuIds) {
              await Menu.findByIdAndUpdate(menuId, { $inc: { orderCount: -1 } });
            }
          }
        );

        // Mark event as processed
        processedWebhookEvents.set(event.id, Date.now());

        logger.info({ eventId: event.id, orderId }, "Order confirmed via webhook");
      } catch (txnError) {
        logger.error({ err: txnError, orderId }, "Webhook confirmation failed");
        // Don't mark as processed so it can be retried
        return res.status(500).send("Webhook processing failed");
      }
    }

    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const orderId = paymentIntent.metadata?.orderId;

      const order = orderId
        ? await Order.findById(orderId)
        : await Order.findOne({ paymentIntentId: paymentIntent.id });

      if (order && order.status === "pending") {
        order.status = "payment_failed";
        await order.save();
        logger.info({ orderId }, "Order marked as payment_failed");
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;

      if (orderId) {
        const order = await Order.findById(orderId);
        if (order && order.status === "pending") {
          order.status = "cancelled";
          await order.save();
          logger.info({ orderId }, "Order cancelled due to expired checkout session");
        }
      }
    }

    // Mark non-critical events as processed too
    processedWebhookEvents.set(event.id, Date.now());

    res.status(200).send();
  } catch (error) {
    logger.error({ err: error, eventId: event.id }, "Webhook processing error");
    // Don't mark as processed on error - allow retry
    res.status(500).send("Webhook processing failed");
  }
};

// ======================= GET ORDER BY SESSION ID =======================
export const getOrderBySessionId = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session.metadata?.orderId) {
      return res.status(404).json({ success: false, message: "Order not found for this session" });
    }

    const order = await Order.findById(session.metadata.orderId)
      .populate("restaurant", "restaurantName imageUrl user location deliveryTime deliveryPrice")
      .populate("user", "fullname email");

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const orderUserId = (order.user as any)._id?.toString() || (order.user as any).toString();
    const isOrderOwner = orderUserId === req.id;
    const isRestaurantOwner = (order.restaurant as any)?.user?.toString() === req.id;

    if (!isOrderOwner && !isRestaurantOwner) {
      return res.status(403).json({ success: false, message: "Not authorized" });
    }

    return res.status(200).json({ success: true, order, session });
  } catch {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};