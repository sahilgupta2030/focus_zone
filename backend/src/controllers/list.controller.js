import mongoose from "mongoose";
import { List } from "../models/list.model.js";
import { Board } from "../models/board.model.js";
import { Workspace } from "../models/workspace.model.js";
import { Card } from "../models/card.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { logActivity } from "../controllers/activityLog.controller.js";
import { notifyBoardMembers } from "../controllers/notification.controller.js";

/*
Helper functions:
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
    if (!workspace || workspace.isDeleted)
        throw new ApiError(404, "Workspace not found or deleted");

    return { board, workspace };
};

const getUserWorkspaceRole = (workspace, userId) => {
    if (!workspace || !userId) return null;

    if (String(workspace.owner) === String(userId)) return "owner";

    const m = workspace.members?.find((x) => String(x.user) === String(userId));
    return m ? m.role : null;
};

const isBoardMember = (board, userId) => {
    return board.members?.some((m) => String(m) === String(userId));
};

const isWorkspaceAdminOrOwner = (workspace, userId) => {
    const role = getUserWorkspaceRole(workspace, userId);
    return role === "owner" || role === "admin";
};

const isListCreatorOrAdmin = (list, workspace, userId) => {
    if (String(list.createdBy) === String(userId)) return true;
    return isWorkspaceAdminOrOwner(workspace, userId);
};

/*
──────────────────────────────────────────────────────────
    CREATE LIST
──────────────────────────────────────────────────────────
*/
const createList = asyncHandler(async (req, res) => {
    const user = req.user?._id;
    if (!user) throw new ApiError(401, "Unauthorized");

    const { boardId } = req.params;
    validateObjectId(boardId, "boardId");

    const { title, position } = req.body;
    if (!title || !title.trim()) throw new ApiError(400, "title is required");

    const board = await Board.findById(boardId);
    if (!board) throw new ApiError(404, "Board not found");

    const workspace = await Workspace.findById(board.workspace);
    if (!workspace || workspace.isDeleted)
        throw new ApiError(404, "Workspace not found");

    const isMember = isBoardMember(board, user);
    const isAdmin = isWorkspaceAdminOrOwner(workspace, user);
    if (!isMember && !isAdmin)
        throw new ApiError(403, "You are not a member of this board");

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const count = await List.countDocuments({ board: boardId }).session(session);
        const finalPosition =
            position !== undefined ? Math.min(position, count) : count;

        await List.updateMany(
            { board: boardId, position: { $gte: finalPosition } },
            { $inc: { position: 1 } },
            { session }
        );

        const arr = await List.create(
            [
                {
                    title: title.trim(),
                    position: finalPosition,
                    board: boardId,
                    createdBy: user,
                },
            ],
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        const created = arr[0];
        const populated = await List.findById(created._id).populate({
            path: "cards",
            options: { sort: { position: 1 } },
        });

        // LOG ACTIVITY
        await logActivity({
            user,
            workspace: workspace._id,
            board: boardId,
            action: "LIST_CREATED",
            targetType: "list",
            targetId: created._id,
            details: `List "${title}" created`,
        });

        await notifyBoardMembers({
            boardId,
            triggeredBy: user,
            message: `created a new list "${title}"`,
            metadata: { listId: created._id }
        });

        return res
            .status(201)
            .json(new ApiResponse(201, populated, "List created successfully"));
    } catch (err) {
        if (session.inTransaction()) await session.abortTransaction();
        session.endSession();
        throw err;
    }
});

/*
──────────────────────────────────────────────────────────
    GET LISTS BY BOARD
──────────────────────────────────────────────────────────
*/
const getListsByBoard = asyncHandler(async (req, res) => {
    const user = req.user?._id;
    if (!user) throw new ApiError(401, "Unauthorized");

    const { boardId } = req.params;
    validateObjectId(boardId, "boardId");

    const { board, workspace } = await getBoardAndWorkspace(boardId);

    if (!isBoardMember(board, user) && !isWorkspaceAdminOrOwner(workspace, user))
        throw new ApiError(403, "Not allowed to view lists");

    const lists = await List.find({ board: boardId })
        .populate({ path: "cards", model: "Card", options: { sort: { position: 1 } } })
        .sort({ position: 1 });

    return res
        .status(200)
        .json(new ApiResponse(200, lists, "Lists fetched successfully"));
});

/*
──────────────────────────────────────────────────────────
    GET LIST BY ID
──────────────────────────────────────────────────────────
*/
const getListById = asyncHandler(async (req, res) => {
    const user = req.user?._id;
    if (!user) throw new ApiError(401, "Unauthorized");

    const { listId } = req.params;
    validateObjectId(listId, "listId");

    const list = await List.findById(listId).populate({
        path: "cards",
        model: "Card",
        options: { sort: { position: 1 } },
    });

    if (!list) throw new ApiError(404, "List not found");

    const { board, workspace } = await getBoardAndWorkspace(list.board);

    if (!isBoardMember(board, user) && !isWorkspaceAdminOrOwner(workspace, user))
        throw new ApiError(403, "Not allowed");

    return res
        .status(200)
        .json(new ApiResponse(200, list, "List fetched successfully"));
});

/*
──────────────────────────────────────────────────────────
    UPDATE LIST (TITLE / POSITION)
──────────────────────────────────────────────────────────
*/
const updateList = asyncHandler(async (req, res) => {
    const user = req.user?._id;
    if (!user) throw new ApiError(401, "Unauthorized");

    const { listId } = req.params;
    const { title, position } = req.body;

    validateObjectId(listId, "listId");

    const list = await List.findById(listId);
    if (!list) throw new ApiError(404, "List not found");

    const { board, workspace } = await getBoardAndWorkspace(list.board);

    if (!isListCreatorOrAdmin(list, workspace, user))
        throw new ApiError(403, "Not allowed");

    const oldTitle = list.title;

    // UPDATE ONLY TITLE
    if (title !== undefined && position === undefined) {
        list.title = title.trim();
        await list.save();

        // LOG ACTIVITY
        await logActivity({
            user,
            workspace: workspace._id,
            board: board._id,
            action: "LIST_UPDATED",
            targetType: "list",
            targetId: list._id,
            details: `Title changed from "${oldTitle}" to "${title}"`,
        });

        await notifyBoardMembers({
            boardId: board._id,
            triggeredBy: user,
            message: `renamed list "${oldTitle}" → "${title}"`,
            metadata: { listId: list._id }
        });

        return res
            .status(200)
            .json(new ApiResponse(200, list, "List title updated successfully"));
    }

    // UPDATE POSITION
    if (position !== undefined) {
        const session = await mongoose.startSession();
        try {
            session.startTransaction();

            const all = await List.find({ board: board._id })
                .sort({ position: 1 })
                .session(session);

            const oldIndex = list.position;
            const newIndex = Math.min(position, all.length - 1);

            if (oldIndex !== newIndex) {
                all.splice(oldIndex, 1);
                all.splice(newIndex, 0, list);

                for (let i = 0; i < all.length; i++) {
                    if (all[i].position !== i)
                        await List.updateOne(
                            { _id: all[i]._id },
                            { position: i },
                            { session }
                        );
                }
            }

            if (title !== undefined) list.title = title.trim();
            await list.save({ session });

            await session.commitTransaction();
            session.endSession();

            const updated = await List.findById(list._id);

            // LOG ACTIVITY
            await logActivity({
                user,
                workspace: workspace._id,
                board: board._id,
                action: "LIST_REORDERED",
                targetType: "list",
                targetId: list._id,
                details: `Moved from ${oldIndex} to ${newIndex}`,
            });

            return res
                .status(200)
                .json(new ApiResponse(200, updated, "List updated successfully"));
        } catch (err) {
            if (session.inTransaction()) await session.abortTransaction();
            session.endSession();
            throw err;
        }
    }

    throw new ApiError(400, "Nothing to update");
});

/*
──────────────────────────────────────────────────────────
    DELETE LIST
──────────────────────────────────────────────────────────
*/
const deleteList = asyncHandler(async (req, res) => {
    const user = req.user?._id;
    if (!user) throw new ApiError(401, "Unauthorized");

    const { listId } = req.params;
    validateObjectId(listId, "listId");

    const list = await List.findById(listId);
    if (!list) throw new ApiError(404, "List not found");

    const { board, workspace } = await getBoardAndWorkspace(list.board);

    if (!isWorkspaceAdminOrOwner(workspace, user))
        throw new ApiError(403, "Only admin/owner can delete lists");

    const session = await mongoose.startSession();
    try {
        session.startTransaction();

        const removedPos = list.position;

        await Card.deleteMany({ list: listId }).session(session);
        await List.deleteOne({ _id: listId }).session(session);

        await List.updateMany(
            { board: board._id, position: { $gt: removedPos } },
            { $inc: { position: -1 } },
            { session }
        );

        await session.commitTransaction();
        session.endSession();

        // LOG ACTIVITY
        await logActivity({
            user,
            workspace: workspace._id,
            board: board._id,
            action: "LIST_DELETED",
            targetType: "list",
            targetId: listId,
            details: `Deleted list "${list.title}"`,
        });

        await notifyBoardMembers({
            boardId: board._id,
            triggeredBy: user,
            message: `deleted the list "${list.title}"`,
            metadata: { listId }
        });

        return res
            .status(200)
            .json(new ApiResponse(200, null, "List deleted successfully"));
    } catch (err) {
        if (session.inTransaction()) await session.abortTransaction();
        session.endSession();
        throw err;
    }
});

/*
──────────────────────────────────────────────────────────
    ARCHIVE / UNARCHIVE / ACTIVATE / DEACTIVATE
──────────────────────────────────────────────────────────
*/
const toggleListStatus = asyncHandler(async (req, res) => {
    const user = req.user?._id;
    if (!user) throw new ApiError(401, "Unauthorized");

    const { listId } = req.params;
    const { action } = req.body;

    validateObjectId(listId, "listId");

    const VALID = ["archive", "unarchive", "activate", "deactivate"];
    if (!VALID.includes(action))
        throw new ApiError(400, "Invalid action");

    const list = await List.findById(listId);
    if (!list) throw new ApiError(404, "List not found");

    const { board, workspace } = await getBoardAndWorkspace(list.board);

    if (!isListCreatorOrAdmin(list, workspace, user))
        throw new ApiError(403, "Not allowed");

    let update = {};
    let msg = "";

    switch (action) {
        case "archive":
            if (list.isArchived) throw new ApiError(400, "Already archived");
            update = { isArchived: true, isActive: false };
            msg = "List archived";
            break;

        case "unarchive":
            if (!list.isArchived) throw new ApiError(400, "Not archived");
            update = { isArchived: false, isActive: true };
            msg = "List unarchived";
            break;

        case "activate":
            if (list.isActive) throw new ApiError(400, "Already active");
            update = { isActive: true };
            msg = "List activated";
            break;

        case "deactivate":
            if (!list.isActive) throw new ApiError(400, "Already inactive");
            update = { isActive: false };
            msg = "List deactivated";
            break;
    }

    const updated = await List.findByIdAndUpdate(
        listId,
        { $set: update },
        { new: true }
    );

    // LOG ACTIVITY
    await logActivity({
        user,
        workspace: workspace._id,
        board: board._id,
        action: `list_${action}`,
        targetType: "list",
        targetId: listId,
        details: msg,
    });

    await notifyBoardMembers({
        boardId: board._id,
        triggeredBy: user,
        message: `${msg.toLowerCase()} (${list.title})`,
        metadata: { listId }
    });

    return res.status(200).json(new ApiResponse(200, updated, `${msg} successfully`));
});

/*
──────────────────────────────────────────────────────────
    MOVE LIST TO ANOTHER BOARD
──────────────────────────────────────────────────────────
*/
const moveListToAnotherBoard = asyncHandler(async (req, res) => {
    const user = req.user?._id;
    if (!user) throw new ApiError(401, "Unauthorized");

    const { listId } = req.params;
    const { targetBoardId } = req.body;

    validateObjectId(listId, "listId");
    validateObjectId(targetBoardId, "targetBoardId");

    const list = await List.findById(listId);
    if (!list) throw new ApiError(404, "List not found");

    const sourceBoard = await Board.findById(list.board);
    const targetBoard = await Board.findById(targetBoardId);

    if (!sourceBoard) throw new ApiError(404, "Source board not found");
    if (!targetBoard) throw new ApiError(404, "Target board not found");

    if (String(sourceBoard.workspace) !== String(targetBoard.workspace))
        throw new ApiError(400, "Different workspaces");

    const workspace = await Workspace.findById(sourceBoard.workspace);

    if (!isWorkspaceAdminOrOwner(workspace, user))
        throw new ApiError(403, "Only admin/owner can move lists");

    const targetLists = await List.find({ board: targetBoardId }).sort({
        position: 1,
    });
    const newPosition =
        targetLists.length === 0 ? 0 : targetLists[targetLists.length - 1].position + 1;

    const oldBoardId = list.board;

    list.board = targetBoardId;
    list.position = newPosition;
    await list.save();

    const remaining = await List.find({ board: oldBoardId }).sort({
        position: 1,
    });
    for (let i = 0; i < remaining.length; i++) {
        if (remaining[i].position !== i) {
            remaining[i].position = i;
            await remaining[i].save();
        }
    }

    // LOG ACTIVITY
    await logActivity({
        user,
        workspace: workspace._id,
        board: targetBoardId,
        action: "LIST_MOVED",
        targetType: "list",
        targetId: listId,
        details: `Moved from board ${oldBoardId} → ${targetBoardId}`,
    });

    /* Notify source board members */
    await notifyBoardMembers({
        boardId: oldBoardId,
        triggeredBy: user,
        message: `moved list "${list.title}" to another board`,
        metadata: { listId }
    });

    /* Notify target board members */
    await notifyBoardMembers({
        boardId: targetBoardId,
        triggeredBy: user,
        type: "LIST_MOVED",
        message: `received list "${list.title}" from another board`,
        metadata: { listId }
    });

    return res
        .status(200)
        .json(new ApiResponse(200, list, "List moved successfully"));
});

/*
──────────────────────────────────────────────────────────
    CLEAR LIST (DELETE ALL CARDS)
──────────────────────────────────────────────────────────
*/
const clearCard = asyncHandler(async (req, res) => {
    const user = req.user?._id;
    if (!user) throw new ApiError(401, "Unauthorized");

    const { listId } = req.params;
    validateObjectId(listId, "listId");

    const list = await List.findById(listId);
    if (!list) throw new ApiError(404, "List not found");

    const { board, workspace } = await getBoardAndWorkspace(list.board);

    if (!isListCreatorOrAdmin(list, workspace, user))
        throw new ApiError(403, "Not allowed");

    if (!list.cards?.length) {
        return res
            .status(200)
            .json(new ApiResponse(200, list, "List already empty"));
    }

    await Card.deleteMany({ _id: { $in: list.cards } });
    list.cards = [];
    await list.save();

    // LOG ACTIVITY
    await logActivity({
        user,
        workspace: workspace._id,
        board: board._id,
        action: "LIST_CLEARED",
        targetType: "list",
        targetId: listId,
        details: `All cards removed`,
    });

    await notifyBoardMembers({
        boardId: board._id,
        triggeredBy: user,
        message: `cleared all cards from list "${list.title}"`,
        metadata: { listId }
    });

    return res
        .status(200)
        .json(new ApiResponse(200, list, "All cards removed successfully"));
});

/*
──────────────────────────────────────────────────────────
    REORDER LISTS IN A BOARD (DRAG & DROP)
──────────────────────────────────────────────────────────
*/
const reOrderList = asyncHandler(async (req, res) => {
    const user = req.user?._id;
    if (!user) throw new ApiError(401, "Unauthorized");

    const { boardId } = req.params;
    const { startIndex, endIndex, listId } = req.body;

    validateObjectId(boardId, "boardId");
    validateObjectId(listId, "listId");

    if (startIndex === undefined || endIndex === undefined)
        throw new ApiError(400, "startIndex and endIndex required");

    const { board, workspace } = await getBoardAndWorkspace(boardId);

    if (!isBoardMember(board, user) && !isWorkspaceAdminOrOwner(workspace, user))
        throw new ApiError(403, "Not allowed");

    const lists = await List.find({ board: boardId }).sort({ position: 1 });
    if (!lists.length) throw new ApiError(400, "No lists");

    let order = lists.map((x) => String(x._id));

    if (!order.includes(String(listId)))
        throw new ApiError(404, "List not found in board");

    order.splice(startIndex, 1);
    order.splice(endIndex, 0, String(listId));

    const ops = order.map((id, i) => ({
        updateOne: { filter: { _id: id }, update: { position: i } },
    }));

    await List.bulkWrite(ops);

    const updated = await List.find({ board: boardId }).sort({
        position: 1,
    });

    // LOG ACTIVITY
    await logActivity({
        user,
        workspace: workspace._id,
        board: boardId,
        action: "LIST_REORDERED",
        targetType: "list",
        targetId: listId,
        details: `Moved from ${startIndex} → ${endIndex}`,
    });

    await notifyBoardMembers({
        boardId,
        triggeredBy: user,
        message: `reordered lists`,
        metadata: {}
    });

    return res
        .status(200)
        .json(new ApiResponse(200, updated, "Lists reordered successfully"));
});

/*
──────────────────────────────────────────────────────────
EXPORTS
──────────────────────────────────────────────────────────
*/
export {
    createList,
    getListsByBoard,
    getListById,
    updateList,
    deleteList,
    toggleListStatus,
    moveListToAnotherBoard,
    clearCard,
    reOrderList,
};