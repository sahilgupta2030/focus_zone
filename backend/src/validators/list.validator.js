// validators/list.validator.js
import { z } from "zod";


export const boardIdParam = z.object({
    boardId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid boardId"),
});

export const listIdParam = z.object({
    listId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid listId"),
});

// Create List
export const createListSchema = z.object({
    name: z.string().min(1, "List name is required"),
    position: z.number().int().nonnegative().optional(),
});

// Update List
export const updateListSchema = z.object({
    name: z.string().min(1).optional(),
    position: z.number().int().nonnegative().optional(),
});

// Toggle List Status (optional body)
export const toggleListStatusSchema = z.object({
    isActive: z.boolean(),
}).optional();

// Move List to Another Board
export const moveListSchema = z.object({
    newBoardId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid newBoardId"),
    position: z.number().int().nonnegative().optional(),
});

// Reorder list inside a board
export const reorderListSchema = z.object({
    listOrder: z.array(
        z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid listId in listOrder")
    ),
});