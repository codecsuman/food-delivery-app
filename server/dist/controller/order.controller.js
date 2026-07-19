import { Restaurant } from "../models/restaurant.model.js";
import { Order } from "../models/order.model.js";
import Stripe from "stripe";
import mongoose from "mongoose";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
// ======================= GET ORDERS (for user) =======================
export const getOrders = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
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
    }
    catch (error) {
        console.error("Get orders error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};
// ======================= GET ORDER BY ID =======================
export const getOrderById = async (req, res) => {
    try {
        const { orderId } = req.params;
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            return res
                .status(400)
                .json({ success: false, message: "Invalid order ID" });
        }
        const order = await Order.findById(orderId)
            .populate("restaurant", "restaurantName imageUrl")
            .populate("user", "fullname email");
        if (!order) {
            return res
                .status(404)
                .json({ success: false, message: "Order not found" });
        }
        if (order.user.toString() !== req.id) {
            return res
                .status(403)
                .json({ success: false, message: "Not authorized" });
        }
        return res.status(200).json({ success: true, order });
    }
    catch (error) {
        console.error("Get order by id error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};
// ======================= CREATE CHECKOUT SESSION =======================
export const createCheckoutSession = async (req, res) => {
    try {
        const checkoutSessionRequest = req.body;
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
        const restaurant = await Restaurant.findById(checkoutSessionRequest.restaurantId).populate("menus");
        if (!restaurant) {
            return res
                .status(404)
                .json({ success: false, message: "Restaurant not found" });
        }
        const totalAmount = checkoutSessionRequest.cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const paymentMethod = req.body.paymentMethod || "stripe";
        // ========== CASH ON DELIVERY (DEMO SKIP) ==========
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
            // Increment orderCount for each menu item
            const Menu = mongoose.model("Menu");
            for (const item of checkoutSessionRequest.cartItems) {
                await Menu.findByIdAndUpdate(item.menuId, { $inc: { orderCount: 1 } });
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
                    product_data: { name: "Delivery Fee" },
                    unit_amount: Math.round(restaurant.deliveryPrice * 100),
                },
                quantity: 1,
            });
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
                images: JSON.stringify(checkoutSessionRequest.cartItems.map((item) => item.image)),
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
    }
    catch (error) {
        console.error("Create checkout session error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};
// ======================= STRIPE WEBHOOK =======================
export const stripeWebhook = async (req, res) => {
    let event;
    try {
        const signature = req.headers["stripe-signature"];
        if (!signature) {
            return res.status(400).send("Missing stripe-signature header");
        }
        const secret = process.env.WEBHOOK_ENDPOINT_SECRET;
        event = stripe.webhooks.constructEvent(req.body, signature, secret);
    }
    catch (error) {
        console.error("Webhook signature verification failed:", error.message);
        return res.status(400).send(`Webhook error: ${error.message}`);
    }
    if (event.type === "checkout.session.completed") {
        try {
            const session = event.data.object;
            const order = await Order.findById(session.metadata?.orderId);
            if (!order) {
                console.error(`Webhook: order ${session.metadata?.orderId} not found`);
                return res.status(200).send();
            }
            // ✅ IDEMPOTENCY FIX: Only process if still pending
            if (order.status !== "pending") {
                console.log(`Webhook: order ${order._id} already processed (status: ${order.status})`);
                return res.status(200).send();
            }
            if (session.amount_total) {
                order.totalAmount = session.amount_total / 100;
            }
            order.status = "confirmed";
            order.paymentIntentId = session.payment_intent;
            await order.save();
            // Increment orderCount for each menu item
            const Menu = mongoose.model("Menu");
            for (const item of order.cartItems) {
                await Menu.findByIdAndUpdate(item.menuId, { $inc: { orderCount: 1 } });
            }
            console.log(`Order ${order._id} confirmed via webhook`);
        }
        catch (error) {
            console.error("Error handling webhook event:", error);
            return res.status(200).send();
        }
    }
    if (event.type === "payment_intent.payment_failed") {
        try {
            const paymentIntent = event.data.object;
            const order = await Order.findOne({ paymentIntentId: paymentIntent.id });
            if (order) {
                // ✅ Only mark as failed if not already confirmed
                if (order.status === "pending") {
                    order.status = "payment_failed";
                    await order.save();
                    console.log(`Order ${order._id} payment failed`);
                }
            }
        }
        catch (error) {
            console.error("Error handling payment failure:", error);
        }
    }
    res.status(200).send();
};
// ======================= CREATE LINE ITEMS =======================
export const createLineItems = (checkoutSessionRequest, menuItems) => {
    const lineItems = checkoutSessionRequest.cartItems.map((cartItem) => {
        const menuItem = menuItems.find((item) => item._id.toString() === cartItem.menuId);
        if (!menuItem) {
            throw new Error(`Menu item ${cartItem.menuId} not found`);
        }
        const productData = { name: menuItem.name };
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
export const getOrderBySessionId = async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (!session.metadata?.orderId) {
            return res
                .status(404)
                .json({ success: false, message: "Order not found for this session" });
        }
        const order = await Order.findById(session.metadata.orderId)
            .populate("restaurant", "restaurantName imageUrl")
            .populate("user", "fullname email");
        if (!order) {
            return res
                .status(404)
                .json({ success: false, message: "Order not found" });
        }
        // ✅ Authorization check
        if (order.user.toString() !== req.id) {
            return res
                .status(403)
                .json({ success: false, message: "Not authorized" });
        }
        return res.status(200).json({ success: true, order, session });
    }
    catch (error) {
        console.error("Get order by session error:", error);
        return res
            .status(500)
            .json({ success: false, message: "Internal server error" });
    }
};
