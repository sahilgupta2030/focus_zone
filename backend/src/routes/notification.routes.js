import express from "express";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";
import { validate } from "../middleware/validate.middleware.js";

import {
    getUserNotifications,
    getUnreadNotifications,
    markNotificationAsRead,
    markAllAsRead
} from "../controllers/notification.controller.js";

// Import validators
import {
    notificationIdParam
} from "../validators/notification.validator.js";

const router = express.Router();

// Protect all routes
router.use(verifyJWT);

/* ---------------------- Fetch Notifications ---------------------- */
router.get("/all", getUserNotifications);
router.get("/unread", getUnreadNotifications);

/* ---------------------- Mark Notifications ----------------------- */
router.patch(
    "/read/:notificationId",
    validate(notificationIdParam, "params"),
    markNotificationAsRead
);

router.patch("/read-all", markAllAsRead);

export default router;