import express from "express";
import multer from "multer";

import { verifyJWT } from "../middleware/verifyJWT.middleware.js";
import { presenceUpdater } from "../middleware/presence.middleware.js";
import { validate } from "../middleware/validate.middleware.js";

// Import all message validators
import {
    sendMessageSchema,
    sendMediaMessageSchema,
    replyToMessageSchema,
    editMessageSchema,
    deleteMessageSchema,

    getMessagesByCardSchema,
    getMessagesByWorkspaceSchema,
    getMessageByIdSchema,

    markMessageAsReadSchema,
    markAllMessagesAsReadSchema,
    getUnreadMessagesCountSchema,

    searchMessagesSchema,
    getMessagesWithPaginationSchema,
    getRecentMessagesSchema,

    typingStartSchema,
    typingStopSchema,
} from "../validators/message.validator.js";

import {
    sendMessage,
    sendMediaMessage,
    replyToMessage,
    editMessage,
    deleteMessage,

    getMessagesByCard,
    getMessagesByWorkspace,
    getMessageById,

    markMessageAsRead,
    markAllMessagesAsRead,
    getUnreadMessagesCount,

    searchMessages,
    getMessagesWithPagination,
    getRecentMessages,

    typingStart,
    typingStop
} from "../controllers/message.controller.js";

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Protect all routes
router.use(verifyJWT);
router.use(presenceUpdater);

/* ---------------------- Message Creation ---------------------- */
router.post(
    "/",
    validate(sendMessageSchema),
    sendMessage
);

router.post(
    "/media",
    upload.single("file"),
    validate(sendMediaMessageSchema),
    sendMediaMessage
);

router.post(
    "/medias",
    upload.array("files"),
    validate(sendMediaMessageSchema),
    sendMediaMessage
);

router.post(
    "/reply/:messageId",
    validate(replyToMessageSchema),
    replyToMessage
);

/* ---------------------- Modify/Delete ------------------------- */
router.put(
    "/:messageId",
    validate(editMessageSchema),
    editMessage
);

router.delete(
    "/:messageId",
    validate(deleteMessageSchema),
    deleteMessage
);

/* ------------------------- Read / Fetch ------------------------ */
router.get(
    "/card/:cardId",
    validate(getMessagesByCardSchema),
    getMessagesByCard
);

router.get(
    "/workspace/:workspaceId",
    validate(getMessagesByWorkspaceSchema),
    getMessagesByWorkspace
);

/* ------------------------- Search ------------------------------ */
router.get(
    "/workspace/:workspaceId/search",
    validate(searchMessagesSchema),
    searchMessages
);

/* ------------------------- Pagination -------------------------- */
router.get(
    "/card/:cardId/paginate",
    validate(getMessagesWithPaginationSchema),
    getMessagesWithPagination
);

router.get(
    "/card/:cardId/recent",
    validate(getRecentMessagesSchema),
    getRecentMessages
);

/* ------------------------- Read Status ------------------------- */
router.post(
    "/read/:messageId",
    validate(markMessageAsReadSchema),
    markMessageAsRead
);

router.post(
    "/card/:cardId/read-all",
    validate(markAllMessagesAsReadSchema),
    markAllMessagesAsRead
);

router.get(
    "/card/:cardId/unread-count",
    validate(getUnreadMessagesCountSchema),
    getUnreadMessagesCount
);

/* ------------------------- Typing Events ----------------------- */
router.post(
    "/typing/start",
    validate(typingStartSchema),
    typingStart
);

router.post(
    "/typing/stop",
    validate(typingStopSchema),
    typingStop
);

/* ---------------------- DYNAMIC ROUTE LAST -------------------- */
router.get(
    "/:messageId",
    validate(getMessageByIdSchema),
    getMessageById
);

export default router;