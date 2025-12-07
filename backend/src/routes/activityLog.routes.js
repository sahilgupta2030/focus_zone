import express from "express";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";
import { presenceUpdater } from "../middleware/presence.middleware.js";
import { validate } from "../middleware/validate.middleware.js";

import {
    getActivityLogs,
    getWorkspaceActivity,
    getBoardActivity,
    getCardActivity,
    getListActivity,
    deleteActivityLog,
    clearBoardActivity,
    clearWorkspaceActivity
} from "../controllers/activityLog.controller.js";

// Import validators
import {
    workspaceIdParam,
    boardIdParam,
    cardIdParam,
    listIdParam,
    logIdParam
} from "../validators/activityLog.validator.js";

const router = express.Router();

router.use(verifyJWT);
router.use(presenceUpdater);

/* ------------------------- Fetch Activity Logs ------------------------- */
router.get("/all", getActivityLogs);

router.get(
    "/workspace/:workspaceId",
    validate(workspaceIdParam, "params"),
    getWorkspaceActivity
);

router.get(
    "/board/:boardId",
    validate(boardIdParam, "params"),
    getBoardActivity
);

router.get(
    "/board/:boardId/card/:cardId",
    validate(boardIdParam, "params"),
    validate(cardIdParam, "params"),
    getCardActivity
);

router.get(
    "/board/:boardId/list/:listId",
    validate(boardIdParam, "params"),
    validate(listIdParam, "params"),
    getListActivity
);

/* ------------------------- Delete Activity Logs ------------------------ */
router.delete(
    "/:logId",
    validate(logIdParam, "params"),
    deleteActivityLog
);

router.delete(
    "/clear/board/:boardId",
    validate(boardIdParam, "params"),
    clearBoardActivity
);

router.delete(
    "/clear/workspace/:workspaceId",
    validate(workspaceIdParam, "params"),
    clearWorkspaceActivity
);

export default router;