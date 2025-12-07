import express from "express";
import multer from "multer";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";
import { validate } from "../middleware/validate.middleware.js";

import {
    uploadMedia,
    getMediaById,
    getMediaByParent,
    deleteMedia,
    getMediaByUser
} from "../controllers/media.controller.js";

// Import validators
import {
    mediaIdParam,
    parentMediaSchema,
    userIdParam
} from "../validators/media.validator.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Protect all routes
router.use(verifyJWT);

/* ---------------------- Upload Media ---------------------- */
// Single file upload
router.post(
    "/upload",
    upload.single("file"),
    uploadMedia
);

/* ---------------------- Delete Media ----------------------- */
router.delete(
    "/:mediaId",
    validate(mediaIdParam, "params"),
    deleteMedia
);

/* ---------------------- Fetch Media ------------------------ */
// Get a single media
router.get(
    "/:mediaId",
    validate(mediaIdParam, "params"),
    getMediaById
);

// Get media attached to a Card or Message
router.get(
    "/parent/:parentId/:model",
    validate(parentMediaSchema, "params"),
    getMediaByParent
);

// Get all media uploaded by a User
router.get(
    "/user/:userId",
    validate(userIdParam, "params"),
    getMediaByUser
);

export default router;