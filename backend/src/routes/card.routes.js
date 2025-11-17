import express from "express";
import {
    createCard,
    getCardById,
    getCardsByList,
    getCardsByBoard,
    updateCard,
    deleteCard,
    archiveCard,
    restoreCard,
    moveCardWithinList,
    moveCardToAnotherList,
    assignCard,
    unassignCard,
    updateCardStatus,
    updateCardLabels,
    addAttachment,
    removeAttachment,
    addComment,
    deleteComment,
    addChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem,
    searchCards,
} from "../controllers/card.controller.js";

import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

const router = express.Router();

// All card routes are protected
router.use(verifyJWT);

/* -------------------------------
        CARD CRUD ROUTES
--------------------------------*/

// Create card
router.post("/", createCard);

// Get card by ID
router.get("/:cardId", getCardById);

// Update card (general info)
router.put("/:cardId", updateCard);

// Delete card permanently
router.delete("/:cardId", deleteCard);

// Archive card
router.put("/:cardId/archive", archiveCard);

// Restore archived card
router.put("/:cardId/restore", restoreCard);


/* -------------------------------
        FETCHING ROUTES
--------------------------------*/

// Get all cards in a list
router.get("/list/:listId", getCardsByList);

// Get all cards in a board
router.get("/board/:boardId", getCardsByBoard);

// Search cards
router.get("/search/cards", searchCards);


/* -------------------------------
        MOVE CARD ROUTES
--------------------------------*/

// Move card inside the same list
router.put("/:cardId/move/within-list", moveCardWithinList);

// Move card to another list
router.put("/:cardId/move/to-list", moveCardToAnotherList);


/* -------------------------------
        ASSIGN / UNASSIGN USER
--------------------------------*/

router.put("/:cardId/assign", assignCard);
router.put("/:cardId/unassign", unassignCard);


/* -------------------------------
        CARD STATUS & LABELS
--------------------------------*/

router.put("/:cardId/status", updateCardStatus);
router.put("/:cardId/labels", updateCardLabels);


/* -------------------------------
        ATTACHMENTS ROUTES
--------------------------------*/

router.post("/:cardId/attachments", addAttachment);
router.delete("/:cardId/attachments/:attachmentId", removeAttachment);


/* -------------------------------
        COMMENTS ROUTES
--------------------------------*/

router.post("/:cardId/comments", addComment);
router.delete("/:cardId/comments/:commentId", deleteComment);


/* -------------------------------
        CHECKLIST ROUTES
--------------------------------*/

router.post("/:cardId/checklist", addChecklistItem);
router.put("/:cardId/checklist/:itemId/toggle", toggleChecklistItem);
router.delete("/:cardId/checklist/:itemId", deleteChecklistItem);


export default router;