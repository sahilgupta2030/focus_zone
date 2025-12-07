// validators/board.validator.js
import { z } from "zod";

export const createBoardSchema = z.object({
    name: z.string().min(1, "Board name required"),
    description: z.string().max(2000).optional(),
    workspaceId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid workspaceId"),
    isPrivate: z.boolean().optional(),
});

export const updateBoardSchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().max(2000).optional(),
    isPrivate: z.boolean().optional(),
});

export const boardIdParam = z.object({
    boardId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid boardId"),
});

// Missing: for GET /workspace/:workspaceId
export const workspaceIdParam = z.object({
    workspaceId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid workspaceId"),
});

// Missing: for POST /:boardId/add-member
export const addBoardMemberSchema = z.object({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid userId"),
    role: z.enum(["viewer", "member", "admin"]).optional(),
});

// Missing: for POST /:boardId/remove-member
export const removeBoardMemberSchema = z.object({
    userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid userId"),
});