import mapService from "../services/mapService.js";
export const setupTrackingSocket = (io) => {
    io.on("connection", (socket) => {
        console.log("Client connected:", socket.id);
        // Driver joins order room
        socket.on("driver:join", ({ orderId, driverId }) => {
            socket.join(`order:${orderId}`);
            socket.driverId = driverId;
            socket.orderId = orderId;
            console.log(`Driver ${driverId} joined order ${orderId}`);
        });
        // Customer joins order room
        socket.on("customer:join", ({ orderId }) => {
            socket.join(`order:${orderId}`);
            console.log(`Customer joined order ${orderId}`);
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
