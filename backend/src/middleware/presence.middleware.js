import { Workspace } from "../models/workspace.model.js";
import { Presence } from "../models/presence.model.js";
import { ApiError } from "../utils/apiError.js";

const updatePresenceActivity = async (userId, workspaceId) => {

    if (!userId || !workspaceId) {
        throw new ApiError(400, "userId and workspaceId are required");
    }

    const presence = await Presence.findOne({ user: userId, workspace: workspaceId });

    if (!presence) {
        throw new ApiError(404, "Presence record not found");
    }

    presence.lastActive = new Date();

    await presence.save();

    return presence;
};

const ensureWorkspaceExists = async (workspaceId) => {
    validateObjectId(workspaceId, "workspaceId");

    const workspace = await Workspace.findById(workspaceId).lean();
    if (!workspace || workspace.isDeleted) {
        throw new ApiError(404, "Workspace not found or deleted");
    }
    return workspace;
};

/**
 * Global presence updater
 * Automatically updates presence on any route containing :workspaceId
 */
export const presenceUpdater = async (req, res, next) => {
    try {
        const workspaceId = req.params.workspaceId;
        const userId = req.user?._id;

        // If no workspaceId OR user not authenticated → skip
        if (!workspaceId || !userId) {
            return next();
        }

        // Ensure workspace exists (prevents ghost presence updates)
        await ensureWorkspaceExists(workspaceId);

        // Update user presence (non-blocking)
        updatePresenceActivity(userId, workspaceId).catch(() => {
            // Silently ignore update errors (should not break main request)
        });

        next(); // Continue to controller

    } catch (error) {
        // Presence issues should NOT block main features
        next();
    }
};