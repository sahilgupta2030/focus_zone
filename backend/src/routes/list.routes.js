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


router.post("/:boardId", createList);
router.get("/board/:boardId", getListsByBoard);
router.get("/:listId", getListById);
router.put("/:listId", updateList);
router.delete("/:listId", deleteList);
router.patch("/status/:listId", toggleListStatus);
router.patch("/move/:listId", moveListToAnotherBoard);
router.delete("/clear/:listId", clearCard);
router.patch("/reorder/:boardId", reOrderList);

export default router;