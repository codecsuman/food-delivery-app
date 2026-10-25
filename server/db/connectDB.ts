import mongoose from "mongoose";
import {
  logTransactionSupport,
  resetTransactionSupportCache,
} from "../utils/transactions.js";

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is not defined in .env");
    }

    // Connection options for better stability
    const options = {
      maxPoolSize: 10, // Max connections in pool
      serverSelectionTimeoutMS: 5000, // Timeout after 5s if can't connect
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
      family: 4, // Use IPv4, skip IPv6
    };

    const conn = await mongoose.connect(process.env.MONGO_URI, options);

    // Event listeners for connection health
    mongoose.connection.on("error", (err) => {
      // MongoDB connection error
    });

    mongoose.connection.on("disconnected", () => {
      // A topology change cannot be trusted until the connection is back.
      resetTransactionSupportCache();
    });

    mongoose.connection.on("reconnected", () => {
      // Re-probe transactions after a reconnect (e.g. MongoDB was converted
      // from standalone to a replica set while the API was running).
      resetTransactionSupportCache();
    });

    await logTransactionSupport();

    // Graceful shutdown
    process.on("SIGINT", async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  } catch (error) {
    // MongoDB Connection Failed
    if (process.env.NODE_ENV !== "test") {
      process.exit(1);
    }
  }
};

export default connectDB;
