import express from "express";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

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

const router = express.Router();

// Apply verifyJWT middleware to all routes
router.use(verifyJWT);


router.get("/all", getActivityLogs);
router.get("/workspace/:workspaceId", getWorkspaceActivity);
router.get("/board/:boardId", getBoardActivity);
router.get("/board/:boardId/card/:cardId", getCardActivity);
router.get("/board/:boardId/list/:listId", getListActivity);
router.delete("/:logId", deleteActivityLog);
router.delete("/clear/board/:boardId", clearBoardActivity);
router.delete("/clear/workspace/:workspaceId", clearWorkspaceActivity);

export default router;