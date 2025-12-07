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
import { presenceUpdater } from "../middleware/presence.middleware.js";

// Validator imports
import { validate } from "../middleware/validate.middleware.js";
import {
    boardIdParam,
    listIdParam,
    createListSchema,
    updateListSchema,
    toggleListStatusSchema,
    moveListSchema,
    reorderListSchema
} from "../validators/list.validator.js";

const router = express.Router();

// All routes protected
router.use(verifyJWT);
router.use(presenceUpdater);

// =============================
// LIST ROUTES WITH VALIDATION
// =============================

// Create list
router.post(
    "/:boardId",
    validate(boardIdParam, "params"),
    validate(createListSchema),
    createList
);

// Get lists by board
router.get(
    "/board/:boardId",
    validate(boardIdParam, "params"),
    getListsByBoard
);

// Get single list
router.get(
    "/:listId",
    validate(listIdParam, "params"),
    getListById
);

// Update list
router.put(
    "/:listId",
    validate(listIdParam, "params"),
    validate(updateListSchema),
    updateList
);

// Delete list
router.delete(
    "/:listId",
    validate(listIdParam, "params"),
    deleteList
);

// Toggle list status
router.patch(
    "/status/:listId",
    validate(listIdParam, "params"),
    validate(toggleListStatusSchema),
    toggleListStatus
);

// Move list to another board
router.patch(
    "/move/:listId",
    validate(listIdParam, "params"),
    validate(moveListSchema),
    moveListToAnotherBoard
);

// Clear all cards from list
router.delete(
    "/clear/:listId",
    validate(listIdParam, "params"),
    clearCard
);

// Reorder lists inside a board
router.patch(
    "/reorder/:boardId",
    validate(boardIdParam, "params"),
    validate(reorderListSchema),
    reOrderList
);

export default router;