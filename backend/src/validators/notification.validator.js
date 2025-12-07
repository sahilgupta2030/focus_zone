// validators/notification.validators.js
import { z } from "zod";

// MongoDB ObjectId validator
export const objectIdSchema = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId");

// Validate notificationId param
export const notificationIdParam = z.object({
    notificationId: objectIdSchema,
});