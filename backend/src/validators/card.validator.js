// validators/card.validator.js
import { z } from "zod";

const objectId = /^[0-9a-fA-F]{24}$/;


export const cardIdParam = z.object({
    cardId: z.string().regex(objectId, "Invalid cardId"),
});

export const listIdParam = z.object({
    listId: z.string().regex(objectId, "Invalid listId"),
});

export const boardIdParam = z.object({
    boardId: z.string().regex(objectId, "Invalid boardId"),
});


export const createCardSchema = z.object({
    title: z.string().min(1, "Card title is required"),
    description: z.string().optional(),
    listId: z.string().regex(objectId, "Invalid listId"),
    boardId: z.string().regex(objectId, "Invalid boardId"),
    dueDate: z.string().optional(),
    labels: z.array(z.string()).optional(),
});

export const updateCardSchema = z.object({
    title: z.string().min(1).optional(),
    description: z.string().optional(),
    dueDate: z.string().optional(),
    labels: z.array(z.string()).optional(),
});


export const moveWithinListSchema = z.object({
    newPosition: z.number().min(0, "Position must be >= 0"),
});

export const moveToAnotherListSchema = z.object({
    targetListId: z.string().regex(objectId, "Invalid targetListId"),
    newPosition: z.number().min(0),
});


export const assignUserSchema = z.object({
    userId: z.string().regex(objectId, "Invalid userId"),
});


export const updateStatusSchema = z.object({
    status: z.enum(["todo", "in-progress", "completed", "blocked"]),
});

export const updateLabelsSchema = z.object({
    labels: z.array(z.string()).min(1, "At least one label required"),
});


export const addChecklistItemSchema = z.object({
    text: z.string().min(1, "Checklist item cannot be empty"),
});

export const toggleChecklistSchema = z.object({
    completed: z.boolean(),
});


export const addCommentSchema = z.object({
    text: z.string().min(1, "Comment cannot be empty"),
});