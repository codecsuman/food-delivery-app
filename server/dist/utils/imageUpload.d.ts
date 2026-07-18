interface UploadResult {
    url: string;
    publicId: string;
}
declare const uploadImageOnCloudinary: (file: Express.Multer.File, folder?: string) => Promise<UploadResult>;
export default uploadImageOnCloudinary;
//# sourceMappingURL=imageUpload.d.ts.map