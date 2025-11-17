import express from "express";
import {
    createList,
    getListsByBoard,
    getListById,
    updateList,
    deleteList,
    toggleListStatus,
    moveListToAnotherBoard,
    clearCard,
    reOrderList
} from "../controllers/list.controller.js";

import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

const router = express.Router();

// all routes are protected
router.use(verifyJWT);

// Create a new list inside a board
router.post("/:boardId", createList);

// Get all lists for a board
router.get("/board/:boardId", getListsByBoard);

// Get a single list by ID
router.get("/:listId", getListById);

// Update a list (title or position)
router.put("/:listId", updateList);

// Delete a list (Admin/Owner only)
router.delete("/:listId", deleteList);

// Archive / Unarchive / Activate / Deactivate list
router.patch("/status/:listId", toggleListStatus);

// Move list to another board (Admin/Owner only)
router.patch("/move/:listId", moveListToAnotherBoard);

// Clear list (delete all cards inside)
router.delete("/clear/:listId", clearCard);

// Reorder lists in a board (drag & drop)
router.patch("/reorder/:boardId", reOrderList);

export default router;