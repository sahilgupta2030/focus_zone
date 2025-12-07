import express from "express";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";
import { presenceUpdater } from "../middleware/presence.middleware.js";

// controllers
import {
    createBoard,
    getBoardsByWorkspace,
    getBoardById,
    getBoardMember,
    getAllBoard,
    updateBoard,
    deleteBoard,
    addMemberToBoard,
    removeMemberFromBoard
} from "../controllers/board.controller.js";

// validators
import {
    createBoardSchema,
    updateBoardSchema,
    boardIdParam,
    workspaceIdParam,
    addBoardMemberSchema,
    removeBoardMemberSchema
} from "../validators/board.validator.js";

// middleware to validate using zod schemas
import { validate } from "../middleware/validate.middleware.js";

const router = express.Router();

// Apply verifyJWT & presence middleware to all routes
router.use(verifyJWT);
router.use(presenceUpdater);

// ROUTES WITH VALIDATION

// Create Board
router.post(
    "/",
    validate(createBoardSchema),
    createBoard
);

// Get Boards by Workspace
router.get(
    "/workspace/:workspaceId",
    validate(workspaceIdParam, "params"),
    getBoardsByWorkspace
);

// Get Board by ID
router.get(
    "/:boardId",
    validate(boardIdParam, "params"),
    getBoardById
);

// Get Board Members
router.get(
    "/:boardId/members",
    validate(boardIdParam, "params"),
    getBoardMember
);

// Get All Boards
router.get("/", getAllBoard);

// Update Board
router.put(
    "/:boardId",
    validate(boardIdParam, "params"),
    validate(updateBoardSchema),
    updateBoard
);

// Delete Board
router.delete(
    "/:boardId",
    validate(boardIdParam, "params"),
    deleteBoard
);

// Add Member to Board
router.post(
    "/:boardId/add-member",
    validate(boardIdParam, "params"),
    validate(addBoardMemberSchema),
    addMemberToBoard
);

// Remove Member from Board
router.post(
    "/:boardId/remove-member",
    validate(boardIdParam, "params"),
    validate(removeBoardMemberSchema),
    removeMemberFromBoard
);

export default router;