import express from "express";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";
import { validate } from "../middleware/validate.middleware.js";

import {
    setUserOnline,
    setUserOffline,
    updateLastActive,
    getOnlineUsersInWorkspace,
    getUserPresence,
    getPresenceForWorkspaceMembers
} from "../controllers/presence.controller.js";

// Import validators
import {
    workspaceIdParam,
    userIdParam
} from "../validators/presence.validator.js";

const router = express.Router();

router.use(verifyJWT);

/* -------------------- Presence Actions -------------------- */
router.put(
    "/:workspaceId/online",
    validate(workspaceIdParam, "params"),
    setUserOnline
);

router.put(
    "/:workspaceId/offline",
    validate(workspaceIdParam, "params"),
    setUserOffline
);

router.put(
    "/:workspaceId/active",
    validate(workspaceIdParam, "params"),
    updateLastActive
);

/* -------------------- Presence Fetching -------------------- */
router.get(
    "/:workspaceId/online-users",
    validate(workspaceIdParam, "params"),
    getOnlineUsersInWorkspace
);

router.get(
    "/:workspaceId/user/:userId",
    validate(workspaceIdParam, "params"),
    validate(userIdParam, "params"),
    getUserPresence
);

router.get(
    "/:workspaceId/members",
    validate(workspaceIdParam, "params"),
    getPresenceForWorkspaceMembers
);

export default router;