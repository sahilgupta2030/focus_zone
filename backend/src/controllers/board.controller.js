import mongoose from "mongoose";
import { Board } from "../models/board.model.js";
import { Workspace } from "../models/workspace.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logActivity } from "../controllers/activityLog.controller.js";

const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(String(id));

// Create a new board - Admin only
const createBoard = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { title, workspaceId } = req.body;

    if (!userId) throw new ApiError(401, "Unauthorized: user not found");
    if (!title || !workspaceId) throw new ApiError(400, "Title and workspaceId are required");
    if (!isValidObjectId(workspaceId)) throw new ApiError(400, "Invalid workspaceId");

    const workspace = await Workspace.findOne({
        _id: workspaceId,
        isDeleted: false
    }).populate("members.user");
    if (!workspace) throw new ApiError(404, "Workspace not found");

    const userInWorkspace = workspace.members.find(
        (member) =>
            member.user?.toString() === userId.toString() ||
            member.user?._id?.toString() === userId.toString()
    );

    if (!userInWorkspace) throw new ApiError(403, "You are not a member of this workspace");

    if (!["admin", "owner"].includes(userInWorkspace.role)) {
        throw new ApiError(403, "You are not authorized to create a board");
    }

    const board = await Board.create({
        title,
        workspace: workspaceId,
        members: [userId],
        columns: [{ name: "To Do", tasks: [] }],
    });

    // Log Activity (BOARD_CREATED)
    await logActivity({
        user: userId,
        workspace: workspaceId,
        board: board._id,
        action: "BOARD_CREATED",
        targetType: "board",
        targetId: board._id,
        details: `Board titled '${title}' created`,
    });

    const populated = await Board.findById(board._id)
        .populate("members", "name email")
        .populate("workspace", "name");

    return res
        .status(201)
        .json(new ApiResponse(201, populated, "Board created successfully"));
});

// Get all boards under a workspace - All member
const getBoardsByWorkspace = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { workspaceId } = req.params;

    if (!userId) throw new ApiError(401, "Unauthorized: user not found");
    if (!workspaceId) throw new ApiError(400, "Workspace ID is required");
    if (!isValidObjectId(workspaceId)) throw new ApiError(400, "Invalid workspaceId");

    const workspace = await Workspace.findOne({
        _id: workspaceId,
        isDeleted: false
    }).populate("members.user");
    if (!workspace) throw new ApiError(404, "Workspace not found");

    const userInWorkspace = workspace.members.find(
        (member) =>
            member.user?.toString() === userId.toString() ||
            member.user?._id?.toString() === userId.toString()
    );
    if (!userInWorkspace) throw new ApiError(403, "You are not a member of this workspace");

    const boards = await Board.find({ workspace: workspaceId })
        .populate("members", "name email")
        .populate("workspace", "name");

    if (!boards || boards.length === 0) {
        return res.status(200).json(new ApiResponse(200, [], "No boards found in this workspace"));
    }

    return res
        .status(200)
        .json(new ApiResponse(200, boards, "Boards fetched successfully"));
});

// Get single board - All member
const getBoardById = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { boardId } = req.params;

    if (!userId) throw new ApiError(401, "Unauthorized: user not found");
    if (!boardId) throw new ApiError(400, "Board ID is required");
    if (!isValidObjectId(boardId)) throw new ApiError(400, "Invalid board ID");

    const board = await Board.findById(boardId)
        .populate("members", "name email")
        .populate("workspace", "name");

    if (!board) throw new ApiError(404, "Board not found");

    const workspaceId =
        board.workspace && board.workspace._id ? board.workspace._id : board.workspace;

    const workspace = await Workspace.findOne({
        _id: workspaceId,
        isDeleted: false
    }).populate("members.user");

    if (!workspace) throw new ApiError(404, "Workspace not found or deleted");

    const userInWorkspace = workspace.members.find(
        (member) =>
            member.user?.toString() === userId.toString() ||
            member.user?._id?.toString() === userId.toString()
    );

    if (!userInWorkspace) throw new ApiError(403, "You are not a member of this workspace");

    return res
        .status(200)
        .json(new ApiResponse(200, board, "Board fetched successfully"));
});

// Get all board members - All member
const getBoardMember = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { boardId } = req.params;

    if (!userId) throw new ApiError(401, "Unauthorized: user not found");
    if (!boardId) throw new ApiError(400, "Board ID is required");
    if (!isValidObjectId(boardId)) throw new ApiError(400, "Invalid board ID");

    const board = await Board.findById(boardId)
        .populate("members", "name email")
        .populate("workspace", "name");

    if (!board) throw new ApiError(404, "Board not found");

    const workspaceId =
        board.workspace && board.workspace._id ? board.workspace._id : board.workspace;

    const workspace = await Workspace.findOne({
        _id: workspaceId,
        isDeleted: false
    }).populate("members.user");

    if (!workspace) throw new ApiError(404, "Workspace not found or deleted");

    const userInWorkspace = workspace.members.find(
        (member) =>
            member.user?.toString() === userId.toString() ||
            member.user?._id?.toString() === userId.toString()
    );
    if (!userInWorkspace) throw new ApiError(403, "You are not a member of this workspace");

    return res
        .status(200)
        .json(new ApiResponse(200, board.members, "Board members fetched successfully"));
});

// Get all boards user has access to - All member
const getAllBoard = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    if (!userId) throw new ApiError(401, "Unauthorized: user not found");

    const workspaces = await Workspace.find({
        "members.user": userId,
        isDeleted: false
    });

    if (!workspaces || workspaces.length === 0) {
        return res.status(200).json(new ApiResponse(200, [], "No boards found"));
    }

    const workspaceIds = workspaces.map(ws => ws._id);

    const boards = await Board.find({ workspace: { $in: workspaceIds } })
        .populate("members", "name email")
        .populate("workspace", "name");

    if (!boards || boards.length === 0) {
        return res.status(200).json(new ApiResponse(200, [], "No boards found"));
    }

    return res
        .status(200)
        .json(new ApiResponse(200, boards, "All boards fetched successfully"));
});

// Update board - Admin only
const updateBoard = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { boardId } = req.params;
    const { title } = req.body;

    if (!userId) throw new ApiError(401, "Unauthorized: user not found");
    if (!boardId) throw new ApiError(400, "Board ID is required");
    if (!isValidObjectId(boardId)) throw new ApiError(400, "Invalid board ID");

    const board = await Board.findById(boardId);
    if (!board) throw new ApiError(404, "Board not found");

    const workspace = await Workspace.findOne({
        _id: board.workspace,
        isDeleted: false
    }).populate("members.user");
    if (!workspace) throw new ApiError(404, "Workspace not found or deleted");

    const userInWorkspace = workspace.members.find(
        (member) =>
            member.user?.toString() === userId.toString() ||
            member.user?._id?.toString() === userId.toString()
    );
    if (!userInWorkspace) throw new ApiError(403, "You are not a member of this workspace");

    if (!["admin", "owner"].includes(userInWorkspace.role)) {
        throw new ApiError(403, "You are not authorized to update this board");
    }

    const updatedData = {};
    if (title) updatedData.title = title;

    const updatedBoard = await Board.findByIdAndUpdate(boardId, updatedData, { new: true })
        .populate("members", "name email")
        .populate("workspace", "name");

    // Log Activity (BOARD_UPDATED)
    await logActivity({
        user: userId,
        workspace: board.workspace,
        board: boardId,
        action: "BOARD_UPDATED",
        targetType: "board",
        targetId: boardId,
        details: `Board updated: ${title ? "title changed" : "other updates"}`,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, updatedBoard, "Board updated successfully"));
});

// Delete board - Admin only
const deleteBoard = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { boardId } = req.params;

    if (!userId) throw new ApiError(401, "Unauthorized: user not found");
    if (!boardId) throw new ApiError(400, "Board ID is required");
    if (!isValidObjectId(boardId)) throw new ApiError(400, "Invalid board ID");

    const board = await Board.findById(boardId);
    if (!board) throw new ApiError(404, "Board not found");

    const workspace = await Workspace.findOne({
        _id: board.workspace,
        isDeleted: false
    }).populate("members.user");
    if (!workspace) throw new ApiError(404, "Workspace not found or deleted");

    const userInWorkspace = workspace.members.find(
        (member) =>
            member.user?.toString() === userId.toString() ||
            member.user?._id?.toString() === userId.toString()
    );
    if (!userInWorkspace) throw new ApiError(403, "You are not a member of this workspace");

    if (!["admin", "owner"].includes(userInWorkspace.role)) {
        throw new ApiError(403, "You are not authorized to delete this board");
    }

    await Board.findByIdAndDelete(boardId);

    // Log Activity (BOARD_DELETED)
    await logActivity({
        user: userId,
        workspace: board.workspace,
        board: boardId,
        action: "BOARD_DELETED",
        targetType: "board",
        targetId: boardId,
        details: "Board deleted",
    });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Board deleted successfully"));
});

// Add member to board - Admin only
const addMemberToBoard = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { boardId } = req.params;
    const { memberId } = req.body;

    if (!userId) throw new ApiError(401, "Unauthorized: user not found");
    if (!boardId || !memberId) throw new ApiError(400, "Board ID and member ID are required");
    if (!isValidObjectId(boardId)) throw new ApiError(400, "Invalid board ID");
    if (!isValidObjectId(memberId)) throw new ApiError(400, "Invalid member ID");

    const board = await Board.findById(boardId);
    if (!board) throw new ApiError(404, "Board not found");

    const workspace = await Workspace.findOne({
        _id: board.workspace,
        isDeleted: false
    }).populate("members.user");
    if (!workspace) throw new ApiError(404, "Workspace not found or deleted");

    const currentUser = workspace.members.find((member) => {
        const id =
            typeof member.user === "object"
                ? member.user?._id?.toString()
                : member.user?.toString();
        return id === userId.toString();
    });

    if (!currentUser) throw new ApiError(403, "You are not a member of this workspace");

    if (!["admin", "owner"].includes(currentUser.role)) {
        throw new ApiError(403, "You are not authorized to add members to this board");
    }

    const memberInWorkspace = workspace.members.find(
        (member) =>
            member.user?.toString() === memberId.toString() ||
            member.user?._id?.toString() === memberId.toString()
    );
    if (!memberInWorkspace) throw new ApiError(400, "User is not part of this workspace");

    const alreadyMember = board.members.some((id) => String(id) === String(memberId));
    if (alreadyMember) throw new ApiError(400, "User is already a member of this board");

    board.members.push(memberId);
    await board.save();

    const updatedBoard = await Board.findById(boardId)
        .populate("members", "name email")
        .populate("workspace", "name");

    // Log Activity (BOARD_MEMBER_ADDED)
    await logActivity({
        user: userId,
        workspace: board.workspace,
        board: boardId,
        action: "BOARD_MEMBER_ADDED",
        targetType: "board",
        targetId: boardId,
        details: `Member added: ${memberId}`,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, updatedBoard, "Member added successfully"));
});

// Remove member from board - Admin only
const removeMemberFromBoard = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { boardId } = req.params;
    const { memberId } = req.body;

    if (!userId) throw new ApiError(401, "Unauthorized: user not found");
    if (!boardId || !memberId) throw new ApiError(400, "Board ID and member ID are required");
    if (!isValidObjectId(boardId)) throw new ApiError(400, "Invalid board ID");
    if (!isValidObjectId(memberId)) throw new ApiError(400, "Invalid member ID");

    const board = await Board.findById(boardId);
    if (!board) throw new ApiError(404, "Board not found");

    const workspace = await Workspace.findOne({
        _id: board.workspace,
        isDeleted: false
    }).populate("members.user");
    if (!workspace) throw new ApiError(404, "Workspace not found or deleted");

    const currentUser = workspace.members.find((member) => {
        const id =
            typeof member.user === "object"
                ? member.user?._id?.toString()
                : member.user?.toString();
        return id === userId.toString();
    });

    if (!currentUser) throw new ApiError(403, "You are not a member of this workspace");

    if (!["owner", "admin"].includes(currentUser.role)) {
        throw new ApiError(403, "You are not authorized to remove members from this board");
    }

    const memberInWorkspace = workspace.members.find(
        (member) =>
            member.user?.toString() === memberId.toString() ||
            member.user?._id?.toString() === memberId.toString()
    );
    if (!memberInWorkspace) throw new ApiError(400, "User is not part of this workspace");

    const isOnBoard = board.members.some((m) => String(m) === String(memberId));
    if (!isOnBoard) throw new ApiError(400, "User is not a member of this board");

    // Optional safety check: workspace owner cannot be removed
    if (String(workspace.owner) === String(memberId)) {
        throw new ApiError(403, "Cannot remove workspace owner from the board");
    }

    board.members = board.members.filter((m) => String(m) !== String(memberId));
    await board.save();

    const updatedBoard = await Board.findById(boardId)
        .populate("members", "name email")
        .populate("workspace", "name");

    // Log Activity (BOARD_MEMBER_REMOVED)
    await logActivity({
        user: userId,
        workspace: board.workspace,
        board: boardId,
        action: "BOARD_MEMBER_REMOVED",
        targetType: "board",
        targetId: boardId,
        details: `Member removed: ${memberId}`,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, updatedBoard, "Member removed successfully"));
});

export {
    createBoard,
    getBoardsByWorkspace,
    getBoardById,
    getBoardMember,
    getAllBoard,
    updateBoard,
    deleteBoard,
    addMemberToBoard,
    removeMemberFromBoard
};