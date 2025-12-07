// validators/workspace.validator.js
import { z } from "zod";

const objectId = z
    .string()
    .regex(/^[0-9a-fA-F]{24}$/, "Invalid MongoDB ObjectId");


export const createWorkspaceSchema = z.object({
    name: z.string().min(2, "Workspace name must be at least 2 characters"),
    description: z.string().max(1000).optional(),
    isPrivate: z.boolean().optional(),
});


export const updateWorkspaceSchema = z.object({
    name: z.string().min(2).optional(),
    description: z.string().max(1000).optional(),
    isPrivate: z.boolean().optional(),
});


export const workspaceIdParamSchema = z.object({
    workspaceId: objectId,
});


export const addMemberSchema = z.object({
    userId: objectId,
    role: z.enum(["member", "admin", "owner"]).optional(),
});


export const removeMemberSchema = z.object({
    userId: objectId,
});


export const updateMemberRoleSchema = z.object({
    userId: objectId,
    newRole: z.enum(["member", "admin", "owner"]),
});


export const searchWorkspaceSchema = z.object({
    q: z.string().min(1, "Search query cannot be empty"),
});