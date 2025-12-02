import express from "express";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";
import {
    getUserNotifications,
    getUnreadNotifications,
    markNotificationAsRead,
    markAllAsRead
} from "../controllers/notification.controller.js";

const router = express.Router();

// Apply verifyJWT middleware to all notification routes
router.use(verifyJWT);

// Fetch notifications
router.get("/all", getUserNotifications);
router.get("/unread", getUnreadNotifications);

// Mark notifications as read
router.patch("/read/:notificationId", markNotificationAsRead);
router.patch("/read-all", markAllAsRead);

export default router;