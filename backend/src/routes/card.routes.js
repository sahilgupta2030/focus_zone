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
import { presenceUpdater } from "../middleware/presence.middleware.js";

// Validator imports
import { validate } from "../middleware/validate.middleware.js";
import {
        cardIdParam,
        listIdParam,
        boardIdParam,
        createCardSchema,
        updateCardSchema,
        moveWithinListSchema,
        moveToAnotherListSchema,
        assignUserSchema,
        updateStatusSchema,
        updateLabelsSchema,
        addChecklistItemSchema,
        toggleChecklistSchema,
        addCommentSchema,
} from "../validators/card.validator.js";

const router = express.Router();

// All card routes are protected
router.use(verifyJWT);
router.use(presenceUpdater);

/* -------------------------------
        CARD CRUD ROUTES
--------------------------------*/

// Create card
router.post(
        "/",
        validate(createCardSchema),
        createCard
);

// Get card by ID
router.get(
        "/:cardId",
        validate(cardIdParam, "params"),
        getCardById
);

// Update card (general info)
router.put(
        "/:cardId",
        validate(cardIdParam, "params"),
        validate(updateCardSchema),
        updateCard
);

// Delete card permanently
router.delete(
        "/:cardId",
        validate(cardIdParam, "params"),
        deleteCard
);

// Archive card
router.put(
        "/:cardId/archive",
        validate(cardIdParam, "params"),
        archiveCard
);

// Restore archived card
router.put(
        "/:cardId/restore",
        validate(cardIdParam, "params"),
        restoreCard
);


/* -------------------------------
        FETCHING ROUTES
--------------------------------*/

// Get all cards in a list
router.get(
        "/list/:listId",
        validate(listIdParam, "params"),
        getCardsByList
);

// Get all cards in a board
router.get(
        "/board/:boardId",
        validate(boardIdParam, "params"),
        getCardsByBoard
);

// Search cards
router.get("/search/cards", searchCards);


/* -------------------------------
        MOVE CARD ROUTES
--------------------------------*/

// Move card inside the same list
router.put(
        "/:cardId/move/within-list",
        validate(cardIdParam, "params"),
        validate(moveWithinListSchema),
        moveCardWithinList
);

// Move card to another list
router.put(
        "/:cardId/move/to-list",
        validate(cardIdParam, "params"),
        validate(moveToAnotherListSchema),
        moveCardToAnotherList
);


/* -------------------------------
        ASSIGN / UNASSIGN USER
--------------------------------*/

router.put(
        "/:cardId/assign",
        validate(cardIdParam, "params"),
        validate(assignUserSchema),
        assignCard
);

router.put(
        "/:cardId/unassign",
        validate(cardIdParam, "params"),
        validate(assignUserSchema),
        unassignCard
);


/* -------------------------------
        CARD STATUS & LABELS
--------------------------------*/

router.put(
        "/:cardId/status",
        validate(cardIdParam, "params"),
        validate(updateStatusSchema),
        updateCardStatus
);

router.put(
        "/:cardId/labels",
        validate(cardIdParam, "params"),
        validate(updateLabelsSchema),
        updateCardLabels
);


/* -------------------------------
        ATTACHMENTS ROUTES
--------------------------------*/

router.post(
        "/:cardId/attachments",
        validate(cardIdParam, "params"),
        addAttachment
);

router.delete(
        "/:cardId/attachments/:attachmentId",
        validate(cardIdParam, "params"),
        removeAttachment
);


/* -------------------------------
        COMMENTS ROUTES
--------------------------------*/

router.post(
        "/:cardId/comments",
        validate(cardIdParam, "params"),
        validate(addCommentSchema),
        addComment
);

router.delete(
        "/:cardId/comments/:commentId",
        validate(cardIdParam, "params"),
        deleteComment
);


/* -------------------------------
        CHECKLIST ROUTES
--------------------------------*/

router.post(
        "/:cardId/checklist",
        validate(cardIdParam, "params"),
        validate(addChecklistItemSchema),
        addChecklistItem
);

router.put(
        "/:cardId/checklist/:itemId/toggle",
        validate(cardIdParam, "params"),
        validate(toggleChecklistSchema),
        toggleChecklistItem
);

router.delete(
        "/:cardId/checklist/:itemId",
        validate(cardIdParam, "params"),
        deleteChecklistItem
);

export default router;