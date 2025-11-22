import mongoose from "mongoose";
import { ActivityLog } from "../models/activityLog.model.js";
import { Workspace } from "../models/workspace.model.js";
import { Board } from "../models/board.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// =========================================================
// HELPER FUNCTIONS (exact positions)
// =========================================================

// Validate IDs
const validateObjectIds = (ids = {}) => {
    for (const [key, value] of Object.entries(ids)) {
        if (!value || !mongoose.Types.ObjectId.isValid(String(value))) {
            throw new ApiError(400, `${key} is invalid`);
        }
    }
};

// Fetch board + workspace together
const getBoardAndWorkspace = async (boardId) => {
    validateObjectIds({ boardId });

    const board = await Board.findById(boardId).lean();
    if (!board) throw new ApiError(404, "Board not found");

    validateObjectIds({ workspaceId: board.workspace });

    const workspace = await Workspace.findById(board.workspace).lean();
    if (!workspace || workspace.isDeleted)
        throw new ApiError(404, "Workspace not found or deleted");

    if (String(board.workspace) !== String(workspace._id)) {
        throw new ApiError(400, "Board does not belong to this workspace");
    }

    return { board, workspace };
};

// Determine user role in workspace
const getUserWorkspaceRole = (workspace, userId) => {
    if (!workspace || !userId) return null;

    if (String(workspace.owner) === String(userId)) return "owner";

    const member = workspace.members?.find(
        (m) => String(m.user) === String(userId)
    );

    return member ? member.role : null;
};

// Check if admin or owner
const isWorkspaceAdminOrOwner = (workspace, userId) => {
    const role = getUserWorkspaceRole(workspace, userId);
    return role === "owner" || role === "admin";
};

// Internal helper: log activity (used inside other controllers)
export const logActivity = async ({
    user,
    workspace,
    board = null,
    action,
    targetType,
    targetId = null,
    details = "",
}) => {

    validateObjectIds({ user, workspace });

    if (board) {
        validateObjectIds({ board });
    }

    if (targetId) {
        validateObjectIds({ targetId });
    }

    await ActivityLog.create({
        user,
        workspace,
        board,
        action,
        targetType,
        targetId,
        details,
    });
};


// =========================================================
// CONTROLLER FUNCTIONS
// =========================================================

// ---------------------------------------------------------
// 1. Get ALL logs user has access to
// ---------------------------------------------------------
const getActivityLogs = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const logs = await ActivityLog.find({
        $or: [
            { user: userId },
            { workspace: { $in: req.user.workspaces } }, // workspace access
        ],
    })
        .populate("user", "name avatar")
        .sort({ createdAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, logs, "Activity logs fetched"));
});

// ---------------------------------------------------------
// 2. Workspace Activity
// ---------------------------------------------------------
const getWorkspaceActivity = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    validateObjectIds({ workspaceId });

    const workspace = await Workspace.findById(workspaceId).lean();
    if (!workspace) throw new ApiError(404, "Workspace not found");

    const role = getUserWorkspaceRole(workspace, req.user._id);
    if (!role) throw new ApiError(403, "You are not a member of this workspace");

    const logs = await ActivityLog.find({ workspace: workspaceId })
        .populate("user", "name avatar")
        .sort({ createdAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, logs, "Workspace activity fetched"));
});

// ---------------------------------------------------------
// 3. Board Activity
// ---------------------------------------------------------
const getBoardActivity = asyncHandler(async (req, res) => {
    const { boardId } = req.params;

    const { board, workspace } = await getBoardAndWorkspace(boardId);

    const role = getUserWorkspaceRole(workspace, req.user._id);
    if (!role) throw new ApiError(403, "You are not a member of this workspace");

    const logs = await ActivityLog.find({ board: boardId })
        .populate("user", "name avatar")
        .sort({ createdAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, logs, "Board activity fetched"));
});

// ---------------------------------------------------------
// 4. Card Activity
// ---------------------------------------------------------
const getCardActivity = asyncHandler(async (req, res) => {
    const { boardId, cardId } = req.params;

    validateObjectIds({ cardId });

    const { board, workspace } = await getBoardAndWorkspace(boardId);

    const role = getUserWorkspaceRole(workspace, req.user._id);
    if (!role) throw new ApiError(403, "No workspace access");

    const logs = await ActivityLog.find({
        board: boardId,
        targetType: "task",
        targetId: cardId,
    })
        .populate("user", "name avatar")
        .sort({ createdAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, logs, "Card activity fetched"));
});

// ---------------------------------------------------------
// 5. List Activity
// ---------------------------------------------------------
const getListActivity = asyncHandler(async (req, res) => {
    const { boardId, listId } = req.params;

    validateObjectIds({ listId });

    const { board, workspace } = await getBoardAndWorkspace(boardId);

    const role = getUserWorkspaceRole(workspace, req.user._id);
    if (!role) throw new ApiError(403, "No access");

    const logs = await ActivityLog.find({
        board: boardId,
        targetType: "list",
        targetId: listId,
    })
        .populate("user", "name avatar")
        .sort({ createdAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, logs, "List activity fetched"));
});

// ---------------------------------------------------------
// 6. Delete Single Log (admin/owner only)
// ---------------------------------------------------------
const deleteActivityLog = asyncHandler(async (req, res) => {
    const { logId } = req.params;

    validateObjectIds({ logId });

    const log = await ActivityLog.findById(logId).lean();
    if (!log) throw new ApiError(404, "Log not found");

    const workspace = await Workspace.findById(log.workspace).lean();
    if (!isWorkspaceAdminOrOwner(workspace, req.user._id))
        throw new ApiError(403, "Only admin/owner can delete logs");

    await ActivityLog.findByIdAndDelete(logId);

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Log deleted successfully"));
});

// ---------------------------------------------------------
// 7. Clear All Board Logs
// ---------------------------------------------------------
const clearBoardActivity = asyncHandler(async (req, res) => {
    const { boardId } = req.params;

    const { board, workspace } = await getBoardAndWorkspace(boardId);

    if (!isWorkspaceAdminOrOwner(workspace, req.user._id))
        throw new ApiError(403, "Only admin/owner can clear board logs");

    await ActivityLog.deleteMany({ board: boardId });

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Board activity cleared"));
});

// ---------------------------------------------------------
// 8. Clear All Workspace Logs (owner only)
// ---------------------------------------------------------
const clearWorkspaceActivity = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;

    validateObjectIds({ workspaceId });

    const workspace = await Workspace.findById(workspaceId).lean();
    if (!workspace) throw new ApiError(404, "Workspace not found");

    if (String(workspace.owner) !== String(req.user._id))
        throw new ApiError(403, "Only owner can clear workspace logs");

    await ActivityLog.deleteMany({ workspace: workspaceId });

    return res
        .status(200)
        .json(new ApiResponse(200, null, "Workspace activity cleared"));
});

// =========================================================
// EXPORTS
// =========================================================
export {
    getActivityLogs,
    getWorkspaceActivity,
    getBoardActivity,
    getCardActivity,
    getListActivity,
    deleteActivityLog,
    clearBoardActivity,
    clearWorkspaceActivity
};