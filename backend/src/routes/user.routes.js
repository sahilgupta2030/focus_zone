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
import multer from "multer"; // for file upload

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Public routes
router.post("/register", upload.single("avatar"), registerUser);
router.post("/login", loginUser);

// Protected routes
router.post("/logout", verifyJWT, logoutUser);
router.get("/me", verifyJWT, getUserProfile);
router.put("/update", verifyJWT, upload.single("avatar"), updateUserProfile);
router.get("/all", verifyJWT, getAllUsers);
router.get("/:id", verifyJWT, getUserById);
router.delete("/:id", verifyJWT, deleteUser);
router.put("/change-password", verifyJWT, changePassword);
router.post("/upload-avatar", verifyJWT, upload.single("avatar"), uploadAvatar);

export default router;