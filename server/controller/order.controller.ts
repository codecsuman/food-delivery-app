import { Request, Response } from "express";
import { Restaurant } from "../models/restaurant.model.js";
import { Order } from "../models/order.model.js";
import { Menu } from "../models/menu.model.js";
import Stripe from "stripe";
import mongoose from "mongoose";
import { logger } from "../utils/logger.js";
import { runWithOptionalTransaction } from "../utils/transactions.js";
import mapService from "../services/mapService.js";
import { calculateDeliveryPricing } from "../services/deliveryPricing.js";
import { refundOrderPayment } from "../services/orderRefunds.js";
import {
  claimWebhookEvent,
  completeWebhookEvent,
  failWebhookEvent,
} from "../services/webhookEvents.js";
import {
  paymentEvent,
  paymentStatusOnCancellation,
  paymentStatusAfterRefund,
} from "../services/orderPayments.js";
import type { IOrder } from "../models/order.model.js";
import {
  emitNewOrder,
  emitOrderStatus,
} from "../socketHandlers/orderEvents.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

const MIN_ORDER_AMOUNT = Number(process.env.MIN_ORDER_AMOUNT) || 50;

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
    state?: string;
    country?: string;
    pincode: string;
    lat?: number;
    lng?: number;
  };
  restaurantId: string;
  paymentMethod?: "stripe" | "cod";
  idempotencyKey?: string;
};

const isValidCoordinate = (
  coords: unknown,
): coords is [number, number] => {
  if (!Array.isArray(coords) || coords.length !== 2) return false;
  const [lng, lat] = coords;
  if (typeof lng !== "number" || typeof lat !== "number") return false;
  if (!Number.isFinite(lng) || !Number.isFinite(lat)) return false;
  if (lng < -180 || lng > 180 || lat < -90 || lat > 90) return false;
  return !(lng === 0 && lat === 0);
};

// The primary phone/address is shown to customers on confirmation and tracking
// screens. The alternate phone is only returned to the restaurant's owner.
const ORDER_RESTAURANT_FIELDS =
  "restaurantName imageUrl user location deliveryTime deliveryPrice contact address city state pincode alternateContact";

const serializeOrder = (order: any, includeAlternateContact: boolean) => {
  const plain = order?.toObject ? order.toObject() : order;
  if (!includeAlternateContact) {
    // The alternate phone is private to the restaurant owner. It must never be
    // exposed to the customer through either the populated restaurant or the
    // historical snapshot stored on the order.
    delete plain.restaurantAlternateContact;
    if (plain?.restaurant && typeof plain.restaurant === "object") {
      delete plain.restaurant.alternateContact;
    }
  }
  return plain;
};

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
        .populate(
          "restaurant",
          "restaurantName imageUrl location contact address city state pincode",
        )
        .populate("user", "fullname email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments({ user: req.id }),
    ]);

    return res.status(200).json({
      success: true,
      count: orders.length,
      // Customer-facing list: strip the private alternate phone while keeping
      // the historical primary contact snapshot.
      orders: orders.map((order) => serializeOrder(order, false)),
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
      .populate("restaurant", ORDER_RESTAURANT_FIELDS)
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

    return res.status(200).json({
      success: true,
      order: serializeOrder(order, isRestaurantOwner),
    });
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

    // An explicit `false` blocks the order. Missing/undefined keeps legacy
    // documents (created before this field existed) orderable.
    if (menuItem.isAvailable === false) {
      errors.push(`"${menuItem.name}" is currently unavailable`);
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

const isDuplicateKeyError = (error: unknown): boolean =>
  (error as { code?: number } | null)?.code === 11000;

/**
 * Creates (or recreates) a Stripe Checkout Session for an already persisted
 * order. Reusing the stored verified cart/pricing means an idempotent retry can
 * never change the amount or create a second order.
 */
async function createStripeSessionForOrder(order: IOrder) {
  const lineItems = createLineItems(
    order.cartItems.map((item) => ({
      menuId: item.menuId,
      name: item.name,
      image: item.image,
      price: item.price,
      quantity: item.quantity,
    })),
  );

  if (order.deliveryFee > 0) {
    lineItems.push({
      price_data: {
        currency: "inr",
        product_data: { name: "Delivery Fee", images: [] },
        unit_amount: Math.round(order.deliveryFee * 100),
      },
      quantity: 1,
    });
  }

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
      images: JSON.stringify(order.cartItems.map((item) => item.image)),
    },
    payment_intent_data: {
      metadata: {
        orderId: order._id.toString(),
      },
    },
  });

  if (!stripeSession.url) {
    throw new Error("Stripe did not return a checkout URL");
  }

  order.paymentIntentId = stripeSession.id;
  await order.save();

  return stripeSession;
}

/**
 * Replays the response for a checkout request that used an idempotency key we
 * have already seen. COD orders are simply returned; a still-pending Stripe
 * order is resumed (existing session first, then a recreated one) so the
 * customer can finish paying without a duplicate order.
 */
async function replayExistingOrder(order: IOrder, res: Response) {
  if (order.paymentMethod === "cod") {
    return res.status(200).json({
      success: true,
      message: "Order already placed successfully with Cash on Delivery",
      order,
      paymentMethod: "cod",
      idempotentReplay: true,
    });
  }

  if (order.status !== "pending") {
    return res.status(409).json({
      success: false,
      message:
        "This checkout attempt is no longer active. Please start a new checkout.",
      orderId: order._id,
      status: order.status,
      idempotentReplay: true,
    });
  }

  try {
    let stripeSession: Stripe.Checkout.Session | null = null;

    if (order.paymentIntentId?.startsWith("cs_")) {
      try {
        const existing = await stripe.checkout.sessions.retrieve(
          order.paymentIntentId,
        );
        if (existing?.url) stripeSession = existing;
      } catch (error) {
        logger.warn(
          { err: error, orderId: order._id },
          "Existing Stripe session could not be retrieved; recreating it",
        );
      }
    }

    if (!stripeSession) {
      stripeSession = await createStripeSessionForOrder(order);
    }

    return res.status(200).json({
      success: true,
      session: stripeSession,
      orderId: order._id,
      idempotentReplay: true,
    });
  } catch (error) {
    logger.error(
      { err: error, orderId: order._id },
      "Failed to resume idempotent checkout",
    );
    return res.status(502).json({
      success: false,
      message: "Could not resume your payment session. Please try again.",
    });
  }
}

// ======================= CREATE CHECKOUT SESSION =======================
export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const checkoutSessionRequest: CheckoutSessionRequest = req.body;
    const idempotencyKey =
      typeof checkoutSessionRequest.idempotencyKey === "string" &&
      checkoutSessionRequest.idempotencyKey.trim()
        ? checkoutSessionRequest.idempotencyKey.trim()
        : undefined;

    if (!checkoutSessionRequest.cartItems?.length) {
      return res.status(400).json({ success: false, message: "Cart items are required" });
    }
    if (!checkoutSessionRequest.deliveryDetails) {
      return res.status(400).json({ success: false, message: "Delivery details are required" });
    }
    if (!checkoutSessionRequest.restaurantId) {
      return res.status(400).json({ success: false, message: "Restaurant ID is required" });
    }

    // Idempotent retry: resolve before any network/geocoding work so a
    // double-submitted request does not create a second order or payment.
    if (idempotencyKey) {
      const existingOrder = await Order.findOne({
        user: req.id,
        idempotencyKey,
      });
      if (existingOrder) {
        return replayExistingOrder(existingOrder, res);
      }
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

    // ========== SERVER-AUTHORITATIVE DISTANCE & PRICING ==========
    // Resolve the delivery position from the map pin/GPS coordinates, falling
    // back to geocoding the address text. Never trust a client-supplied fee.
    const requestedDetails = checkoutSessionRequest.deliveryDetails;
    let customerCoordinates: [number, number] | null = isValidCoordinate([
      requestedDetails.lng,
      requestedDetails.lat,
    ])
      ? [requestedDetails.lng as number, requestedDetails.lat as number]
      : null;

    if (!customerCoordinates) {
      const geoResult = await mapService.geocodeAddress(
        requestedDetails.address,
        requestedDetails.pincode,
      );
      if (!geoResult.success || !isValidCoordinate(geoResult.coordinates)) {
        return res.status(400).json({
          success: false,
          message:
            geoResult.message ||
            "Could not verify your delivery address. Please drop a pin on the map.",
        });
      }
      customerCoordinates = geoResult.coordinates;
    }

    const restaurantCoordinates = restaurant.location?.coordinates;
    if (!isValidCoordinate(restaurantCoordinates)) {
      return res.status(400).json({
        success: false,
        message: "This restaurant has not set a valid delivery location yet",
      });
    }

    const quote = await mapService.checkDeliveryRange(
      restaurantCoordinates,
      customerCoordinates,
      restaurant.deliveryPrice || 0,
      restaurant.deliveryTime || 0,
    );

    if (
      !quote.success ||
      quote.deliverable === false ||
      quote.withinRange === false
    ) {
      return res.status(400).json({
        success: false,
        message:
          quote.message ||
          "Sorry, this restaurant does not deliver to your location",
        distanceKm: quote.distanceKm,
        maxRadius: quote.maxRadius,
      });
    }

    // Recompute with the shared rule so the stored/charged fee cannot drift
    // from what the cart/checkout UI displays.
    const pricing = calculateDeliveryPricing(
      quote.distanceKm || 0,
      restaurant.deliveryPrice || 0,
    );

    if (!pricing.withinRange) {
      return res.status(400).json({
        success: false,
        message: `Sorry, we only deliver within ${pricing.maxRadius} km. You're ${pricing.distanceKm} km away.`,
        distanceKm: pricing.distanceKm,
        maxRadius: pricing.maxRadius,
      });
    }

    const deliveryFee = pricing.deliveryFee;
    const totalAmount = cartTotal + deliveryFee;

    // Freeze the address + exact coordinates on the order so later profile
    // edits can never change where an existing order is delivered.
    const deliverySnapshot = {
      ...requestedDetails,
      lat: customerCoordinates[1],
      lng: customerCoordinates[0],
    };

    const orderPricing = {
      subtotal: cartTotal,
      deliveryFee: pricing.deliveryFee,
      deliveryBaseFee: pricing.baseFee,
      deliveryExtraFee: pricing.extraFee,
      deliveryDistanceKm: pricing.distanceKm,
      estimatedDeliveryMinutes: Math.max(
        quote.estimatedMinutes || 0,
        restaurant.deliveryTime || 0,
      ),
    };

    // Freeze the restaurant contact on the order so confirmation/tracking pages
    // keep showing the correct number after the owner edits their profile.
    const restaurantSnapshot = {
      restaurantName: restaurant.restaurantName,
      restaurantContact: restaurant.contact ?? null,
      restaurantAlternateContact: restaurant.alternateContact ?? null,
    };

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
                  deliveryDetails: deliverySnapshot,
                  cartItems: verifiedItems,
                  ...orderPricing,
                  ...restaurantSnapshot,
                  totalAmount,
                  status: "confirmed",
                  paymentMethod: "cod",
                  paymentStatus: "unpaid",
                  paymentEvents: [
                    paymentEvent("cod_order_confirmed", "unpaid", {
                      amount: totalAmount,
                    }),
                  ],
                  ...(idempotencyKey ? { idempotencyKey } : {}),
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

        // The restaurant dashboard listens on its restaurant room. Emit only
        // after the transaction/compensation path has committed, so a failed
        // checkout never produces a phantom row in the owner's list.
        emitNewOrder({
          orderId: order._id.toString(),
          restaurantId: order.restaurant.toString(),
          status: order.status,
          totalAmount: order.totalAmount,
          createdAt: order.createdAt,
        });

        return res.status(200).json({
          success: true,
          message: "Order placed successfully with Cash on Delivery",
          order,
          paymentMethod: "cod",
        });
      } catch (txnError) {
        // A concurrent retry with the same idempotency key lost the unique
        // index race. Return the winner's order instead of failing.
        if (idempotencyKey && isDuplicateKeyError(txnError)) {
          const existingOrder = await Order.findOne({
            user: req.id,
            idempotencyKey,
          });
          if (existingOrder) {
            return replayExistingOrder(existingOrder, res);
          }
        }
        logger.error({ err: txnError }, "COD order creation failed");
        return res.status(500).json({ success: false, message: "Order failed, please try again" });
      }
    }

    // ========== STRIPE PAYMENT ==========
    // Create the order first, then the payment session. If the session cannot
    // be created, the order is deleted so no orphan `pending` order survives a
    // failed payment initialization.
    const order = await Order.create({
      restaurant: restaurant._id,
      user: req.id,
      deliveryDetails: deliverySnapshot,
      cartItems: verifiedItems,
      ...orderPricing,
      ...restaurantSnapshot,
      totalAmount,
      status: "pending",
      paymentMethod: "stripe",
      paymentStatus: "unpaid",
      paymentEvents: [
        paymentEvent("payment_initiated", "unpaid", { amount: totalAmount }),
      ],
      ...(idempotencyKey ? { idempotencyKey } : {}),
    });

    try {
      const stripeSession = await createStripeSessionForOrder(order);

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
    // A concurrent request with the same key may have inserted the order after
    // our preflight lookup. Replay that winning order instead of returning 500.
    const idempotencyKey =
      typeof (req.body as CheckoutSessionRequest | undefined)?.idempotencyKey ===
        "string" && (req.body as CheckoutSessionRequest).idempotencyKey!.trim()
        ? (req.body as CheckoutSessionRequest).idempotencyKey!.trim()
        : undefined;

    if (idempotencyKey && isDuplicateKeyError(error)) {
      const existingOrder = await Order.findOne({
        user: req.id,
        idempotencyKey,
      });
      if (existingOrder) {
        return replayExistingOrder(existingOrder, res);
      }
    }

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

    if (order.status === "cancelled") {
      return res.status(409).json({
        success: false,
        message: "This order is already cancelled",
        order,
      });
    }

    if (!validateStatusTransition(order.status, "cancelled")) {
      return res.status(400).json({
        success: false,
        message: `Cannot cancel an order that is already ${order.status}`,
      });
    }

    // Atomically claim the cancellation. The status predicate prevents two
    // simultaneous cancel requests (or a cancel racing the auto-cancel worker)
    // from both issuing a refund or both reporting success.
    const initialRefundStatus =
      order.paymentMethod === "stripe" && order.paymentIntentId
        ? "pending"
        : "not_applicable";
    const cancellationPaymentStatus = paymentStatusOnCancellation(order);

    const cancelled = await Order.findOneAndUpdate(
      { _id: order._id, user: req.id, status: order.status },
      {
        $set: {
          status: "cancelled",
          cancellationReason: "Cancelled by customer",
          cancelledAt: new Date(),
          cancelledBy: "customer",
          refundStatus: initialRefundStatus,
          paymentStatus: cancellationPaymentStatus,
        },
        $push: {
          paymentEvents: paymentEvent(
            initialRefundStatus === "pending" ? "refund_requested" : "cancellation",
            cancellationPaymentStatus,
            { amount: order.totalAmount, note: "Cancelled by customer" },
          ),
        },
      },
      { new: true },
    );

    if (!cancelled) {
      return res.status(409).json({
        success: false,
        message: "This order was already updated. Please refresh and try again.",
      });
    }

    if (initialRefundStatus === "pending") {
      const outcome = await refundOrderPayment(cancelled, "requested_by_customer");

      const nextPaymentStatus =
        outcome.status === "not_applicable"
          ? "unpaid"
          : paymentStatusAfterRefund(cancellationPaymentStatus, outcome.status);

      await Order.updateOne(
        { _id: cancelled._id },
        {
          $set: {
            refundStatus: outcome.status,
            paymentStatus: nextPaymentStatus,
            ...(outcome.refundId ? { refundId: outcome.refundId } : {}),
          },
          $push: {
            paymentEvents: paymentEvent(
              outcome.status === "refunded"
                ? "refund_succeeded"
                : outcome.status === "failed"
                  ? "refund_failed"
                  : "cancellation",
              nextPaymentStatus,
              {
                amount: cancelled.totalAmount,
                ...(outcome.refundId ? { providerId: outcome.refundId } : {}),
                ...(outcome.error
                  ? { note: outcome.error.slice(0, 300) }
                  : {}),
              },
            ),
          },
        },
      );

      cancelled.refundStatus = outcome.status;
      cancelled.paymentStatus = nextPaymentStatus;
      if (outcome.refundId) cancelled.refundId = outcome.refundId;
    }

    emitOrderStatus({
      orderId: cancelled._id.toString(),
      restaurantId: cancelled.restaurant.toString(),
      status: cancelled.status,
      totalAmount: cancelled.totalAmount,
      cancellationReason: cancelled.cancellationReason,
      cancelledAt: cancelled.cancelledAt,
      cancelledBy: cancelled.cancelledBy,
      refundStatus: cancelled.refundStatus,
      paymentStatus: cancelled.paymentStatus,
    });

    return res.status(200).json({
      success: true,
      message:
        cancelled.refundStatus === "failed"
          ? "Order cancelled. The refund could not be completed automatically. Please contact support."
          : "Order cancelled successfully",
      order: cancelled,
    });
  } catch {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// ======================= ORDER RECEIPT =======================
/**
 * Structured receipt data for one order. Authorised for the customer who
 * placed it, the restaurant owner, and admins. Returns JSON (no PDF
 * dependency): the client can render/print it, and it contains only data the
 * caller is already allowed to see.
 */
export const getOrderReceipt = async (req: Request, res: Response) => {
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

    const restaurant = await Restaurant.findById(order.restaurant).select(
      "user restaurantName contact",
    );

    const isCustomer = order.user.toString() === req.id;
    const isRestaurantOwner = restaurant?.user?.toString() === req.id;

    if (!isCustomer && !isRestaurantOwner && !req.admin) {
      return res.status(403).json({
        success: false,
        message: "You are not allowed to view this receipt",
      });
    }

    const round2 = (value: number) => Math.round(value * 100) / 100;

    const items = order.cartItems.map((item) => ({
      menuId: item.menuId,
      name: item.name,
      quantity: item.quantity,
      unitPrice: round2(item.price),
      lineTotal: round2(item.price * item.quantity),
    }));

    const subtotal = round2(
      order.subtotal ?? items.reduce((sum, item) => sum + item.lineTotal, 0),
    );
    const deliveryFee = round2(order.deliveryFee ?? 0);
    const totalAmount = round2(order.totalAmount ?? subtotal + deliveryFee);

    const receiptDate = order.createdAt.toISOString().slice(0, 10);
    const receiptNumber = `SF-${receiptDate.replace(/-/g, "")}-${order._id
      .toString()
      .slice(-6)
      .toUpperCase()}`;

    return res.status(200).json({
      success: true,
      receipt: {
        receiptNumber,
        issuedAt: new Date().toISOString(),
        orderId: order._id,
        orderDate: order.createdAt,
        status: order.status,
        currency: "INR",
        customer: {
          name: order.deliveryDetails.name,
          email: order.deliveryDetails.email,
          address: order.deliveryDetails.address,
          city: order.deliveryDetails.city,
          state: order.deliveryDetails.state ?? null,
          country: order.deliveryDetails.country ?? null,
          pincode: order.deliveryDetails.pincode,
        },
        restaurant: {
          id: restaurant?._id ?? order.restaurant,
          name:
            order.restaurantName || restaurant?.restaurantName || "Restaurant",
          contact: order.restaurantContact ?? restaurant?.contact ?? null,
        },
        items,
        totals: {
          subtotal,
          deliveryFee,
          total: totalAmount,
        },
        payment: {
          method: order.paymentMethod ?? null,
          status: order.paymentStatus ?? "unpaid",
          refundStatus: order.refundStatus ?? "not_applicable",
        },
        cancellation:
          order.status === "cancelled"
            ? {
                at: order.cancelledAt ?? null,
                by: order.cancelledBy ?? null,
                reason: order.cancellationReason ?? null,
              }
            : null,
      },
    });
  } catch (error) {
    logger.error({ err: error }, "Order receipt generation failed");
    return res
      .status(500)
      .json({ success: false, message: "Internal server error" });
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

  // Claim the event durably before doing any work. Exactly one delivery wins;
  // a restart or a second instance can no longer replay side effects.
  const ack = async () => {
    await completeWebhookEvent(event.id);
    return res.status(200).send();
  };

  let claim;
  try {
    claim = await claimWebhookEvent(event.id, event.type);
  } catch (error) {
    // If the durable dedupe store is unavailable we must not acknowledge the
    // event; a 500 lets Stripe redeliver it later.
    logger.error({ err: error, eventId: event.id }, "Webhook claim failed");
    return res.status(500).send("Webhook processing failed");
  }

  if (!claim.claimed) {
    logger.info(
      { eventId: event.id, type: event.type, reason: claim.reason },
      "Webhook event already handled or in progress"
    );
    return res.status(200).send();
  }

  try {
    if (
      event.type === "checkout.session.completed" ||
      event.type === "checkout.session.async_payment_succeeded"
    ) {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;

      if (!orderId) {
        logger.warn({ eventId: event.id }, "Webhook missing orderId metadata");
        return ack();
      }

      // Card payments are synchronous, but async payment methods can emit
      // `checkout.session.completed` while the money has not settled. Never
      // confirm (or count analytics for) an unpaid order.
      const paymentStatus = (
        session as Stripe.Checkout.Session & { payment_status?: string }
      ).payment_status;
      if (
        event.type === "checkout.session.completed" &&
        paymentStatus &&
        paymentStatus !== "paid" &&
        paymentStatus !== "no_payment_required"
      ) {
        logger.info(
          { eventId: event.id, orderId, paymentStatus },
          "Checkout session completed without a captured payment",
        );
        return ack();
      }

      const order = await Order.findById(orderId);
      if (!order) {
        logger.warn({ eventId: event.id, orderId }, "Webhook: order not found");
        return ack();
      }

      // Only process if still pending (idempotency)
      if (order.status !== "pending") {
        logger.info({ eventId: event.id, orderId, status: order.status }, "Order already processed");
        return ack();
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
        paymentStatus: order.paymentStatus,
        paymentEvents: (order.toObject() as any).paymentEvents ?? [],
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
            order.paymentStatus = "paid";
            order.paymentEvents = [
              ...(order.paymentEvents ?? []),
              paymentEvent("payment_succeeded", "paid", {
                amount: order.totalAmount,
                ...(session.payment_intent
                  ? { providerId: String(session.payment_intent) }
                  : {}),
              }),
            ];
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
                paymentStatus: previousState.paymentStatus,
                paymentEvents: previousState.paymentEvents,
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

        logger.info({ eventId: event.id, orderId }, "Order confirmed via webhook");

        emitNewOrder({
          orderId: order._id.toString(),
          restaurantId: order.restaurant.toString(),
          status: order.status,
          totalAmount: order.totalAmount,
          createdAt: order.createdAt,
        });
        emitOrderStatus({
          orderId: order._id.toString(),
          restaurantId: order.restaurant.toString(),
          status: order.status,
          totalAmount: order.totalAmount,
          paymentStatus: order.paymentStatus,
        });
      } catch (txnError) {
        logger.error({ err: txnError, orderId }, "Webhook confirmation failed");
        // Let the outer handler record the failure so Stripe can retry.
        throw txnError;
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
        order.paymentStatus = "failed";
        order.paymentEvents = [
          ...(order.paymentEvents ?? []),
          paymentEvent("payment_failed", "failed", {
            amount: order.totalAmount,
            ...(paymentIntent.id ? { providerId: paymentIntent.id } : {}),
            note: paymentIntent.last_payment_error?.message?.slice(0, 300),
          }),
        ];
        await order.save();
        logger.info({ orderId }, "Order marked as payment_failed");

        emitOrderStatus({
          orderId: order._id.toString(),
          restaurantId: order.restaurant.toString(),
          status: order.status,
          totalAmount: order.totalAmount,
          paymentStatus: order.paymentStatus,
        });
      }
    }

    if (event.type === "checkout.session.expired") {
      const session = event.data.object as Stripe.Checkout.Session;
      const orderId = session.metadata?.orderId;

      if (orderId) {
        const order = await Order.findById(orderId);
        if (order && order.status === "pending") {
          order.status = "cancelled";
          order.cancelledAt = new Date();
          order.cancelledBy = "system";
          order.cancellationReason = "Stripe checkout session expired";
          order.paymentStatus = "unpaid";
          order.paymentEvents = [
            ...(order.paymentEvents ?? []),
            paymentEvent("checkout_expired", "unpaid", {
              amount: order.totalAmount,
              ...(session.id ? { providerId: session.id } : {}),
            }),
          ];
          await order.save();
          logger.info({ orderId }, "Order cancelled due to expired checkout session");

          emitOrderStatus({
            orderId: order._id.toString(),
            restaurantId: order.restaurant.toString(),
            status: order.status,
            totalAmount: order.totalAmount,
            cancellationReason: order.cancellationReason,
            cancelledAt: order.cancelledAt,
            cancelledBy: order.cancelledBy,
            paymentStatus: order.paymentStatus,
          });
        }
      }
    }

    // Non-critical / unhandled event types are recorded as processed too, so a
    // redelivery does not re-run them.
    return ack();
  } catch (error) {
    logger.error({ err: error, eventId: event.id }, "Webhook processing error");
    try {
      await failWebhookEvent(event.id, error);
    } catch (markError) {
      // DB is probably down; still return 500 so Stripe retries.
      logger.error(
        { err: markError, eventId: event.id },
        "Failed to record webhook failure"
      );
    }
    return res.status(500).send("Webhook processing failed");
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
      .populate("restaurant", ORDER_RESTAURANT_FIELDS)
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

    return res.status(200).json({
      success: true,
      order: serializeOrder(order, isRestaurantOwner),
      session,
    });
  } catch {
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};