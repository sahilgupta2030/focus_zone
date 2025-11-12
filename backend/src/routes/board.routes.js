import express from "express";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";
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

const router = express.Router();

// Apply verifyJWT middleware to all routes
router.use(verifyJWT);


router.post("/", createBoard);
router.get("/workspace/:workspaceId", getBoardsByWorkspace);
router.get("/:boardId", getBoardById);
router.get("/:boardId/members", getBoardMember);
router.get("/", getAllBoard);
router.put("/:boardId", updateBoard);
router.delete("/:boardId", deleteBoard);
router.post("/:boardId/add-member", addMemberToBoard);
router.post("/:boardId/remove-member", removeMemberFromBoard);

export default router;