import { Server, Socket } from "socket.io";
import mapService from "../services/mapService.js";

interface DriverLocation {
  lng: number;
  lat: number;
}

export const setupTrackingSocket = (io: Server) => {
  io.on("connection", (socket: Socket) => {
    console.log("Client connected:", socket.id);

    // Driver joins order room
    socket.on(
      "driver:join",
      ({ orderId, driverId }: { orderId: string; driverId: string }) => {
        socket.join(`order:${orderId}`);
        (socket as any).driverId = driverId;
        (socket as any).orderId = orderId;
        console.log(`Driver ${driverId} joined order ${orderId}`);
      },
    );

    // Customer joins order room
    socket.on("customer:join", ({ orderId }: { orderId: string }) => {
      socket.join(`order:${orderId}`);
      console.log(`Customer joined order ${orderId}`);
    });

    // Driver sends location update every 5 seconds
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
          const { Order } = await import("../models/order.model.js");
          const order = await Order.findById(orderId)
            .populate("restaurant", "location")
            .populate("user", "location");

          if (!order) return;

          // Get restaurant location (fallback if no customer location)
          const restaurantLocation = (order.restaurant as any)?.location
            ?.coordinates;
          const customerLocation =
            (order as any).deliveryDetails?.coordinates || restaurantLocation;

          if (!customerLocation) return;

          // Calculate distance & ETA using YOUR rule (1km = 3min)
          const result = await mapService.getDistanceAndTime(
            [location.lng, location.lat],
            customerLocation as [number, number],
          );

          // Broadcast to customer
          io.to(`order:${orderId}`).emit("location:update", {
            driverId: (socket as any).driverId,
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
        } catch (error) {
          console.error("Tracking error:", error);
        }
      },
    );

    socket.on("disconnect", () => {
      console.log("Client disconnected:", socket.id);
    });
  });
};
