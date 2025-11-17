import mongoose from "mongoose";
import { Card } from "../models/card.model.js";
import { List } from "../models/list.model.js";
import { Board } from "../models/board.model.js";
import { Workspace } from "../models/workspace.model.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/*
Helper functions (exact positions in file):
    - validateObjectIds
    - getBoardAndWorkspace
    - getUserWorkspaceRole
    - isBoardMember
    - isWorkspaceAdminOrOwner
    - isListCreatorOrAdmin
    - isCardCreatorOrAdmin
    - checkBoardAccess
    - findCardById
    - validateListBelongsToBoard
*/

const validateObjectIds = (ids = {}) => {
    for (const [key, value] of Object.entries(ids)) {
        if (!value || !mongoose.Types.ObjectId.isValid(String(value))) {
            throw new ApiError(400, `${key} is invalid`);
        }
    }
};

const getBoardAndWorkspace = async (boardId) => {
    validateObjectIds({ boardId });
    const board = await Board.findById(boardId).lean();
    if (!board) throw new ApiError(404, "Board not found");

    validateObjectIds({ workspaceId: board.workspace });
    const workspace = await Workspace.findById(board.workspace).lean();
    if (!workspace || workspace.isDeleted) throw new ApiError(404, "Workspace not found or deleted");

    // Sanity check
    if (String(board.workspace) !== String(workspace._id)) {
        throw new ApiError(400, "Board does not belong to this workspace");
    }

    return { board, workspace };
};

// Returns role string from workspace.members or 'owner' if owner.
const getUserWorkspaceRole = (workspace, userId) => {
    if (!workspace || !userId) return null;
    if (String(workspace.owner) === String(userId)) return "owner";
    if (!Array.isArray(workspace.members)) return null;
    const member = workspace.members.find((m) => String(m.user) === String(userId));
    return member ? member.role : null;
};

const isBoardMember = (board, userId) => {
    if (!board) return false;
    return Array.isArray(board.members) && board.members.some((m) => String(m) === String(userId));
};

const isWorkspaceAdminOrOwner = (workspace, userId) => {
    const role = getUserWorkspaceRole(workspace, userId);
    return role === "owner" || role === "admin";
};

// const isListCreatorOrAdmin = (listDoc, workspace, userId) => {
//     if (!listDoc) return false;
//     if (String(listDoc.createdBy) === String(userId)) return true;
//     return isWorkspaceAdminOrOwner(workspace, userId);
// };

const isCardCreatorOrAdmin = (cardDoc, workspace, userId) => {
    if (!cardDoc) return false;
    if (String(cardDoc.createdBy) === String(userId)) return true;
    return isWorkspaceAdminOrOwner(workspace, userId);
};

const checkBoardAccess = (board, workspace, userId) => {
    if (isBoardMember(board, userId)) return true;
    if (isWorkspaceAdminOrOwner(workspace, userId)) return true;
    throw new ApiError(403, "You don't have permission to access this board");
};

const findCardById = async (cardId) => {
    validateObjectIds({ cardId });
    const card = await Card.findById(cardId)
        .populate("createdBy", "name _id avatar")
        .populate("assignedTo", "name _id avatar")
    if (!card) throw new ApiError(404, "Card not found");
    return card;
};

const validateListBelongsToBoard = (list, boardId) => {
    if (!list) throw new ApiError(404, "List not found");
    if (String(list.board) !== String(boardId)) {
        throw new ApiError(400, "List does not belong to the specified board");
    }
};

/* ------------------------
    Controller implementations
   ------------------------ */

// Create card
const createCard = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { title, description = "", board: boardId, list: listId, dueDate, labels = [] } = req.body;

    if (!title) throw new ApiError(400, "Title is required");
    validateObjectIds({ boardId, listId });

    // fetch board and workspace
    const { board, workspace } = await getBoardAndWorkspace(boardId);

    // check board access
    checkBoardAccess(board, workspace, userId);

    // load list and validate it belongs to board
    const listDoc = await List.findById(listId);
    if (!listDoc) throw new ApiError(404, "List not found");
    validateListBelongsToBoard(listDoc, boardId);

    // compute position = max(position)+1 for this list
    const maxPosDoc = await Card.findOne({ list: listId }).sort("-position").select("position").lean();
    const position = maxPosDoc ? maxPosDoc.position + 1 : 0;

    const newCard = await Card.create({
        title,
        description,
        board: boardId,
        list: listId,
        createdBy: userId,
        assignedTo: [],
        labels,
        dueDate: dueDate || null,
        position
    });

    // push card id into list.cards (best-effort)
    await List.findByIdAndUpdate(listId, { $push: { cards: newCard._id } });

    return res.status(201).json(new ApiResponse(201, newCard, "Card created successfully"));
});

// Get card by ID
const getCardById = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    validateObjectIds({ cardId });

    const card = await findCardById(cardId);

    // verify access: fetch board/workspace
    const { board, workspace } = await getBoardAndWorkspace(card.board);
    checkBoardAccess(board, workspace, userId);

    return res.status(200).json(new ApiResponse(200, card, "Card fetched"));
});

// Get all cards in a list
const getCardsByList = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { listId } = req.params;
    validateObjectIds({ listId });

    const listDoc = await List.findById(listId).lean();
    if (!listDoc) throw new ApiError(404, "List not found");

    // get board/workspace and check access
    const { board, workspace } = await getBoardAndWorkspace(listDoc.board);
    checkBoardAccess(board, workspace, userId);

    const cards = await Card.find({ list: listId, isArchived: false }).sort("position").lean();
    return res.status(200).json(new ApiResponse(200, cards, "Cards fetched for list"));
});

// Get all cards in a board
const getCardsByBoard = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { boardId } = req.params;
    validateObjectIds({ boardId });

    const { board, workspace } = await getBoardAndWorkspace(boardId);
    checkBoardAccess(board, workspace, userId);

    const cards = await Card.find({ board: boardId, isArchived: false }).sort({ list: 1, position: 1 }).lean();
    return res.status(200).json(new ApiResponse(200, cards, "Cards fetched for board"));
});

// Update card general information
const updateCard = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    const updates = (({ title, description, dueDate, labels, status }) => ({ title, description, dueDate, labels, status }))(req.body);

    validateObjectIds({ cardId });
    const card = await findCardById(cardId);

    const { board, workspace } = await getBoardAndWorkspace(card.board);
    // only creator or workspace admin/owner can edit core fields
    if (!isCardCreatorOrAdmin(card, workspace, userId)) {
        throw new ApiError(403, "Only card creator or workspace admin/owner can update this card");
    }

    Object.keys(updates).forEach((k) => {
        if (updates[k] !== undefined) card[k] = updates[k];
    });

    await card.save();
    return res.status(200).json(new ApiResponse(200, card, "Card updated"));
});

// Delete card permanently
const deleteCard = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    validateObjectIds({ cardId });
    const card = await findCardById(cardId);

    const { board, workspace } = await getBoardAndWorkspace(card.board);
    if (!isCardCreatorOrAdmin(card, workspace, userId)) {
        throw new ApiError(403, "Only card creator or workspace admin/owner can delete this card");
    }

    // remove from list.cards array
    await List.findByIdAndUpdate(card.list, { $pull: { cards: card._id } });

    await card.deleteOne();
    return res.status(200).json(new ApiResponse(200, {}, "Card deleted permanently"));
});

// Archive card
const archiveCard = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    validateObjectIds({ cardId });
    const card = await findCardById(cardId);

    const { board, workspace } = await getBoardAndWorkspace(card.board);
    if (!isCardCreatorOrAdmin(card, workspace, userId)) {
        throw new ApiError(403, "Only card creator or workspace admin/owner can archive this card");
    }

    card.isArchived = true;
    await card.save();
    return res.status(200).json(new ApiResponse(200, card, "Card archived"));
});

// Restore archived card
const restoreCard = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    validateObjectIds({ cardId });
    const card = await findCardById(cardId);

    const { board, workspace } = await getBoardAndWorkspace(card.board);
    if (!isCardCreatorOrAdmin(card, workspace, userId)) {
        throw new ApiError(403, "Only card creator or workspace admin/owner can restore this card");
    }

    card.isArchived = false;
    await card.save();
    return res.status(200).json(new ApiResponse(200, card, "Card restored"));
});

// Move card inside same list (reorder)
const moveCardWithinList = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    const { newPosition } = req.body;
    validateObjectIds({ cardId });
    if (typeof newPosition !== "number") throw new ApiError(400, "newPosition must be a number");

    const card = await findCardById(cardId);
    const { board, workspace } = await getBoardAndWorkspace(card.board);
    checkBoardAccess(board, workspace, userId);

    // reordering logic (simple): shift positions
    if (card.position === newPosition) return res.status(200).json(new ApiResponse(200, card, "Card position unchanged"));

    // shift other cards in same list
    if (newPosition > card.position) {
        await Card.updateMany(
            { list: card.list, position: { $gt: card.position, $lte: newPosition } },
            { $inc: { position: -1 } }
        );
    } else {
        await Card.updateMany(
            { list: card.list, position: { $gte: newPosition, $lt: card.position } },
            { $inc: { position: 1 } }
        );
    }

    card.position = newPosition;
    await card.save();
    return res.status(200).json(new ApiResponse(200, card, "Card moved within list"));
});

// Move card to another list (must be same board)
const moveCardToAnotherList = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    const { targetListId, targetPosition } = req.body;
    validateObjectIds({ cardId, targetListId });

    const card = await findCardById(cardId);
    const oldListId = card.list;
    const { board, workspace } = await getBoardAndWorkspace(card.board);
    checkBoardAccess(board, workspace, userId);

    const targetList = await List.findById(targetListId);
    if (!targetList) throw new ApiError(404, "Target list not found");
    validateListBelongsToBoard(targetList, board._id);

    // remove card from old list.cards and shift positions
    await List.findByIdAndUpdate(oldListId, { $pull: { cards: card._id } });
    await Card.updateMany({ list: oldListId, position: { $gt: card.position } }, { $inc: { position: -1 } });

    // compute target position
    const maxPosDoc = await Card.findOne({ list: targetListId }).sort("-position").select("position").lean();
    const newPos = (typeof targetPosition === "number") ? targetPosition : (maxPosDoc ? maxPosDoc.position + 1 : 0);

    // shift cards in target list to make space
    await Card.updateMany({ list: targetListId, position: { $gte: newPos } }, { $inc: { position: 1 } });

    // update card
    card.list = targetListId;
    card.position = newPos;
    await card.save();

    // push into targetList.cards
    await List.findByIdAndUpdate(targetListId, { $push: { cards: card._id } });

    return res.status(200).json(new ApiResponse(200, card, "Card moved to another list"));
});

// Assign user to card
const assignCard = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    const { assigneeId } = req.body;
    validateObjectIds({ cardId, assigneeId });

    const card = await findCardById(cardId);
    const { board, workspace } = await getBoardAndWorkspace(card.board);
    // Only board members or workspace admin/owner can assign
    checkBoardAccess(board, workspace, userId);

    // ensure assignee is board member or workspace admin/owner
    if (!isBoardMember(board, assigneeId) && !isWorkspaceAdminOrOwner(workspace, assigneeId)) {
        throw new ApiError(400, "Assignee must be a member of the board/workspace");
    }

    if (!card.assignedTo.some((id) => String(id) === String(assigneeId))) {
        card.assignedTo.push(assigneeId);
        await card.save();
    }
    return res.status(200).json(new ApiResponse(200, card, "User assigned to card"));
});

// Unassign user
const unassignCard = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    const { assigneeId } = req.body;

    validateObjectIds({ cardId, assigneeId });

    const card = await findCardById(cardId);

    const { board, workspace } = await getBoardAndWorkspace(card.board);
    checkBoardAccess(board, workspace, userId);

    card.assignedTo = card.assignedTo.filter(
        (user) => String(user._id) !== String(assigneeId)
    );

    await card.save();

    return res.status(200).json(
        new ApiResponse(200, card, "User unassigned from card")
    );
});

// Update card status
const updateCardStatus = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    const { status } = req.body;
    if (!["todo", "in-progress", "done"].includes(status)) throw new ApiError(400, "Invalid status");

    validateObjectIds({ cardId });
    const card = await findCardById(cardId);
    const { board, workspace } = await getBoardAndWorkspace(card.board);
    // allow any board member to update status
    checkBoardAccess(board, workspace, userId);

    card.status = status;
    await card.save();
    return res.status(200).json(new ApiResponse(200, card, "Card status updated"));
});

// Update card labels (replace full labels array)
const updateCardLabels = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    const { labels } = req.body;
    if (!Array.isArray(labels)) throw new ApiError(400, "labels must be an array");

    validateObjectIds({ cardId });
    const card = await findCardById(cardId);
    const { board, workspace } = await getBoardAndWorkspace(card.board);
    checkBoardAccess(board, workspace, userId);

    card.labels = labels;
    await card.save();
    return res.status(200).json(new ApiResponse(200, card, "Card labels updated"));
});

// Add attachment (assumes req.file uploaded and Media created separately; here we accept a mediaId)
const addAttachment = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    const { mediaId } = req.body;
    validateObjectIds({ cardId, mediaId });

    const card = await findCardById(cardId);
    const { board, workspace } = await getBoardAndWorkspace(card.board);
    checkBoardAccess(board, workspace, userId);

    if (!card.attachments.some((id) => String(id) === String(mediaId))) {
        card.attachments.push(mediaId);
        await card.save();
    }
    return res.status(200).json(new ApiResponse(200, card, "Attachment added to card"));
});

// Remove attachment
const removeAttachment = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    const { mediaId } = req.body;
    validateObjectIds({ cardId, mediaId });

    const card = await findCardById(cardId);
    const { board, workspace } = await getBoardAndWorkspace(card.board);
    checkBoardAccess(board, workspace, userId);

    card.attachments = card.attachments.filter((id) => String(id) !== String(mediaId));
    await card.save();
    return res.status(200).json(new ApiResponse(200, card, "Attachment removed"));
});

// Add comment (assumes Message creation elsewhere returns messageId)
const addComment = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    const { messageId } = req.body;
    validateObjectIds({ cardId, messageId });

    const card = await findCardById(cardId);
    const { board, workspace } = await getBoardAndWorkspace(card.board);
    checkBoardAccess(board, workspace, userId);

    card.comments.push(messageId);
    await card.save();
    return res.status(201).json(new ApiResponse(201, card, "Comment added"));
});

// Delete comment
const deleteComment = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    const { messageId } = req.body;
    validateObjectIds({ cardId, messageId });

    const card = await findCardById(cardId);
    const { board, workspace } = await getBoardAndWorkspace(card.board);
    // only comment author or admin can delete comment - we don't have message author here,
    // so assume the message deletion endpoint will enforce author check. Here we only remove ref.
    checkBoardAccess(board, workspace, userId);

    card.comments = card.comments.filter((id) => String(id) !== String(messageId));
    await card.save();
    return res.status(200).json(new ApiResponse(200, card, "Comment removed"));
});

// Add checklist item
const addChecklistItem = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    const { text } = req.body;
    if (!text) throw new ApiError(400, "Checklist text is required");
    validateObjectIds({ cardId });

    const card = await findCardById(cardId);
    const { board, workspace } = await getBoardAndWorkspace(card.board);
    checkBoardAccess(board, workspace, userId);

    card.checklist.push({ text, completed: false });
    await card.save();
    return res.status(201).json(new ApiResponse(201, card, "Checklist item added"));
});

// Toggle checklist item (complete/incomplete)
const toggleChecklistItem = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    const { checklistItemId } = req.body;
    validateObjectIds({ cardId, checklistItemId });

    const card = await findCardById(cardId);
    const { board, workspace } = await getBoardAndWorkspace(card.board);
    checkBoardAccess(board, workspace, userId);

    const item = card.checklist.id(checklistItemId);
    if (!item) throw new ApiError(404, "Checklist item not found");
    item.completed = !item.completed;
    item.updatedAt = Date.now();
    await card.save();
    return res.status(200).json(new ApiResponse(200, card, "Checklist item toggled"));
});

// Delete checklist item
const deleteChecklistItem = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { cardId } = req.params;
    const { checklistItemId } = req.body;
    validateObjectIds({ cardId, checklistItemId });

    const card = await findCardById(cardId);
    const { board, workspace } = await getBoardAndWorkspace(card.board);
    checkBoardAccess(board, workspace, userId);

    card.checklist = card.checklist.filter(
        (item) => String(item._id) !== String(checklistItemId)
    );

    await card.save();
    return res.status(200).json(new ApiResponse(200, card, "Checklist item deleted"));
});


// Search cards by title, label, or assigned user
const searchCards = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    // Extract query params
    const {
        boardId,
        q: searchQuery,
        label,
        assignedTo
    } = req.query;

    // If boardId provided, validate and check access
    if (boardId) {
        validateObjectIds({ boardId });

        const { board, workspace } = await getBoardAndWorkspace(boardId);
        checkBoardAccess(board, workspace, userId);
    }

    // Build filter
    const filter = {
        isArchived: false,
        ...(boardId && { board: boardId }),
        ...(searchQuery && { title: { $regex: searchQuery, $options: "i" } }),
        ...(label && { labels: label })
    };

    if (assignedTo) {
        validateObjectIds({ assignedTo });
        filter.assignedTo = assignedTo;
    }

    // Fetch results
    const results = await Card.find(filter)
        .sort({ list: 1, position: 1 })
        .lean();

    return res
        .status(200)
        .json(new ApiResponse(200, results, "Search results"));
});


export {
    createCard,
    getCardById,
    getCardsByList,
    getCardsByBoard,
    updateCard,
    deleteCard,
    archiveCard,
    restoreCard,
    moveCardWithinList,
    moveCardToAnotherList,
    assignCard,
    unassignCard,
    updateCardStatus,
    updateCardLabels,
    addAttachment,
    removeAttachment,
    addComment,
    deleteComment,
    addChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem,
    searchCards,
};