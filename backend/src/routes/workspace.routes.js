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
import { presenceUpdater } from "../middleware/presence.middleware.js";

import { validate } from "../middleware/validate.middleware.js";

// Validators
import {
    workspaceIdParamSchema,
    createWorkspaceSchema,
    updateWorkspaceSchema,
    addMemberSchema,
    removeMemberSchema,
    updateMemberRoleSchema,
    searchWorkspaceSchema
} from "../validators/workspace.validator.js";

const router = express.Router();

/* -------------------------------------------------------
   ALL WORKSPACE ROUTES ARE PROTECTED
------------------------------------------------------- */
router.use(verifyJWT);
router.use(presenceUpdater);

/* -------------------------------------------------------
   PUBLIC-LIKE ACTIONS (User-based queries)
------------------------------------------------------- */

// Search workspaces
router.get(
    "/search/workspaces",
    validate(searchWorkspaceSchema, "query"),
    searchWorkspace
);

// Get workspaces of logged-in user
router.get("/user/me", getUserWorkspace);

/* -------------------------------------------------------
   WORKSPACE CRUD
------------------------------------------------------- */

// Create workspace
router.post("/", validate(createWorkspaceSchema), createWorkspace);

// Get all workspaces
router.get("/getAllWorkspace", getAllWorkspace);

// Restore soft-deleted workspace
router.put(
    "/:workspaceId/restore",
    validate(workspaceIdParamSchema, "params"),
    restoreWorkspace
);

/* -------------------------------------------------------
   WORKSPACE BY ID
------------------------------------------------------- */

router.get(
    "/:workspaceId",
    validate(workspaceIdParamSchema, "params"),
    getWorkspaceById
);

router.put(
    "/:workspaceId",
    validate(workspaceIdParamSchema, "params"),
    validate(updateWorkspaceSchema),
    updateWorkspace
);

router.delete(
    "/:workspaceId",
    validate(workspaceIdParamSchema, "params"),
    deleteWorkspace
);

/* -------------------------------------------------------
   MEMBERS MANAGEMENT
------------------------------------------------------- */

router.post(
    "/:workspaceId/members",
    validate(workspaceIdParamSchema, "params"),
    validate(addMemberSchema),
    addMemberToWorkspace
);

router.delete(
    "/:workspaceId/members",
    validate(workspaceIdParamSchema, "params"),
    validate(removeMemberSchema),
    removeMemberFromWorkspace
);

router.get(
    "/:workspaceId/members",
    validate(workspaceIdParamSchema, "params"),
    getWorkspaceMember
);

router.put(
    "/:workspaceId/members/role",
    validate(workspaceIdParamSchema, "params"),
    validate(updateMemberRoleSchema),
    updateMemberRole
);

/* -------------------------------------------------------
   PERMISSIONS & ACCESS
------------------------------------------------------- */

router.get(
    "/:workspaceId/access",
    validate(workspaceIdParamSchema, "params"),
    checkWorkspaceAccess
);

/* -------------------------------------------------------
   WORKSPACE STATS
------------------------------------------------------- */

router.get(
    "/:workspaceId/stats",
    validate(workspaceIdParamSchema, "params"),
    getWorkspaceStats
);

/* -------------------------------------------------------
   LEAVE WORKSPACE
------------------------------------------------------- */

router.post(
    "/:workspaceId/leave",
    validate(workspaceIdParamSchema, "params"),
    leaveWorkspace
);

export default router;