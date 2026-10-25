import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Server as HttpServer } from "http";
import { Server as ServerIO } from "socket.io";
import { io as ClientIO, Socket as ClientSocket } from "socket.io-client";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { User } from "../models/user.model.js";
import { Restaurant } from "../models/restaurant.model.js";
import { Menu } from "../models/menu.model.js";
import { Order } from "../models/order.model.js";
import { setupTrackingSocket } from "../socketHandlers/trackingSocket.js";

describe("Socket.IO Tracking Security Tests", () => {
  let httpServer: HttpServer;
  let ioServer: ServerIO;
  let serverPort: number;
  let testUser: any;
  let driverUser: any;
  let testRestaurant: any;
  let testMenu: any;
  let testOrder: any;
  let userToken: string;
  let driverToken: string;
  let openSockets: ClientSocket[];

  beforeEach(async () => {
    openSockets = [];

    // Create HTTP server on random port
    httpServer = new HttpServer();
    ioServer = new ServerIO(httpServer, {
      cors: { origin: "*", credentials: true },
    });

    setupTrackingSocket(ioServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        serverPort = (httpServer.address() as any).port;
        resolve();
      });
    });

    // Create test users
    testUser = await User.create({
      fullname: "Test Customer",
      email: "customer@example.com",
      password: await import("bcryptjs").then((b) => b.hash("password123", 10)),
      isVerified: true,
    });

    driverUser = await User.create({
      fullname: "Test Driver",
      email: "driver@example.com",
      password: await import("bcryptjs").then((b) => b.hash("password123", 10)),
      isVerified: true,
    });

    testRestaurant = await Restaurant.create({
      user: testUser._id,
      restaurantName: "Test Restaurant",
      city: "Kolkata",
      country: "India",
      pincode: "700001",
      deliveryTime: 30,
      deliveryPrice: 50,
      cuisines: ["Italian"],
      imageUrl: "https://test.com/image.jpg",
      location: { type: "Point", coordinates: [88.3639, 22.5726] },
    });

    testMenu = await Menu.create({
      name: "Test Pizza",
      description: "Delicious pizza",
      price: 200,
      image: "https://test.com/pizza.jpg",
      restaurant: testRestaurant._id,
    });

    testOrder = await Order.create({
      user: testUser._id,
      restaurant: testRestaurant._id,
      deliveryDetails: {
        name: "Test",
        email: "test@test.com",
        address: "123 Test St",
        city: "Kolkata",
        lat: 22.5726,
        lng: 88.3639,
      },
      cartItems: [
        {
          menuId: testMenu._id.toString(),
          name: "Test Pizza",
          image: "",
          price: 200,
          quantity: 1,
        },
      ],
      totalAmount: 250,
      status: "outfordelivery",
      paymentMethod: "cod",
    });

    userToken = jwt.sign(
      { userId: testUser._id.toString(), email: testUser.email, admin: false, role: "customer" },
      process.env.SECRET_KEY!,
      { expiresIn: "7d" }
    );

    driverToken = jwt.sign(
      { userId: driverUser._id.toString(), email: driverUser.email, admin: false, role: "driver", isDriver: true },
      process.env.SECRET_KEY!,
      { expiresIn: "7d" }
    );
  });

  afterEach(async () => {
    for (const socket of openSockets) {
      socket.removeAllListeners();
      socket.disconnect();
    }
    // Give the server a moment to process disconnect cleanup (driver registry,
    // location rate limits) before the next test starts.
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (ioServer) {
      await ioServer.close();
    }
    if (httpServer?.listening) {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    }
  });

  const socketUrl = () => `http://localhost:${serverPort}`;

  const connectSocket = (token?: string): Promise<ClientSocket> => {
    return new Promise((resolve, reject) => {
      const socket = ClientIO(socketUrl(), {
        auth: token ? { token } : {},
        transports: ["websocket"],
        reconnection: false,
      });
      openSockets.push(socket);

      const timer = setTimeout(() => reject(new Error("Socket connect timeout")), 5000);
      socket.once("connect", () => {
        clearTimeout(timer);
        resolve(socket);
      });
      socket.once("connect_error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  };

  const expectConnectError = (token?: string): Promise<Error> => {
    return new Promise((resolve, reject) => {
      const socket = ClientIO(socketUrl(), {
        auth: token ? { token } : {},
        transports: ["websocket"],
        reconnection: false,
      });
      openSockets.push(socket);

      const timer = setTimeout(() => reject(new Error("Expected a connect_error")), 5000);
      socket.once("connect_error", (err) => {
        clearTimeout(timer);
        socket.disconnect();
        resolve(err);
      });
    });
  };

  const waitForEvent = <T = any>(socket: ClientSocket, event: string, timeoutMs = 5000): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timed out waiting for "${event}"`)),
        timeoutMs
      );
      socket.once(event, (payload: T) => {
        clearTimeout(timer);
        resolve(payload);
      });
    });
  };

  const expectNoEvent = (socket: ClientSocket, event: string, waitMs = 400): Promise<void> => {
    return new Promise((resolve, reject) => {
      const onEvent = (payload: any) => {
        clearTimeout(timer);
        reject(new Error(`Unexpected "${event}" event: ${JSON.stringify(payload)}`));
      };
      const timer = setTimeout(() => {
        socket.off(event, onEvent);
        resolve();
      }, waitMs);
      socket.once(event, onEvent);
    });
  };

  describe("Socket Authentication", () => {
    it("should reject connection without token", async () => {
      const err = await expectConnectError();
      expect(err.message).toBe("Authentication required");
    });

    it("should reject connection with invalid token", async () => {
      const err = await expectConnectError("invalid-token");
      expect(err.message).toBe("Authentication required");
    });

    it("should accept valid customer token", async () => {
      const socket = await connectSocket(userToken);
      expect(socket.connected).toBe(true);
    });

    it("should accept valid driver token", async () => {
      const socket = await connectSocket(driverToken);
      expect(socket.connected).toBe(true);
    });
  });

  describe("Customer Room Join", () => {
    it("should allow customer to join their own order room", async () => {
      const socket = await connectSocket(userToken);
      socket.emit("customer:join", { orderId: testOrder._id.toString() });
      await expectNoEvent(socket, "error");
    });

    it("should reject customer joining another user's order", async () => {
      const otherUser = await User.create({
        fullname: "Other User",
        email: "other@example.com",
        password: await import("bcryptjs").then((b) => b.hash("password123", 10)),
        isVerified: true,
      });

      const otherToken = jwt.sign(
        { userId: otherUser._id.toString(), email: otherUser.email, admin: false, role: "customer" },
        process.env.SECRET_KEY!,
        { expiresIn: "7d" }
      );

      const socket = await connectSocket(otherToken);
      const errorPromise = waitForEvent<{ message: string }>(socket, "error");
      socket.emit("customer:join", { orderId: testOrder._id.toString() });

      const error = await errorPromise;
      expect(error.message).toBe("Not authorized for this order");
    });
  });

  describe("Driver Room Join", () => {
    it("should reject non-driver joining as driver", async () => {
      const socket = await connectSocket(userToken);
      const errorPromise = waitForEvent<{ message: string }>(socket, "error");
      socket.emit("driver:join", { orderId: testOrder._id.toString() });

      const error = await errorPromise;
      expect(error.message).toBe("Only drivers can join as driver");
    });

    it("should allow driver to join order room", async () => {
      const socket = await connectSocket(driverToken);
      const joinedPromise = waitForEvent<{ orderId: string }>(socket, "driver:joined");
      socket.emit("driver:join", { orderId: testOrder._id.toString() });

      const data = await joinedPromise;
      expect(data.orderId).toBe(testOrder._id.toString());
    });

    it("should reject driver joining order in wrong state", async () => {
      testOrder.status = "delivered";
      await testOrder.save();

      const socket = await connectSocket(driverToken);
      const errorPromise = waitForEvent<{ message: string }>(socket, "error");
      socket.emit("driver:join", { orderId: testOrder._id.toString() });

      const error = await errorPromise;
      expect(error.message).toBe("Order not ready for tracking");
    });

    it("should prevent multiple drivers joining same order", async () => {
      const socket1 = await connectSocket(driverToken);
      const driver2Id = new mongoose.Types.ObjectId();
      const driver2Token = jwt.sign(
        {
          userId: driver2Id.toString(),
          email: "driver2@example.com",
          admin: false,
          role: "driver",
          isDriver: true,
        },
        process.env.SECRET_KEY!,
        { expiresIn: "7d" }
      );
      const socket2 = await connectSocket(driver2Token);

      const joinedPromise = waitForEvent(socket1, "driver:joined");
      socket1.emit("driver:join", { orderId: testOrder._id.toString() });
      await joinedPromise;

      const errorPromise = waitForEvent<{ message: string }>(socket2, "error");
      socket2.emit("driver:join", { orderId: testOrder._id.toString() });

      const error = await errorPromise;
      expect(error.message).toBe("Another driver is already assigned to this order");
    });
  });

  describe("Driver Location Updates", () => {
    let driverSocket: ClientSocket;
    let customerSocket: ClientSocket;

    const joinTrackingRoom = async () => {
      driverSocket = await connectSocket(driverToken);
      customerSocket = await connectSocket(userToken);

      const driverJoined = waitForEvent(driverSocket, "driver:joined");
      driverSocket.emit("driver:join", { orderId: testOrder._id.toString() });
      await driverJoined;

      customerSocket.emit("customer:join", { orderId: testOrder._id.toString() });
      // Give the server time to process the room join.
      await new Promise((resolve) => setTimeout(resolve, 100));
    };

    beforeEach(async () => {
      await joinTrackingRoom();
    });

    it("should reject location update from non-assigned driver", async () => {
      const driver2Id = new mongoose.Types.ObjectId();
      const driver2Token = jwt.sign(
        {
          userId: driver2Id.toString(),
          email: "driver2@example.com",
          admin: false,
          role: "driver",
          isDriver: true,
        },
        process.env.SECRET_KEY!,
        { expiresIn: "7d" }
      );
      const otherDriver = await connectSocket(driver2Token);

      const errorPromise = waitForEvent<{ message: string }>(otherDriver, "error");
      otherDriver.emit("driver:location", {
        orderId: testOrder._id.toString(),
        location: { lng: 88.3739, lat: 22.5826 },
        status: "outfordelivery",
      });

      const error = await errorPromise;
      expect(error.message).toBe("Not authorized to update this order");
    });

    it("should broadcast location update to customer", async () => {
      const updatePromise = waitForEvent(customerSocket, "location:update");

      driverSocket.emit("driver:location", {
        orderId: testOrder._id.toString(),
        location: { lng: 88.3739, lat: 22.5826 },
        status: "outfordelivery",
      });

      const data = await updatePromise;
      expect(data.driverId).toBeDefined();
      expect(data.location).toEqual({ lng: 88.3739, lat: 22.5826 });
      expect(data.eta).toBeDefined();
      expect(data.distanceRemaining).toBeDefined();
    });

    it("should persist the latest driver position and replay it to a newly joined customer", async () => {
      const updatePromise = waitForEvent(customerSocket, "location:update");
      driverSocket.emit("driver:location", {
        orderId: testOrder._id.toString(),
        location: { lng: 88.451, lat: 22.551 },
        status: "outfordelivery",
      });
      await updatePromise;

      // The broadcast happens before the DB write, so wait briefly for it.
      let savedLocation: number[] | undefined;
      for (let i = 0; i < 20; i++) {
        const saved = await Order.findById(testOrder._id);
        if (Array.isArray(saved?.driverLocation) && saved.driverLocation.length === 2) {
          savedLocation = saved.driverLocation;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      expect(savedLocation).toEqual([88.451, 22.551]);

      // A page refresh / second tab must immediately receive the stored
      // position instead of showing the restaurant until the next GPS event.
      const lateSocket = await connectSocket(userToken);
      const snapshotPromise = waitForEvent(lateSocket, "tracking:snapshot");
      lateSocket.emit("customer:join", { orderId: testOrder._id.toString() });

      const snapshot = await snapshotPromise;
      expect(snapshot.location).toEqual({ lng: 88.451, lat: 22.551 });
      expect(snapshot.status).toBeDefined();
    });

    it("should reject invalid coordinates", async () => {
      const errorPromise = waitForEvent<{ message: string }>(driverSocket, "error");
      driverSocket.emit("driver:location", {
        orderId: testOrder._id.toString(),
        location: { lng: 200, lat: 22.5726 },
        status: "outfordelivery",
      });

      const error = await errorPromise;
      expect(error.message).toBe("Invalid coordinates");
    });

    it("should reject null island coordinates", async () => {
      const errorPromise = waitForEvent<{ message: string }>(driverSocket, "error");
      driverSocket.emit("driver:location", {
        orderId: testOrder._id.toString(),
        location: { lng: 0, lat: 0 },
        status: "outfordelivery",
      });

      const error = await errorPromise;
      expect(error.message).toBe("Invalid coordinates");
    });

    it("should reject invalid status", async () => {
      const errorPromise = waitForEvent<{ message: string }>(driverSocket, "error");
      driverSocket.emit("driver:location", {
        orderId: testOrder._id.toString(),
        location: { lng: 88.3739, lat: 22.5826 },
        status: "invalid_status",
      });

      const error = await errorPromise;
      expect(error.message).toBe("Invalid status");
    });

    it("should stop tracking for delivered order", async () => {
      testOrder.status = "delivered";
      await testOrder.save();

      const errorPromise = waitForEvent<{ message: string }>(driverSocket, "error");
      driverSocket.emit("driver:location", {
        orderId: testOrder._id.toString(),
        location: { lng: 88.3739, lat: 22.5826 },
        status: "outfordelivery",
      });

      const error = await errorPromise;
      expect(error.message).toBe("Order no longer trackable");
    });

    it("should rate limit location updates", async () => {
      let updateCount = 0;
      customerSocket.on("location:update", () => {
        updateCount++;
      });

      // Send 5 rapid updates (only 1 per 3s should be processed)
      for (let i = 0; i < 5; i++) {
        driverSocket.emit("driver:location", {
          orderId: testOrder._id.toString(),
          location: { lng: 88.3739 + i * 0.001, lat: 22.5826 + i * 0.001 },
          status: "outfordelivery",
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 400));
      expect(updateCount).toBeLessThanOrEqual(1);
      expect(updateCount).toBeGreaterThanOrEqual(1);
    });
  });
});
