import express from "express";
import {
    createList,
    getListsByBoard,
    getListById,
    updateList,
    deleteList,
    moveList,
    addTaskToList,
    removeTaskFromList,
    reorderTasksInsideList
} from "../controllers/list.controller.js";

import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

const router = express.Router();

// all routes are protected
router.use(verifyJWT);

// Create a new list
router.post("/", createList);

// Get all lists of a board
router.get("/board/:boardId", getListsByBoard);

// Get a single list by ID
router.get("/:listId", getListById);

// Update a list
router.put("/:listId", updateList);

// Delete a list
router.delete("/:listId", deleteList);

// Move a list (change position or board)
router.put("/:listId/move", moveList);

// Add a task/card to a list
router.post("/:listId/tasks", addTaskToList);

// Remove a task/card from a list
router.delete("/:listId/tasks/:taskId", removeTaskFromList);

// Reorder tasks inside the same list
router.put("/:listId/tasks/reorder", reorderTasksInsideList);

export default router;
