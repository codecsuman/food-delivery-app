import mongoose from "mongoose";
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
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        // Event listeners for connection health
        mongoose.connection.on("error", (err) => {
            console.error("❌ MongoDB connection error:", err);
        });
        mongoose.connection.on("disconnected", () => {
            console.warn("⚠️ MongoDB disconnected");
        });
        mongoose.connection.on("reconnected", () => {
            console.log("✅ MongoDB reconnected");
        });
        // Graceful shutdown
        process.on("SIGINT", async () => {
            await mongoose.connection.close();
            console.log("👋 MongoDB connection closed due to app termination");
            process.exit(0);
        });
    }
    catch (error) {
        console.error("❌ MongoDB Connection Failed");
        console.error(error);
        // Don't exit in test environment
        if (process.env.NODE_ENV !== "test") {
            process.exit(1);
        }
    }
};
export default connectDB;
