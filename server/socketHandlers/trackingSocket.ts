import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import mapService from "../services/mapService.js";
import { logger } from "../utils/logger.js";

interface DriverLocation {
  lng: number;
  lat: number;
}

// In-memory driver registry (use Redis in production for multi-server)
const driverRegistry = new Map<string, { orderId: string; socketId: string }>();

// Rate limiting for location updates (per driver per order)
const locationUpdateLimiter = new Map<string, number>();

const authenticateSocket = (socket: Socket): { userId: string; isDriver?: boolean } | null => {
  try {
    let token = socket.handshake.auth?.token as string | undefined;

    if (!token && socket.handshake.headers.cookie) {
      const cookies = socket.handshake.headers.cookie
        .split(";")
        .map((c) => c.trim());
      const tokenCookie = cookies.find((c) => c.startsWith("token="));
      if (tokenCookie) token = tokenCookie.split("=")[1];
    }

    if (!token || !process.env.SECRET_KEY) return null;

    const decoded = jwt.verify(token, process.env.SECRET_KEY) as jwt.JwtPayload;
    if (!decoded?.userId) return null;

    // Check if user is a driver (could be a separate claim or role)
    const isDriver = decoded.role === "driver" || decoded.isDriver === true;

    return { userId: decoded.userId as string, isDriver };
  } catch {
    return null;
  }
};

export const setupTrackingSocket = (io: Server) => {
  // Authenticate all socket connections
  io.use((socket, next) => {
    const auth = authenticateSocket(socket);
    if (!auth) {
      return next(new Error("Authentication required"));
    }
    (socket as any).userId = auth.userId;
    (socket as any).isDriver = auth.isDriver;
    next();
  });

  io.on("connection", (socket: Socket) => {
    const userId = (socket as any).userId;
    const isDriver = (socket as any).isDriver;

    logger.info({ userId, isDriver, socketId: socket.id }, "Socket connected");

    // ========== DRIVER JOIN ==========
    socket.on(
      "driver:join",
      async ({ orderId }: { orderId: string }) => {
        try {
          // Only drivers can join as driver
          if (!isDriver) {
            socket.emit("error", { message: "Only drivers can join as driver" });
            return;
          }

          if (!mongoose.Types.ObjectId.isValid(orderId)) {
            socket.emit("error", { message: "Invalid order ID" });
            return;
          }

          const { Order } = await import("../models/order.model.js");
          const order = await Order.findById(orderId).populate("restaurant", "location");

          if (!order) {
            socket.emit("error", { message: "Order not found" });
            return;
          }

          // SECURITY FIX: Verify if this driver is authorized for this order
          // In a real system, you'd have a 'driver' field on the Order model
          // For now, we ensure the order is trackable and not already hijacked
          if (!["confirmed", "preparing", "outfordelivery"].includes(order.status)) {
            socket.emit("error", { message: "Order not ready for tracking" });
            return;
          }

          // Check if another driver is already assigned
          const existingAssignment = driverRegistry.get(orderId);
          if (existingAssignment && existingAssignment.socketId !== socket.id) {
            socket.emit("error", { message: "Another driver is already assigned to this order" });
            return;
          }

          // Assign driver to order
          driverRegistry.set(orderId, { orderId, socketId: socket.id });
          (socket as any).assignedOrderId = orderId;

          socket.join(`order:${orderId}`);
          socket.emit("driver:joined", { orderId, message: "Successfully joined order room" });

          logger.info({ userId, orderId, socketId: socket.id }, "Driver joined order");
        } catch (error) {
          logger.error({ err: error, userId }, "Driver join error");
          socket.emit("error", { message: "Failed to join order" });
        }
      }
    );

    // ========== CUSTOMER JOIN ==========
    socket.on("customer:join", async ({ orderId }: { orderId: string }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
          socket.emit("error", { message: "Invalid order ID" });
          return;
        }

        const { Order } = await import("../models/order.model.js");
        const order = await Order.findById(orderId);

        if (!order) {
          socket.emit("error", { message: "Order not found" });
          return;
        }

        const orderUserId = (order.user as any)._id?.toString() || (order.user as any).toString();

        if (orderUserId !== userId) {
          socket.emit("error", { message: "Not authorized for this order" });
          return;
        }

        socket.join(`order:${orderId}`);

        // Send the most recent known position immediately. Without this, a
        // customer opening/reloading the tracking page would see the driver at
        // the restaurant until the driver's next GPS update (which may be
        // several seconds away, or never if the driver's app is offline).
        const latestHistory =
          Array.isArray(order.trackingHistory) && order.trackingHistory.length > 0
            ? order.trackingHistory[order.trackingHistory.length - 1]
            : null;
        const storedLocation =
          Array.isArray(order.driverLocation) && order.driverLocation.length === 2
            ? order.driverLocation
            : latestHistory?.location;

        if (
          Array.isArray(storedLocation) &&
          storedLocation.length === 2 &&
          typeof storedLocation[0] === "number" &&
          typeof storedLocation[1] === "number" &&
          !(storedLocation[0] === 0 && storedLocation[1] === 0)
        ) {
          socket.emit("tracking:snapshot", {
            driverId: null,
            location: { lng: storedLocation[0], lat: storedLocation[1] },
            status: order.status,
            eta: order.currentEta ?? null,
            distanceRemaining: order.currentDistance ?? null,
            timestamp: order.driverLocationUpdatedAt || latestHistory?.timestamp || null,
          });
        }

        logger.info({ userId, orderId }, "Customer joined order room");
      } catch (error) {
        logger.error({ err: error, userId }, "Customer join error");
        socket.emit("error", { message: "Failed to join order" });
      }
    });

    // ========== RESTAURANT OWNER JOIN ==========
    // Owners subscribe to their restaurant's room so status changes (including
    // auto-cancellations) appear live on the dashboard.
    socket.on("restaurant:join", async ({ restaurantId }: { restaurantId: string }) => {
      try {
        if (!mongoose.Types.ObjectId.isValid(restaurantId)) {
          socket.emit("error", { message: "Invalid restaurant ID" });
          return;
        }

        const { Restaurant } = await import("../models/restaurant.model.js");
        const ownsRestaurant = await Restaurant.exists({
          _id: restaurantId,
          user: userId,
        });

        if (!ownsRestaurant) {
          socket.emit("error", { message: "Not authorized for this restaurant" });
          return;
        }

        socket.join(`restaurant:${restaurantId}`);
        logger.info({ userId, restaurantId }, "Restaurant owner joined room");
      } catch (error) {
        logger.error({ err: error, userId }, "Restaurant join error");
        socket.emit("error", { message: "Failed to join restaurant" });
      }
    });

    // ========== RESTAURANT OWNER JOIN (ALL OWNED RESTAURANTS) ==========
    // The dashboard does not know every restaurant id before it renders, so it
    // joins once and the server resolves the ownership. This keeps the order
    // list live without an extra round-trip on page load.
    socket.on("owner:join", async () => {
      try {
        const { Restaurant } = await import("../models/restaurant.model.js");
        const restaurants = await Restaurant.find({ user: userId }).select("_id");

        const restaurantIds = restaurants.map((r) => r._id.toString());
        for (const restaurantId of restaurantIds) {
          socket.join(`restaurant:${restaurantId}`);
        }

        socket.emit("owner:joined", { restaurantIds });
        logger.info(
          { userId, restaurantCount: restaurantIds.length },
          "Restaurant owner joined dashboard rooms",
        );
      } catch (error) {
        logger.error({ err: error, userId }, "Owner join error");
        socket.emit("error", { message: "Failed to join restaurant rooms" });
      }
    });

    // ========== DRIVER LOCATION UPDATE ==========
    socket.on(
      "driver:location",
      async ({
        orderId,
        location,
        status,
      }: {
        orderId: string;
        location: DriverLocation;
        status: string;
      }) => {
        try {
          // Verify this driver is assigned to this order
          const assignment = driverRegistry.get(orderId);
          if (!assignment || assignment.socketId !== socket.id) {
            socket.emit("error", { message: "Not authorized to update this order" });
            return;
          }

          // Rate limiting: max 1 update per 3 seconds per driver per order
          const rateLimitKey = `${userId}:${orderId}`;
          const now = Date.now();
          const lastUpdate = locationUpdateLimiter.get(rateLimitKey) || 0;
          if (now - lastUpdate < 3000) {
            return; // Silently drop excessive updates
          }
          locationUpdateLimiter.set(rateLimitKey, now);

          // Validate coordinates
          if (
            typeof location.lng !== "number" ||
            typeof location.lat !== "number" ||
            location.lng < -180 || location.lng > 180 ||
            location.lat < -90 || location.lat > 90 ||
            (location.lng === 0 && location.lat === 0)
          ) {
            socket.emit("error", { message: "Invalid coordinates" });
            return;
          }

          // Validate status
          const allowedStatuses = ["confirmed", "preparing", "outfordelivery", "delivered", "cancelled"];
          if (!allowedStatuses.includes(status)) {
            socket.emit("error", { message: "Invalid status" });
            return;
          }

          const { Order } = await import("../models/order.model.js");
          const order = await Order.findById(orderId).populate("restaurant", "location");

          if (!order) {
            socket.emit("error", { message: "Order not found" });
            return;
          }

          // Stop tracking if order is delivered or cancelled
          if (["delivered", "cancelled", "payment_failed"].includes(order.status)) {
            socket.emit("error", { message: "Order no longer trackable" });
            driverRegistry.delete(orderId);
            locationUpdateLimiter.delete(rateLimitKey);
            return;
          }

          // Get customer location
          const restaurantLocation = (order.restaurant as any)?.location?.coordinates;
          const customerLocation =
            order.deliveryDetails?.lat != null && order.deliveryDetails?.lng != null
              ? [order.deliveryDetails.lng, order.deliveryDetails.lat]
              : restaurantLocation;

          if (!customerLocation) {
            logger.warn({ orderId }, "No customer location for tracking");
            return;
          }

          // Calculate distance & ETA
          const result = await mapService.getDistanceAndTime(
            [location.lng, location.lat],
            customerLocation as [number, number]
          );

          // Broadcast to customer
          io.to(`order:${orderId}`).emit("location:update", {
            driverId: userId, // Server-derived, not client-supplied
            location,
            status,
            eta: result.estimatedMinutes,
            distanceRemaining: result.distanceKm,
            timestamp: new Date(),
          });

          // Persist the latest position on every accepted update so the
          // tracking page can render the *current* position immediately after
          // a refresh. Only append the (potentially large) history entry every
          // 30 seconds to keep writes small.
          const update: Record<string, unknown> = {
            $set: {
              driverLocation: [location.lng, location.lat],
              driverLocationUpdatedAt: new Date(),
              currentEta: result.estimatedMinutes,
              currentDistance: result.distanceKm,
            },
          };

          const lastDbUpdate = (socket as any).lastDbUpdate || 0;
          if (now - lastDbUpdate >= 30000) {
            update.$push = {
              trackingHistory: {
                location: [location.lng, location.lat],
                status,
                timestamp: new Date(),
              },
            };
            (socket as any).lastDbUpdate = now;
          }

          await Order.findByIdAndUpdate(orderId, update);
        } catch (error) {
          logger.error({ err: error, userId, orderId }, "Tracking error");
        }
      }
    );

    // ========== CLEANUP ON DISCONNECT ==========
    socket.on("disconnect", () => {
      const assignedOrderId = (socket as any).assignedOrderId;
      if (assignedOrderId) {
        const assignment = driverRegistry.get(assignedOrderId);
        if (assignment && assignment.socketId === socket.id) {
          driverRegistry.delete(assignedOrderId);
        }
        locationUpdateLimiter.delete(`${userId}:${assignedOrderId}`);
      }
      logger.info({ userId, socketId: socket.id }, "Socket disconnected");
    });
  });
};