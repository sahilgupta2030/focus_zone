import express from "express";
import {
    registerUser,
    loginUser,
    logoutUser,
    getUserProfile,
    updateUserProfile,
    getAllUsers,
    getUserById,
    deleteUser,
    changePassword,
    uploadAvatar
} from "../controllers/user.controller.js";

import { verifyJWT } from "../middleware/verifyJWT.middleware.js";
import { validate } from "../middleware/validate.middleware.js";

// Validators
import {
    registerSchema,
    loginSchema,
    updateProfileSchema,
    changePasswordSchema,
    idParam
} from "../validators/user.validator.js";

import multer from "multer";

// File Upload
const upload = multer({ dest: "uploads/" });

const router = express.Router();

/* ---------------------- PUBLIC ROUTES ---------------------- */

// Register
router.post(
    "/register",
    upload.single("avatar"),
    validate(registerSchema),
    registerUser
);

// Login
router.post(
    "/login",
    validate(loginSchema),
    loginUser
);

/* --------------------- PROTECTED ROUTES --------------------- */

// Logout
router.post("/logout", verifyJWT, logoutUser);

// Get logged-in user's profile
router.get("/me", verifyJWT, getUserProfile);

// Update profile
router.put(
    "/update",
    verifyJWT,
    upload.single("avatar"),
    validate(updateProfileSchema),
    updateUserProfile
);

// Change password
router.put(
    "/change-password",
    verifyJWT,
    validate(changePasswordSchema),
    changePassword
);

// Upload avatar only
router.post(
    "/upload-avatar",
    verifyJWT,
    upload.single("avatar"),
    uploadAvatar
);

/* -------------------- ADMIN / MEMBER ROUTES -------------------- */

// Get all users
router.get("/all", verifyJWT, getAllUsers);

// Get user by ID
router.get(
    "/:id",
    verifyJWT,
    validate(idParam, "params"),
    getUserById
);

// Delete user by ID
router.delete(
    "/:id",
    verifyJWT,
    validate(idParam, "params"),
    deleteUser
);

export default router;