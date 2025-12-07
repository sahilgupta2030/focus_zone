// validators/media.validators.js
import { z } from "zod";

// Common MongoDB ObjectId validator
export const objectIdSchema = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId");


// Validate mediaId param
export const mediaIdParam = z.object({
    mediaId: objectIdSchema,
});

// Validate userId param
export const userIdParam = z.object({
    userId: objectIdSchema,
});

// Validate parent media fetch (card or message)
export const parentMediaSchema = z.object({
    parentId: objectIdSchema,
    model: z.enum(["card", "message"], "Model must be 'card' or 'message'"),
});