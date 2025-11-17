import mongoose from "mongoose";
import { List } from "../models/list.model.js";
import { Board } from "../models/board.model.js";
import { Workspace } from "../models/workspace.model.js";
import { Card } from "../models/card.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/*
Helper functions (exact positions in file):
    - validateObjectId
    - getBoardAndWorkspace
    - getUserWorkspaceRole
    - isBoardMember
    - isWorkspaceAdminOrOwner
    - isListCreatorOrAdmin
*/

const validateObjectId = (id, name = "id") => {
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        throw new ApiError(400, `${name} is invalid`);
    }
};

const getBoardAndWorkspace = async (boardId) => {
    validateObjectId(boardId, "boardId");
    const board = await Board.findById(boardId).lean();
    if (!board) throw new ApiError(404, "Board not found");
    validateObjectId(board.workspace, "workspaceId");
    const workspace = await Workspace.findById(board.workspace).lean();
    if (!workspace || workspace.isDeleted) throw new ApiError(404, "Workspace not found or deleted");
    return { board, workspace };
};

// Returns role string from workspace.members or 'owner' if owner.
const getUserWorkspaceRole = (workspace, userId) => {
    if (!workspace || !userId) return null;
    if (String(workspace.owner) === String(userId)) return "owner";
    if (!Array.isArray(workspace.members)) return null;
    const member = workspace.members.find(m => String(m.user) === String(userId));
    return member ? member.role : null;
};

const isBoardMember = (board, userId) => {
    if (!board) return false;
    return board.members && board.members.some(m => String(m) === String(userId));
};

const isWorkspaceAdminOrOwner = (workspace, userId) => {
    const role = getUserWorkspaceRole(workspace, userId);
    return role === "owner" || role === "admin";
};

const isListCreatorOrAdmin = (listDoc, workspace, userId) => {
    if (!listDoc) return false;
    if (String(listDoc.createdBy) === String(userId)) return true;
    return isWorkspaceAdminOrOwner(workspace, userId);
};

/**
 *  Controller function
 */
// Create a new list inside a board
const createList = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const { boardId } = req.params;
    if (!boardId || !mongoose.Types.ObjectId.isValid(boardId)) {
        throw new ApiError(400, "boardId is required and must be a valid id");
    }

    const { title, position } = req.body;

    // validate title
    if (!title || typeof title !== "string" || !title.trim()) {
        throw new ApiError(400, "title is required and must be a non-empty string");
    }

    // if provided, validate position
    if (position !== undefined && (!Number.isInteger(position) || position < 0)) {
        throw new ApiError(400, "position must be a non-negative integer when provided");
    }

    // fetch board and workspace
    const board = await Board.findById(boardId);
    if (!board) throw new ApiError(404, "Board not found");

    const workspace = await Workspace.findById(board.workspace);
    if (!workspace || workspace.isDeleted) throw new ApiError(404, "Workspace not found or deleted");

    // permission check: user must be a board member OR workspace admin/owner
    const isBoardMember = Array.isArray(board.members) && board.members.some(m => String(m) === String(userId));
    const wsRole =
        String(workspace.owner) === String(userId)
            ? "owner"
            : (Array.isArray(workspace.members) && workspace.members.find(m => String(m.user) === String(userId))?.role) || null;
    const isWorkspaceAdminOrOwner = wsRole === "owner" || wsRole === "admin";

    if (!isBoardMember && !isWorkspaceAdminOrOwner) {
        throw new ApiError(403, "You are not a member of this board");
    }

    // transaction: compute position, shift others, create list
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const count = await List.countDocuments({ board: boardId }).session(session);

        const finalPosition =
            position !== undefined && position !== null
                ? Math.min(position, count)
                : count;

        await List.updateMany(
            { board: boardId, position: { $gte: finalPosition } },
            { $inc: { position: 1 } },
            { session }
        );

        const createdArr = await List.create(
            [{
                title: title.trim(),
                position: finalPosition,
                board: boardId,
                createdBy: userId
            }],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        const created = createdArr[0];

        const populated = await List.findById(created._id)
            .populate({ path: "cards", options: { sort: { position: 1 } } });

        return res.status(201).json(
            new ApiResponse(201, populated, "List created successfully")
        );

    } catch (err) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        throw err;
    }

});

// Get all lists for a board
const getListsByBoard = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const { boardId } = req.params;
    validateObjectId(boardId, "boardId");

    // Fetch board + workspace using the helper
    const { board, workspace } = await getBoardAndWorkspace(boardId);

    // Permission check → any board member OR workspace admin/owner
    const allowed =
        isBoardMember(board, userId) ||
        isWorkspaceAdminOrOwner(workspace, userId);

    if (!allowed) {
        throw new ApiError(403, "You are not allowed to view lists of this board");
    }

    // Fetch lists sorted by position
    const lists = await List.find({ board: boardId })
        .populate({ path: "cards", model: "Card", options: { sort: { position: 1 } } })
        .sort({ position: 1 });

    return res
        .status(200)
        .json(new ApiResponse(200, lists, "Lists fetched successfully"));
});

// Get a single list by ID
const getListById = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const { listId } = req.params;
    validateObjectId(listId, "listId");

    // Find the list first
    const list = await List.findById(listId)
        .populate({
            path: "cards",
            model: "Card",
            options: { sort: { position: 1 } }
        });

    if (!list) throw new ApiError(404, "List not found");

    // Now fetch board & workspace using helper
    const { board, workspace } = await getBoardAndWorkspace(list.board);

    // Permission Check → Board Member OR Workspace Admin/Owner
    const allowed =
        isBoardMember(board, userId) ||
        isWorkspaceAdminOrOwner(workspace, userId);

    if (!allowed) {
        throw new ApiError(403, "You are not allowed to access this list");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, list, "List fetched successfully"));
});

// Update list (name or position)
const updateList = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const { listId } = req.params;
    validateObjectId(listId, "listId");

    const { title, position } = req.body;

    // Validate fields
    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
        throw new ApiError(400, "title must be a non-empty string");
    }

    if (position !== undefined && (!Number.isInteger(position) || position < 0)) {
        throw new ApiError(400, "position must be a non-negative integer");
    }

    // Get list first
    const list = await List.findById(listId);
    if (!list) throw new ApiError(404, "List not found");

    // Load board & workspace
    const { board, workspace } = await getBoardAndWorkspace(list.board);

    // Permission: Only List Creator OR Workspace Admin/Owner can update
    const allowed = isListCreatorOrAdmin(list, workspace, userId);
    if (!allowed) {
        throw new ApiError(403, "You are not allowed to update this list");
    }

    // UPDATE TITLE ONLY (no position change)
    const isOnlyTitleChange = title !== undefined && position === undefined;

    if (isOnlyTitleChange) {
        list.title = title.trim();
        await list.save();

        return res
            .status(200)
            .json(new ApiResponse(200, list, "List title updated successfully"));
    }

    if (position !== undefined) {
        const session = await mongoose.startSession();

        try {
            session.startTransaction();

            const allLists = await List
                .find({ board: board._id })
                .session(session)
                .sort({ position: 1 });

            const oldIndex = list.position;
            const newIndex = Math.min(position, allLists.length - 1);

            if (oldIndex !== newIndex) {
                // Remove list from current index
                allLists.splice(oldIndex, 1);

                // Insert list at new index
                allLists.splice(newIndex, 0, list);

                // Update positions
                await Promise.all(
                    allLists.map((l, idx) => {
                        if (l.position !== idx) {
                            return List.updateOne(
                                { _id: l._id },
                                { $set: { position: idx } },
                                { session }
                            );
                        }
                    })
                );
            }

            // Title update as well (if provided)
            if (title !== undefined) {
                list.title = title.trim();
                await list.save({ session });
            }

            await session.commitTransaction();
            session.endSession();

            const updated = await List.findById(listId)
                .populate("cards");

            return res
                .status(200)
                .json(new ApiResponse(200, updated, "List updated successfully"));
        } catch (err) {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            session.endSession();
            throw err;
        }
    }

    // If no valid field provided
    throw new ApiError(400, "Nothing to update");
});

// Delete a list (hard delete + audit logging)
const deleteList = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const { listId } = req.params;
    validateObjectId(listId, "listId");

    // 1. Load list
    const list = await List.findById(listId);
    if (!list) throw new ApiError(404, "List not found");

    // 2. Load board + workspace (includes workspace validation)
    const { board, workspace } = await getBoardAndWorkspace(list.board);

    // 3. Permissions — only Owner or Admin can delete a list
    if (!isWorkspaceAdminOrOwner(workspace, userId)) {
        throw new ApiError(403, "Only workspace owner or admin can delete lists");
    }

    // Start transaction
    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const boardId = list.board;
        const removedPos = list.position;

        // ------- STEP A: DELETE ALL CARDS UNDER THE LIST -------
        await Card.deleteMany({ list: listId }).session(session);

        // ------- STEP B: DELETE THE LIST ITSELF -------
        const removed = await List.deleteOne({ _id: listId }).session(session);
        if (removed.deletedCount === 0) {
            throw new ApiError(500, "Failed to delete list");
        }

        // ------- STEP C: NORMALIZE POSITIONS OF OTHER LISTS -------
        await List.updateMany(
            { board: boardId, position: { $gt: removedPos } },
            { $inc: { position: -1 } },
            { session }
        );

        // ------- STEP D: WRITE AUDIT LOG (BEST PRACTICE) -------
        await Workspace.updateOne(
            { _id: workspace._id },
            {
                $push: {
                    activityLog: {
                        action: "list_deleted",
                        listId,
                        listName: list.name,
                        boardId,
                        deletedBy: userId,
                        timestamp: new Date(),
                    },
                },
            },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        return res
            .status(200)
            .json(new ApiResponse(200, null, "List deleted successfully"));
    } catch (error) {
        if (session.inTransaction()) {
            await session.abortTransaction();
        }
        session.endSession();
        throw err;
    }
});

// Archive / Unarchive / Activate / Deactivate list
const toggleListStatus = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const { listId } = req.params;
    const { action } = req.body;

    validateObjectId(listId, "listId");

    if (!action) throw new ApiError(400, "Action is required");

    const VALID_ACTIONS = ["archive", "unarchive", "deactivate", "activate"];
    if (!VALID_ACTIONS.includes(action)) {
        throw new ApiError(400, `Invalid action. Allowed: ${VALID_ACTIONS.join(", ")}`);
    }

    // 1. Find list
    const list = await List.findById(listId);
    if (!list) throw new ApiError(404, "List not found");

    // 2. Load board & workspace
    const { board, workspace } = await getBoardAndWorkspace(list.board);

    // FIX: Ensure list actually belongs to the board
    if (String(list.board) !== String(board._id)) {
        throw new ApiError(400, "List does not belong to this board");
    }

    // 3. Only list creator OR workspace admin/owner can toggle status
    if (!isListCreatorOrAdmin(list, workspace, userId)) {
        throw new ApiError(403, "You are not allowed to modify this list");
    }

    let updatedStatus = {};

    // -------------------------------
    // 4. Apply Action
    // -------------------------------
    switch (action) {
        case "archive":
            if (list.isArchived) throw new ApiError(400, "List is already archived");
            updatedStatus = { isArchived: true };
            updatedStatus.isActive = false; // ← FIX: archived lists are not active
            break;

        case "unarchive":
            if (!list.isArchived) throw new ApiError(400, "List is not archived");
            updatedStatus = { isArchived: false };
            updatedStatus.isActive = true; // ← FIX: unarchived lists become active
            break;

        case "deactivate":
            if (!list.isActive) throw new ApiError(400, "List is already inactive");
            updatedStatus = { isActive: false };
            break;

        case "activate":
            if (list.isActive) throw new ApiError(400, "List is already active");
            updatedStatus = { isActive: true };
            break;
    }

    // 5. Update list status
    const updatedList = await List.findByIdAndUpdate(
        listId,
        { $set: updatedStatus },
        { new: true }
    );

    // 6. Audit log for admins
    await Workspace.updateOne(
        { _id: workspace._id },
        {
            $push: {
                activityLog: {
                    action: `list_${action}`,
                    listId,
                    listName: list.title, // ← FIXED: changed from list.name
                    boardId: board._id,
                    userId,
                    timestamp: new Date(),
                },
            },
        }
    );

    // FIX: Proper success message mapping
    const message =
        action === "archive"
            ? "List archived successfully"
            : action === "unarchive"
            ? "List unarchived successfully"
            : action === "activate"
            ? "List activated successfully"
            : "List deactivated successfully";

    return res.status(200).json(new ApiResponse(200, updatedList, message));
});

// Move list to another board
const moveListToAnotherBoard = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const { listId } = req.params;
    const { targetBoardId } = req.body;

    validateObjectId(listId, "listId");
    validateObjectId(targetBoardId, "targetBoardId");

    // 1. Load the list
    const list = await List.findById(listId);
    if (!list) throw new ApiError(404, "List not found");

    const sourceBoardId = list.board;

    // Prevent moving to the same board
    if (String(sourceBoardId) === String(targetBoardId)) {
        throw new ApiError(400, "List is already in this board");
    }

    // 2. Load source & target boards + workspace
    const sourceBoard = await Board.findById(sourceBoardId);
    if (!sourceBoard) throw new ApiError(404, "Source board not found");

    const targetBoard = await Board.findById(targetBoardId);
    if (!targetBoard) throw new ApiError(404, "Target board not found");

    // 3. Ensure both boards belong to the SAME workspace
    if (String(sourceBoard.workspace) !== String(targetBoard.workspace)) {
        throw new ApiError(400, "Cannot move list across different workspaces");
    }

    const workspace = await Workspace.findById(sourceBoard.workspace);
    if (!workspace) throw new ApiError(404, "Workspace not found");

    // 4. Permissions: Only workspace owner/admin can move lists between boards
    if (!isWorkspaceAdminOrOwner(workspace, userId)) {
        throw new ApiError(403, "Only workspace owner/admin can move lists");
    }

    // 5. Update list position inside the new board
    const targetBoardLists = await List.find({ board: targetBoardId })
        .sort({ position: 1 });

    const newPosition =
        targetBoardLists.length === 0
            ? 1
            : targetBoardLists[targetBoardLists.length - 1].position + 1;

    // 6. Apply move
    list.board = targetBoardId;
    list.position = newPosition;
    await list.save();

    // (Optional) Normalize positions on the old board
    const sourceLists = await List.find({ board: sourceBoardId }).sort({ position: 1 });

    for (let i = 0; i < sourceLists.length; i++) {
        sourceLists[i].position = i + 1;
        await sourceLists[i].save();
    }

    return res
        .status(200)
        .json(new ApiResponse(200, list, "List moved to another board successfully"));
});

// Clear list (delete all cards inside a list)
const clearCard = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const { listId } = req.params;
    validateObjectId(listId, "listId");

    // 1. Get the list
    const list = await List.findById(listId);
    if (!list) throw new ApiError(404, "List not found");

    // 2. Get board + workspace
    const { board, workspace } = await getBoardAndWorkspace(list.board);

    // 3. Permission check: only List Creator OR Workspace Admin/Owner
    if (!isListCreatorOrAdmin(list, workspace, userId)) {
        throw new ApiError(
            403,
            "Only list creator or workspace admin/owner can clear this list"
        );
    }

    // 4. If no cards, return early
    if (!list.cards || list.cards.length === 0) {
        return res
            .status(200)
            .json(
                new ApiResponse(200, list, "List already empty")
            );
    }

    // 5. Delete all cards inside the list
    await Card.deleteMany({ _id: { $in: list.cards } });

    // 6. Clear card references from the list
    list.cards = [];
    await list.save();

    // 7. Success response
    return res
        .status(200)
        .json(
            new ApiResponse(200, list, "All cards removed from the list successfully")
        );
});

// Reorder lists inside a board (drag & drop)
const reOrderList = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    if (!userId) throw new ApiError(401, "Unauthorized");

    const { boardId } = req.params;
    const { startIndex, endIndex, listId } = req.body;

    // Validate inputs
    validateObjectId(boardId, "boardId");
    validateObjectId(listId, "listId");

    if (startIndex === undefined || endIndex === undefined) {
        throw new ApiError(400, "startIndex and endIndex are required");
    }

    if (typeof startIndex !== "number" || typeof endIndex !== "number") {
        throw new ApiError(400, "startIndex and endIndex must be numbers");
    }

    // Load board & workspace
    const { board, workspace } = await getBoardAndWorkspace(boardId);

    // Permission: Any board member can reorder lists
    if (!isBoardMember(board, userId) && !isWorkspaceAdminOrOwner(workspace, userId)) {
        throw new ApiError(403, "Only board members can reorder lists");
    }

    // Load lists of this board
    const lists = await List.find({ board: boardId }).sort({ position: 1 });

    if (lists.length === 0) {
        throw new ApiError(400, "Board has no lists to reorder");
    }

    // Convert to array of IDs for easy manipulation
    let order = lists.map((l) => String(l._id));

    // Ensure the dragged list is in the order array
    if (!order.includes(String(listId))) {
        throw new ApiError(404, "List not found in this board");
    }

    // Remove list from old position
    order.splice(startIndex, 1);

    // Insert list at new position
    order.splice(endIndex, 0, String(listId));

    // Save the new order
    const bulkOps = order.map((id, index) => ({
        updateOne: {
            filter: { _id: id },
            update: { position: index + 1 },
        },
    }));

    await List.bulkWrite(bulkOps);

    // Fetch updated lists
    const updatedLists = await List.find({ board: boardId }).sort({ position: 1 });

    return res
        .status(200)
        .json(new ApiResponse(200, updatedLists, "Lists reordered successfully"));
});

export {
    createList,
    getListsByBoard,
    getListById,
    updateList,
    deleteList,
    toggleListStatus,
    moveListToAnotherBoard,
    clearCard,
    reOrderList
};