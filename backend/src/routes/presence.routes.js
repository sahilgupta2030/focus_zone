import express from "express";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

import {
    setUserOnline,
    setUserOffline,
    updateLastActive,
    getOnlineUsersInWorkspace,
    getUserPresence,
    getPresenceForWorkspaceMembers
} from "../controllers/presence.controller.js";

const router = express.Router();

router.use(verifyJWT);

// -------------------- Presence Actions -------------------- //

// Mark user online
router.put("/:workspaceId/online", setUserOnline);

// Mark user offline
router.put("/:workspaceId/offline", setUserOffline);

// Update last active timestamp
router.put("/:workspaceId/active", updateLastActive);

// -------------------- Presence Fetching -------------------- //

// Get all online users in workspace
router.get("/:workspaceId/online-users", getOnlineUsersInWorkspace);

// Get specific user's presence in workspace
router.get("/:workspaceId/user/:userId", getUserPresence);

// Get presence for all workspace members
router.get("/:workspaceId/members", getPresenceForWorkspaceMembers);

export default router;