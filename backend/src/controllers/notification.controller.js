import mongoose from "mongoose";
import { Notification } from "../models/notification.model.js";
import { User } from "../models/user.model.js";
import { Board } from "../models/board.model.js";
import { Card } from "../models/card.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";


// ===============================
//  HELPER FUNCTIONS 
// ===============================
const validateObjectIds = (ids = {}) => {
    if (!ids || Object.keys(ids).length === 0) return;
    for (const [key, value] of Object.entries(ids)) {
        if (!value || !mongoose.Types.ObjectId.isValid(String(value))) {
            throw new ApiError(400, `${key} is invalid`);
        }
    }
};

const findCardById = async (cardId) => {
    validateObjectIds({ cardId });
    const card = await Card.findById(cardId)
        .populate("createdBy", "name _id avatar")
        .populate("assignedTo", "name _id avatar");
    if (!card) throw new ApiError(404, "Card not found");
    return card;
};

// Ensure user exists
const verifyUserExists = async (userId) => {
    validateObjectIds({ userId });
    const user = await User.findById(userId);
    if (!user) throw new ApiError(404, "User not found");
    return user;
};

// Ensure board exists
const verifyBoardExists = async (boardId) => {
    validateObjectIds({ boardId });
    const board = await Board.findById(boardId);
    if (!board) throw new ApiError(404, "Board not found");
    return board;
};

// Ensure card exists (wrapper using findCardById)
const verifyCardExists = async (cardId) => {
    return await findCardById(cardId);
};

// Create + Save notification (accepts full context)
const createNotification = async ({
    userId,
    createdBy,
    message,
    type = "system",
    workspace = null,
    board = null,
    card = null,
    redirectUrl = null
}) => {
    validateObjectIds({ userId });
    if (createdBy) validateObjectIds({ createdBy });
    const payload = {
        user: userId,
        createdBy,
        message,
        type,
        workspace,
        board,
        card,
        redirectUrl,
    };
    const notification = await Notification.create(payload);
    return notification;
};

// ===============================
//  EXERNAL FUNCTIONS
// ===============================

// GET all notifications for logged-in user
const getUserNotifications = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    validateObjectIds({ userId });
    await verifyUserExists(userId);

    const notifications = await Notification.find({ user: userId })
        .sort({ createdAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, notifications, "Notifications fetched successfully"));
});


// GET only unread notifications
const getUnreadNotifications = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    validateObjectIds({ userId });
    await verifyUserExists(userId);

    const unreadNotifications = await Notification.find({
        user: userId,
        read: false
    }).sort({ createdAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, unreadNotifications, "Unread notifications fetched successfully"));
});


// Mark single notification as read
const markNotificationAsRead = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { notificationId } = req.params;

    validateObjectIds({ userId, notificationId });
    await verifyUserExists(userId);

    const notification = await Notification.findOne({
        _id: notificationId,
        user: userId
    });

    if (!notification) {
        throw new ApiError(404, "Notification not found");
    }

    if (notification.read === true) {
        return res
            .status(200)
            .json(new ApiResponse(200, notification, "Already marked as read"));
    }

    notification.read = true;
    await notification.save();

    return res
        .status(200)
        .json(new ApiResponse(200, notification, "Notification marked as read"));
});


// Mark all notifications as read for logged-in user
const markAllAsRead = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    validateObjectIds({ userId });
    await verifyUserExists(userId);

    await Notification.updateMany(
        { user: userId, read: false },
        { $set: { read: true } }
    );

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "All notifications marked as read"));
});


// ===============================
//  INTERNAL FUNCTIONS (called inside other controllers)
// ===============================

// Send notification to one user (safe wrapper around createNotification)
const sendNotification = async (
    userId,
    {
        createdBy = null,
        message,
        type = "system",
        workspace = null,
        board = null,
        card = null,
        redirectUrl = null
    } = {}) => {

    try {
        // Validate userId (essential)
        if (!userId || !mongoose.Types.ObjectId.isValid(String(userId))) {
            return null;
        }

        return await createNotification({
            userId,
            createdBy,
            message,
            type,
            workspace,
            board,
            card,
            redirectUrl,
        });
    } catch (error) {
        console.error("Notification error:", error);
        return null;
    }
};

// Notify a single user reliably
const notifyUser = async (userId, payload = {}) => {
    try {
        if (!userId) return null;
        await verifyUserExists(userId);
        return await sendNotification(userId, payload);
    } catch (error) {
        console.error("Notification error:", error);
        return null;
    }
};

// Send notification to many users (accepts optional context)
const notifyMultipleUsers = async (
    userIds = [],
    {
        createdBy = null,
        message,
        type = "system",
        workspace = null,
        board = null,
        card = null,
        redirectUrl = null
    } = {}) => {
    if (!Array.isArray(userIds) || userIds.length === 0) return [];
    const notifications = userIds.map((userId) => ({
        user: userId,
        createdBy,
        message,
        type,
        workspace,
        board,
        card,
        redirectUrl,
    }));

    return await Notification.insertMany(notifications);
};

// Notify all members of a board
const notifyBoardMembers = async (boardId, payload = {}) => {
    try {
        validateObjectIds({ boardId });
        const board = await verifyBoardExists(boardId);

        const members = Array.isArray(board.members) ? board.members : [];

        // Remove creator from notifications
        const creator = payload.createdBy ? String(payload.createdBy) : null;
        const finalMembers = creator
            ? members.filter(m => String(m) !== creator)
            : members;

        if (finalMembers.length === 0) return [];

        return await notifyMultipleUsers(
            finalMembers,
            {
                createdBy: payload.createdBy,
                message: payload.message,
                type: payload.type || "system",
                workspace: payload.workspace,
                board: boardId,
                card: payload.card,
                redirectUrl: payload.redirectUrl
            }
        );
    } catch (error) {
        console.error("Notification error:", error);
        return [];
    }
};

// Notify all assigned users of a card
const notifyCardMembers = async (cardId, payload = {}) => {
    try {
        validateObjectIds({ cardId });
        const card = await verifyCardExists(cardId);

        const members = Array.isArray(card.assignedTo) ? card.assignedTo : [];

        // Remove creator from notifications
        const creator = payload.createdBy ? String(payload.createdBy) : null;
        const finalMembers = creator
            ? members.filter(m => String(m) !== creator)
            : members;

        if (finalMembers.length === 0) return [];

        return await notifyMultipleUsers(
            finalMembers,
            {
                createdBy: payload.createdBy,
                message: payload.message,
                type: payload.type || "task",
                workspace: payload.workspace,
                board: payload.board || card.board,
                card: cardId,
                redirectUrl: payload.redirectUrl
            }
        );
    } catch (error) {
        console.error("Notification error:", error);
        return [];
    }
};


// ===============================
//  EXPORTS
// ===============================
export {
    // external
    getUserNotifications,
    getUnreadNotifications,
    markNotificationAsRead,
    markAllAsRead,

    // internal
    sendNotification,
    notifyUser,
    notifyBoardMembers,
    notifyCardMembers,
    notifyMultipleUsers
};