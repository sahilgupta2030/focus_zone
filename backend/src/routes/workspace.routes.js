import express from "express";
import {
    createWorkspace,
    getAllWorkspace,
    getWorkspaceById,
    updateWorkspace,
    deleteWorkspace,
    addMemberToWorkspace,
    removeMemberFromWorkspace,
    getWorkspaceMember,
    updateMemberRole,
    checkWorkspaceAccess,
    getUserWorkspace,
    restoreWorkspace,
    searchWorkspace,
    getWorkspaceStats,
    leaveWorkspace
} from "../controllers/workspace.controller.js";

import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

const router = express.Router();

// all routes are protected
router.use(verifyJWT);

router.post("/", createWorkspace);
router.get("/getAllWorkspace", getAllWorkspace);
router.get("/:workspaceId", getWorkspaceById);
router.put("/:workspaceId", updateWorkspace);
router.delete("/:workspaceId", deleteWorkspace);
router.post("/:workspaceId/members", addMemberToWorkspace);
router.delete("/:workspaceId/members", removeMemberFromWorkspace);
router.get("/:workspaceId/members", getWorkspaceMember);
router.put("/:workspaceId/members/role", updateMemberRole);
router.get("/:workspaceId/access", checkWorkspaceAccess);
router.get("/user/me", getUserWorkspace);
router.put("/:workspaceId/restore", restoreWorkspace);
router.get("/search/workspaces", searchWorkspace);
router.get("/:workspaceId/stats", getWorkspaceStats);
router.post("/:workspaceId/leave", leaveWorkspace);

export default router;