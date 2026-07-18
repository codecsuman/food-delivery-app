import dotenv from "dotenv";
// Load env immediately - safety net in case this file is imported before index.ts
dotenv.config();
import { v2 as cloudinary } from "cloudinary";
// Check if Cloudinary env vars are available
const hasCloudinaryConfig = process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET;
if (hasCloudinaryConfig) {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    console.log("✅ [Cloudinary] Configured successfully.");
}
else {
    console.log("⚠️  [Cloudinary] Environment variables missing — image uploads will be skipped.");
    console.log("   Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in .env");
}
// Upload image to Cloudinary
export const uploadImage = async (base64Image, folder = "suman-food") => {
    if (!hasCloudinaryConfig) {
        console.warn("⚠️  [Cloudinary] Skipping upload — config not available.");
        return {
            secure_url: "https://via.placeholder.com/400x300?text=No+Image",
            public_id: "placeholder",
        };
    }
    try {
        const result = await cloudinary.uploader.upload(base64Image, {
            folder,
            resource_type: "image",
        });
        return {
            secure_url: result.secure_url,
            public_id: result.public_id,
        };
    }
    catch (error) {
        console.error("❌ Cloudinary upload error:", error);
        throw new Error("Failed to upload image to Cloudinary");
    }
};
// Delete image from Cloudinary
export const deleteImage = async (publicId) => {
    if (!hasCloudinaryConfig || publicId === "placeholder") {
        return;
    }
    try {
        await cloudinary.uploader.destroy(publicId);
    }
    catch (error) {
        console.error("❌ Cloudinary delete error:", error);
    }
};
// Extract public_id from Cloudinary URL
export const getPublicIdFromUrl = (url) => {
    if (!url || url.includes("placeholder"))
        return null;
    try {
        const parts = url.split("/");
        const fileName = parts[parts.length - 1];
        const publicId = fileName.split(".")[0];
        return publicId ? `suman-food/${publicId}` : null;
    }
    catch {
        return null;
    }
};
export default cloudinary;
//# sourceMappingURL=cloudinary.js.map