import mongoose from "mongoose";
import { Presence } from "../models/presence.model.js";
import { Workspace } from "../models/workspace.model.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiResponse } from "../utils/apiResponse.js";


/**
 * Validate MongoDB ObjectId
 */
const validateObjectId = (id, name = "id") => {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `${name} is invalid`);
    }
};

/**
 * Ensure workspace exists & is not deleted
 */
const ensureWorkspaceExists = async (workspaceId) => {
    validateObjectId(workspaceId, "workspaceId");

    const workspace = await Workspace.findById(workspaceId).lean();
    if (!workspace || workspace.isDeleted) {
        throw new ApiError(404, "Workspace not found or deleted");
    }
    return workspace;
};

/**
 * Find or create presence record
 */
const findOrCreatePresence = async (userId, workspaceId, req = null) => {
    let presence = await Presence.findOne({ user: userId, workspace: workspaceId });

    if (!presence) {
        presence = await Presence.create({
            user: userId,
            workspace: workspaceId,
            browserInfo: req
                ? {
                    ip: req.ip,
                    userAgent: req.headers["user-agent"],
                }
                : undefined,
        });
    }

    return presence;
};

const setUserOnline = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user?._id;

    await ensureWorkspaceExists(workspaceId);

    const presence = await findOrCreatePresence(userId, workspaceId, req);

    presence.isOnline = true;
    presence.lastActive = new Date();
    await presence.save();

    return res
        .status(200)
        .json(new ApiResponse(200, presence, "User marked online"));
});

const setUserOffline = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user?._id;

    await ensureWorkspaceExists(workspaceId);

    const presence = await findOrCreatePresence(userId, workspaceId);

    presence.isOnline = false;
    presence.lastActive = new Date();
    await presence.save();

    return res
        .status(200)
        .json(new ApiResponse(200, presence, "User marked offline"));
});

const updateLastActive = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user?._id;

    await ensureWorkspaceExists(workspaceId);

    const presence = await findOrCreatePresence(userId, workspaceId);

    presence.lastActive = new Date();
    await presence.save();

    return res
        .status(200)
        .json(new ApiResponse(200, presence, "Last active updated"));
});

const getOnlineUsersInWorkspace = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;

    await ensureWorkspaceExists(workspaceId);

    const onlineUsers = await Presence.find({
        workspace: workspaceId,
        isOnline: true
    })
        .populate("user", "username email avatarUrl")
        .lean();

    return res
        .status(200)
        .json(new ApiResponse(200, onlineUsers, "Online users fetched"));
});

const getUserPresence = asyncHandler(async (req, res) => {
    const { workspaceId, userId } = req.params;

    validateObjectId(userId, "userId");
    await ensureWorkspaceExists(workspaceId);

    const presence = await Presence.findOne({
        user: userId,
        workspace: workspaceId
    }).lean();

    if (!presence) {
        throw new ApiError(404, "Presence not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, presence, "User presence fetched"));
});

const getPresenceForWorkspaceMembers = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;

    await ensureWorkspaceExists(workspaceId);

    const membersPresence = await Presence.find({ workspace: workspaceId })
        .populate("user", "username email avatarUrl")
        .lean();

    return res
        .status(200)
        .json(new ApiResponse(200, membersPresence, "Presence for all members fetched"));
});

export {
    setUserOnline,
    setUserOffline,
    updateLastActive,
    getOnlineUsersInWorkspace,
    getUserPresence,
    getPresenceForWorkspaceMembers
}