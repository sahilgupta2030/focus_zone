import dotenv from "dotenv";
dotenv.config();
import { v2 as cloudinary } from "cloudinary";
import fs from "fs";
import path from "path";
import { ApiError } from "./apiError.js";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadOnCloudinary = async (localFilePath) => {
    try {
        if (!localFilePath) throw new ApiError(400, "No file path provided for Cloudinary upload");

        // ✅ Ensure absolute path
        const fullPath = path.resolve(localFilePath);
        console.log("Uploading to Cloudinary from:", fullPath);

        const response = await cloudinary.uploader.upload(fullPath, {
            resource_type: "auto",
        });

        // ✅ Delete temp file after successful upload
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

        return response;
    } catch (error) {
        // ✅ Delete file if upload fails
        if (fs.existsSync(localFilePath)) fs.unlinkSync(localFilePath);
        throw new ApiError(500, "Cloudinary upload failed", [error.message]);
    }
};