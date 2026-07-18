import { v2 as cloudinary } from "cloudinary";
export declare const uploadImage: (base64Image: string, folder?: string) => Promise<{
    secure_url: string;
    public_id: string;
}>;
export declare const deleteImage: (publicId: string) => Promise<void>;
export declare const getPublicIdFromUrl: (url: string) => string | null;
export default cloudinary;
//# sourceMappingURL=cloudinary.d.ts.map