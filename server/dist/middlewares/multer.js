import multer from "multer";
const storage = multer.memoryStorage();
const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/jpg"];
const upload = multer({
    storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
    },
    fileFilter: (_req, file, cb) => {
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Invalid file type: ${file.mimetype}. Only JPEG, PNG, and WEBP images are allowed`));
        }
    },
});
// Error handler for multer
export const handleMulterError = (err, _req, res, next) => {
    if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({
                success: false,
                message: "File too large. Maximum size is 5MB",
            });
        }
        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }
    if (err) {
        return res.status(400).json({
            success: false,
            message: err.message,
        });
    }
    next();
};
export default upload;
