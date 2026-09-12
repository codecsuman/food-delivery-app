import jwt from "jsonwebtoken";
import mapService from "../services/mapService.js";
// FIX: require a valid JWT before allowing any socket connection at all.
// Token can arrive via socket.handshake.auth.token (preferred, sent explicitly
// by the client) or be parsed from the cookie header as a fallback.
const authenticateSocket = (socket) => {
    try {
        let token = socket.handshake.auth?.token;
        if (!token && socket.handshake.headers.cookie) {
            const cookies = socket.handshake.headers.cookie
                .split(";")
                .map((c) => c.trim());
            const tokenCookie = cookies.find((c) => c.startsWith("token="));
            if (tokenCookie)
                token = tokenCookie.split("=")[1];
        }
        if (!token || !process.env.SECRET_KEY)
            return null;
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        if (!decoded?.userId)
            return null;
        return { userId: decoded.userId };
    }
    catch {
        return null;
    }
};
export const setupTrackingSocket = (io) => {
    // FIX: reject the connection entirely if there's no valid token
    io.use((socket, next) => {
        const auth = authenticateSocket(socket);
        if (!auth) {
            return next(new Error("Authentication required"));
        }
        socket.userId = auth.userId;
        next();
    });
    io.on("connection", (socket) => {
        console.log("Client connected:", socket.id, "user:", socket.userId);
        // Driver joins order room
        socket.on("driver:join", async ({ orderId, driverId }) => {
            try {
                // NOTE: cannot yet verify this socket's user is the order's assigned
                // driver — the Order schema has no driver/rider field to check against.
                // At minimum, confirm the order exists before allowing the join.
                const { Order } = await import("../models/order.model.js");
                const order = await Order.findById(orderId);
                if (!order) {
                    socket.emit("error", { message: "Order not found" });
                    return;
                }
                socket.join(`order:${orderId}`);
                socket.driverId = driverId;
                socket.orderId = orderId;
                console.log(`Driver ${driverId} joined order ${orderId}`);
            }
            catch (error) {
                console.error("driver:join error:", error);
            }
        });
        // Customer joins order room
        socket.on("customer:join", async ({ orderId }) => {
            try {
                // FIX: verify the connected user actually owns this order before
                // letting them into the room and receiving live location broadcasts.
                const { Order } = await import("../models/order.model.js");
                const order = await Order.findById(orderId);
                if (!order) {
                    socket.emit("error", { message: "Order not found" });
                    return;
                }
                const orderUserId = order.user._id?.toString() || order.user.toString();
                if (orderUserId !== socket.userId) {
                    socket.emit("error", { message: "Not authorized for this order" });
                    return;
                }
                socket.join(`order:${orderId}`);
                console.log(`Customer joined order ${orderId}`);
            }
            catch (error) {
                console.error("customer:join error:", error);
            }
        });
        // Driver sends location update every 5 seconds
        socket.on("driver:location", async ({ orderId, location, status, }) => {
            try {
                const { Order } = await import("../models/order.model.js");
                const order = await Order.findById(orderId)
                    .populate("restaurant", "location")
                    .populate("user", "location");
                if (!order)
                    return;
                // Get restaurant location (fallback if no customer location)
                const restaurantLocation = order.restaurant?.location
                    ?.coordinates;
                const customerLocation = order.deliveryDetails?.coordinates || restaurantLocation;
                if (!customerLocation)
                    return;
                // Calculate distance & ETA using YOUR rule (1km = 3min)
                const result = await mapService.getDistanceAndTime([location.lng, location.lat], customerLocation);
                // Broadcast to customer
                io.to(`order:${orderId}`).emit("location:update", {
                    driverId: socket.driverId,
                    location,
                    status,
                    eta: result.estimatedMinutes,
                    distanceRemaining: result.distanceKm,
                    timestamp: new Date(),
                });
                // Save to DB
                await Order.findByIdAndUpdate(orderId, {
                    currentEta: result.estimatedMinutes,
                    currentDistance: result.distanceKm,
                    $push: {
                        trackingHistory: {
                            location: [location.lng, location.lat],
                            status,
                            timestamp: new Date(),
                        },
                    },
                });
            }
            catch (error) {
                console.error("Tracking error:", error);
            }
        });
        socket.on("disconnect", () => {
            console.log("Client disconnected:", socket.id);
        });
    });
};
