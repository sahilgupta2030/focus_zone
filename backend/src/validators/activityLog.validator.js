import { z } from "zod";

// MongoDB ObjectId validator
export const objectIdSchema = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId");

/* ------------------------- Params ------------------------- */
export const workspaceIdParam = z.object({
    workspaceId: objectIdSchema,
});

export const boardIdParam = z.object({
    boardId: objectIdSchema,
});

export const cardIdParam = z.object({
    cardId: objectIdSchema,
});

export const listIdParam = z.object({
    listId: objectIdSchema,
});

export const logIdParam = z.object({
    logId: objectIdSchema,
});