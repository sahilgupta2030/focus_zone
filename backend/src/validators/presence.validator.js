// validators/presence.validators.js
import { z } from "zod";

// MongoDB ObjectId validator
export const objectIdSchema = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId");

// Validate workspaceId param
export const workspaceIdParam = z.object({
    workspaceId: objectIdSchema,
});

// Validate userId param
export const userIdParam = z.object({
    userId: objectIdSchema,
});