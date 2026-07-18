import cloudinary from "./cloudinary.js";

interface UploadResult {
  url: string;
  publicId: string;
}

const uploadImageOnCloudinary = async (
  file: Express.Multer.File,
  folder: string = "food-app",
): Promise<UploadResult> => {
  if (!file || !file.buffer) {
    throw new Error("No file buffer found — check multer storage config");
  }

  const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("File size exceeds 5MB limit");
  }

  const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    throw new Error("Only JPEG, PNG, and WEBP images are allowed");
  }

  try {
    const base64Image = file.buffer.toString("base64");
    const dataURI = `data:${file.mimetype};base64,${base64Image}`;

    const uploadResponse = await cloudinary.uploader.upload(dataURI, {
      folder,
    });

    return {
      url: uploadResponse.secure_url,
      publicId: uploadResponse.public_id,
    };
  } catch (error) {
    console.error("Cloudinary upload failed:", error);
    throw new Error("Image upload failed. Please try again.");
  }
};

export default uploadImageOnCloudinary;
