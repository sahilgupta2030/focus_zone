import express from "express";
import multer from "multer";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

import {
    uploadMedia,
    deleteMedia,
    getMediaById,
    getMediaByParent,
    getMediaByUser
} from "../controllers/media.controller.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Apply verifyJWT middleware to all routes
router.use(verifyJWT);

/* ---------------------- Upload Media ---------------------- */
// Single file upload
router.post("/upload", upload.single("file"), uploadMedia);

/* ---------------------- Delete Media ----------------------- */
router.delete("/:mediaId", deleteMedia);

/* ---------------------- Fetch Media ------------------------ */
// Get a single media
router.get("/:mediaId", getMediaById);

// Get media attached to a Card or Message
router.get("/parent/:parentId/:model", getMediaByParent);

// Get all media uploaded by a User
router.get("/user/:userId", getMediaByUser);

export default router;