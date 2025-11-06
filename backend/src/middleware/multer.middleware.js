import multer from "multer";
import path from "path";

// Temporary storage in memory or disk (before Cloudinary upload)
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "uploads/"); // temp folder before Cloudinary
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    },
});

const fileFilter = (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
        cb(new Error("Only .jpeg, .png, .webp formats are allowed!"), false);
    } else {
        cb(null, true);
    }
};

export const upload = multer({ storage, fileFilter });