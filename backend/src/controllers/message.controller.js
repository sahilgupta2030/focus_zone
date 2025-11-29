import mongoose from "mongoose";
import { Message } from "../models/message.model.js";
import { Card } from "../models/card.model.js";
import { Media } from "../models/media.model.js";
import { Workspace } from "../models/workspace.model.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/*
Helper functions (exact positions in file):
    - validateObjectIds
    - getUserWorkspaceRole
    - isWorkspaceAdminOrOwner
    - findCardAndWorkspace
    - isCardMember
    - findMessageById
    - checkMessageEditPermission
    - validateMessageBelongsToCard
*/

const validateObjectIds = (ids = {}) => {
    for (const [key, value] of Object.entries(ids)) {
        if (!value || !mongoose.Types.ObjectId.isValid(String(value))) {
            throw new ApiError(400, `${key} is invalid`);
        }
    }
};

const getUserWorkspaceRole = (workspace, userId) => {
    if (!workspace || !userId) return null;
    if (String(workspace.owner) === String(userId)) return "owner";
    if (!Array.isArray(workspace.members)) return null;
    const member = workspace.members.find((m) => String(m.user) === String(userId));
    return member ? member.role : null;
};

const isWorkspaceAdminOrOwner = (workspace, userId) => {
    const role = getUserWorkspaceRole(workspace, userId);
    return role === "owner" || role === "admin";
};

const findCardAndWorkspace = async (cardId) => {
    validateObjectIds({ cardId });

    const card = await Card.findById(cardId)
        .populate("createdBy", "name avatar")
        .populate("board", "workspace")
        .lean();

    if (!card) {
        throw new ApiError(404, "Card not found");
    }

    // Workspace MUST come from the board
    const workspaceId = card.board?.workspace;

    if (!workspaceId) {
        throw new ApiError(400, "Card is not linked to any workspace through board");
    }

    const workspace = await Workspace.findById(workspaceId).lean();

    if (!workspace || workspace.isDeleted) {
        throw new ApiError(404, "Workspace not found or deleted");
    }

    return { card, workspace };
};

const isCardMember = (card, workspace, userId) => {
    if (String(card.createdBy) === String(userId)) return true;

    if (Array.isArray(card.assignedTo) && card.assignedTo.some((u) => String(u) === String(userId)))
        return true;

    if (isWorkspaceAdminOrOwner(workspace, userId)) return true;

    // not a member
    throw new ApiError(403, "You don't have permission to access this card");
};

const findMessageById = async (messageId) => {
    validateObjectIds({ messageId });

    const msg = await Message.findById(messageId).populate("sender", "name avatar").lean();
    if (!msg) throw new ApiError(404, "Message not found");
    return msg;
};

const checkMessageEditPermission = (message, workspace, userId) => {
    if (String(message.sender) === String(userId)) return true;
    if (isWorkspaceAdminOrOwner(workspace, userId)) return true;
    throw new ApiError(403, "You cannot modify this message");
};

const validateMessageBelongsToCard = (message, cardId) => {
    if (String(message.channel) !== String(cardId)) {
        throw new ApiError(400, "Message does not belong to this card");
    }
};

/**
 * Create a new message inside a Card (Trello-style discussion)
 */
const sendMessage = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { card: cardId, workspace: workspaceId, text, parentMessage, attachments } = req.body;

    // validate required ids
    validateObjectIds({ cardId, workspaceId });

    // find card and workspace + permissions
    const { card, workspace } = await findCardAndWorkspace(cardId);
    if (String(workspace._id) !== String(workspaceId)) {
        throw new ApiError(400, "Card does not belong to the provided workspace");
    }

    // check user has access to card
    isCardMember(card, workspace, userId);

    // if parentMessage provided, make sure it exists and belongs to same card
    if (parentMessage) {
        const parent = await findMessageById(parentMessage);
        validateMessageBelongsToCard(parent, cardId);
    }

    const messageDoc = await Message.create({
        sender: userId,
        workspace: workspaceId,
        channel: cardId,
        text: text || "",
        attachments: Array.isArray(attachments) ? attachments : [],
        parentMessage: parentMessage || null,
        edited: false,
    });

    const populated = await Message.findById(messageDoc._id).populate("sender", "name avatar").lean();

    return res
        .status(201)
        .json(new ApiResponse(201, populated, "Message sent"));
});

/**
 * Create a media message (with attachments)
 */
const sendMediaMessage = asyncHandler(async (req, res) => {
    const { cardId } = req.params;
    const userId = req.user._id;

    if (!req.files || req.files.length === 0) {
        throw new ApiError(400, "No files uploaded");
    }

    const attachments = [];

    for (const file of req.files) {
        const result = await uploadOnCloudinary(file.path);

        const mediaDoc = await Media.create({
            url: result.secure_url,
            publicId: result.public_id,
            type: file.mimetype.startsWith("image") ? "image" :
                file.mimetype.startsWith("video") ? "video" : "file",
            filename: file.originalname,
            size: file.size,
            uploadedBy: userId,
            attachedTo: cardId,
            attachedModel: "Message"
        });

        attachments.push(mediaDoc._id);
    }

    const message = await Message.create({
        cardId,
        sender: userId,
        type: "media",
        attachments
    });

    return res.status(201).json(
        new ApiResponse(201, message, "Media message sent")
    );
});

/**
 * Reply to an existing message (threading)
 */
const replyToMessage = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const { text } = req.body;
    const userId = req.user?._id;

    // Validate parent message
    const parentMessage = await findMessageById(messageId);
    if (!parentMessage) {
        throw new ApiError(404, "Parent message not found");
    }

    // Fetch card + workspace
    const { card, workspace } = await findCardAndWorkspace(parentMessage.channel);

    // Permission check — is user allowed in this card?
    isCardMember(card, workspace, userId);

    // Validate reply content
    if (!text || !text.trim()) {
        throw new ApiError(400, "Reply message text is required");
    }

    // Create reply message
    let replyMsg = await Message.create({
        sender: userId,
        workspace: workspace._id,
        channel: card._id,
        text,
        parentMessage: parentMessage._id,
    });

    // Populate sender info for frontend rendering
    replyMsg = await replyMsg.populate("sender", "name avatar");

    return res
        .status(201)
        .json(new ApiResponse(201, replyMsg, "Reply message created successfully"));
});

/**
 * Edit an existing message (text only)
 */
const editMessage = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { messageId } = req.params;
    const { text } = req.body;

    validateObjectIds({ messageId });
    const message = await findMessageById(messageId);

    // fetch workspace of the message to check admin permissions
    const workspace = await Workspace.findById(message.workspace).lean();
    if (!workspace) throw new ApiError(404, "Workspace not found");

    // check permission
    checkMessageEditPermission(message, workspace, userId);

    // only allow editing text (attachments not editable here)
    await Message.findByIdAndUpdate(messageId, { text, edited: true }, { new: true });

    const updated = await Message.findById(messageId).populate("sender", "name avatar").lean();
    return res
        .status(200)
        .json(new ApiResponse(200, updated, "Message edited"));
});

/**
 *  Delete message
 */
const deleteMessage = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { messageId } = req.params;

    validateObjectIds({ messageId });
    const message = await findMessageById(messageId);

    const workspace = await Workspace.findById(message.workspace).lean();
    if (!workspace) throw new ApiError(404, "Workspace not found");

    checkMessageEditPermission(message, workspace, userId);

    // DELETE MEDIA FROM CLOUDINARY (if any)
    const medias = await Media.find({
        attachedTo: messageId,
        attachedModel: "Message"
    });

    for (const m of medias) {
        await deleteFromCloudinary(m.publicId);
        await m.deleteOne();
    }

    await Message.findByIdAndDelete(messageId);

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Message deleted permanently"));
});

/**
 * Get all messages inside a specific Card
 */
const getMessagesByCard = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { cardId } = req.params;

    validateObjectIds({ cardId });

    const { card, workspace } = await findCardAndWorkspace(cardId);
    isCardMember(card, workspace, userId);

    const filter = { channel: cardId };

    const messages = await Message.find(filter)
        .populate("sender", "name avatar")
        .sort({ createdAt: 1 })
        .lean();

    return res
        .status(200)
        .json(new ApiResponse(200, messages, "Messages fetched"));
});

/**
 * Get all messages in a Workspace (for global search/history)
 */
const getMessagesByWorkspace = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { workspaceId } = req.params;
    const limit = Math.min(parseInt(req.query.limit || "100", 10), 1000);

    validateObjectIds({ workspaceId });

    const workspace = await Workspace.findById(workspaceId).lean();
    if (!workspace || workspace.isDeleted) throw new ApiError(404, "Workspace not found");

    // only workspace members / admins can fetch
    getUserWorkspaceRole(workspace, userId); // returns role or null
    if (!isWorkspaceAdminOrOwner(workspace, userId) && !workspace.members.some((m) => String(m.user) === String(userId))) {
        throw new ApiError(403, "You don't have permission to access this workspace messages");
    }

    const messages = await Message.find({ workspace: workspaceId })
        .limit(limit)
        .populate("sender", "name avatar")
        .sort({ createdAt: -1 })
        .lean();

    return res
        .status(200)
        .json(new ApiResponse(200, messages, "Workspace messages fetched"));
});

/**
 * Get a single message by ID
 */
const getMessageById = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { messageId } = req.params;

    validateObjectIds({ messageId });
    const message = await findMessageById(messageId);

    // check membership on the card
    const { card, workspace } = await findCardAndWorkspace(message.channel);
    isCardMember(card, workspace, userId);

    return res
        .status(200)
        .json(new ApiResponse(200, message, "Message fetched"));
});

/**
 * Mark a single message as read
 */
const markMessageAsRead = asyncHandler(async (req, res) => {
    const { messageId } = req.params;
    const userId = req.user?._id;

    const message = await Message.findById(messageId);
    if (!message) throw new ApiError(404, "Message not found");

    // If already marked, skip
    if (!message.readBy.includes(userId)) {
        message.readBy.push(userId);
        await message.save();
    }

    return res
        .status(200)
        .json(new ApiResponse(200, "Message marked as read"));
});


/**
 * Mark all messages in a Card as read
 */
const markAllMessagesAsRead = asyncHandler(async (req, res) => {
    const { cardId } = req.params;
    const userId = req.user?._id;

    await Message.updateMany(
        { channel: cardId, readBy: { $ne: userId } },
        { $push: { readBy: userId } }
    );

    return res
        .status(200)
        .json(new ApiResponse(200, "All messages marked as read"));
});


/**
 * Get unread message count (per card)
 */
const getUnreadMessagesCount = asyncHandler(async (req, res) => {
    const { cardId } = req.params;
    const userId = req.user?._id;

    const unreadCount = await Message.countDocuments({
        channel: cardId,
        readBy: { $ne: userId }
    });

    return res
        .status(200)
        .json(new ApiResponse(200, { unreadCount }));
});


/**
 * Search messages in a workspace
 */
const searchMessages = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { workspaceId } = req.params;
    const q = (req.query.q || "").trim();

    if (!q) throw new ApiError(400, "Query 'q' is required");

    validateObjectIds({ workspaceId });

    const workspace = await Workspace.findById(workspaceId).lean();
    if (!workspace || workspace.isDeleted) throw new ApiError(404, "Workspace not found");

    // permission check: member or admin
    if (!isWorkspaceAdminOrOwner(workspace, userId) && !workspace.members.some((m) => String(m.user) === String(userId))) {
        throw new ApiError(403, "You don't have permission to search this workspace");
    }

    // basic text search (case-insensitive)
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    const messages = await Message.find({ workspace: workspaceId, text: regex })
        .limit(200)
        .populate("sender", "name avatar")
        .sort({ createdAt: -1 })
        .lean();

    return res
        .status(200)
        .json(new ApiResponse(200, messages, `Search results for "${q}"`));
});

/**
 * Paginated messages inside a Card (infinite scroll)
 */
const getMessagesWithPagination = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { cardId } = req.params;
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(parseInt(req.query.limit || "50", 10), 200);

    validateObjectIds({ cardId });

    const { card, workspace } = await findCardAndWorkspace(cardId);
    isCardMember(card, workspace, userId);

    // return newest first for infinite scroll (client can reverse for display)
    const skip = (page - 1) * limit;
    const messages = await Message.find({ channel: cardId })
        .populate("sender", "name avatar")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean();

    return res
        .status(200)
        .json(new ApiResponse(200, { page, limit, messages }, "Paginated messages fetched"));
});

/**
 * Get 20 most recent messages inside a Card
 */
const getRecentMessages = asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { cardId } = req.params;
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 100);

    validateObjectIds({ cardId });

    const { card, workspace } = await findCardAndWorkspace(cardId);
    isCardMember(card, workspace, userId);

    const messages = await Message.find({ channel: cardId })
        .populate("sender", "name avatar")
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();

    return res
        .status(200)
        .json(new ApiResponse(200, messages, "Recent messages fetched"));
});

/**
 * WebSocket: User started typing
 */
const typingStart = asyncHandler(async (req, res) => {
    // Optionally: trigger activity or socket event here
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Typing started (use sockets for realtime)"));
});

/**
 * WebSocket: User stopped typing
 */
const typingStop = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Typing stopped (use sockets for realtime)"));
});

export {
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
    typingStop,
};