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
    if (!hasCloudinaryConfig || publicId === "placeholder" || !publicId) {
        return;
    }
    try {
        await cloudinary.uploader.destroy(publicId);
    }
    catch (error) {
        console.error("❌ Cloudinary delete error:", error);
    }
};
/**
 * Extract public_id from Cloudinary URL.
 * Cloudinary URLs look like:
 * https://res.cloudinary.com/<cloud>/image/upload/v1234567890/folder/name.jpg
 * We need to extract: folder/name (without extension and version)
 */
export const getPublicIdFromUrl = (url) => {
    if (!url || url.includes("placeholder") || url.includes("via.placeholder")) {
        return null;
    }
    try {
        // Remove query params
        const cleanUrl = url.split("?")[0];
        const urlObj = new URL(cleanUrl);
        const pathParts = urlObj.pathname.split("/");
        // Find "upload" index, everything after it (skip version if present) is the public_id
        const uploadIndex = pathParts.indexOf("upload");
        if (uploadIndex === -1 || uploadIndex + 1 >= pathParts.length) {
            return null;
        }
        // Skip version folder (starts with "v" followed by digits)
        let startIndex = uploadIndex + 1;
        if (pathParts[startIndex] && /^v\d+$/.test(pathParts[startIndex])) {
            startIndex++;
        }
        // Join remaining parts and remove file extension
        const publicIdWithExt = pathParts.slice(startIndex).join("/");
        const publicId = publicIdWithExt.replace(/\.[^/.]+$/, "");
        return publicId || null;
    }
    catch {
        return null;
    }
};
export default cloudinary;
