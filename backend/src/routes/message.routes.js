import express from "express";
import { verifyJWT } from "../middleware/verifyJWT.middleware.js";

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
import multer from "multer"; // for file upload

const router = express.Router();
const upload = multer({ dest: "uploads/" });

// Apply verifyJWT middleware to all routes
router.use(verifyJWT);

/* ---------------------- Message Creation ---------------------- */
router.post("/", sendMessage);                               
router.post("/media",upload.single("file"), sendMediaMessage);                       
router.post("/medias",upload.array("files"), sendMediaMessage);                       
router.post("/reply/:messageId", replyToMessage);

/* ---------------------- Modify/Delete ------------------------- */
router.put("/:messageId", editMessage);
router.delete("/:messageId", deleteMessage);

/* ------------------------- Read / Fetch ------------------------ */
router.get("/card/:cardId", getMessagesByCard);
router.get("/workspace/:workspaceId", getMessagesByWorkspace);

/* ------------------------- Search ------------------------------ */
router.get("/workspace/:workspaceId/search", searchMessages);

/* ------------------------- Pagination -------------------------- */
router.get("/card/:cardId/paginate", getMessagesWithPagination);
router.get("/card/:cardId/recent", getRecentMessages);

/* ------------------------- Read Status ------------------------- */
router.post("/read/:messageId", markMessageAsRead);
router.post("/card/:cardId/read-all", markAllMessagesAsRead);
router.get("/card/:cardId/unread-count", getUnreadMessagesCount);

/* ------------------------- Typing Events ----------------------- */
router.post("/typing/start", typingStart);
router.post("/typing/stop", typingStop);

/* ---------------------- DYNAMIC ROUTE LAST -------------------- */
router.get("/:messageId", getMessageById);

export default router;