import mongoose from "mongoose";
import { Media } from "../models/media.model.js";
import { Card } from "../models/card.model.js";
import { Message } from "../models/message.model.js";
import { Workspace } from "../models/workspace.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { uploadOnCloudinary, deleteFromCloudinary } from "../utils/cloudinary.js";

// Validate any ObjectId(s)
const validateObjectIds = (ids = {}) => {
    for (const [key, value] of Object.entries(ids)) {
        if (!value || !mongoose.Types.ObjectId.isValid(String(value))) {
            throw new ApiError(400, `${key} is invalid`);
        }
    }
};

// Find Card + Workspace + check membership
const findCardAndCheckAccess = async (cardId, userId) => {
    validateObjectIds({ cardId });

    const card = await Card.findById(cardId)
        .populate("board", "workspace")
        .lean();

    if (!card) throw new ApiError(404, "Card not found");

    const workspace = await Workspace.findById(card.board.workspace).lean();
    if (!workspace || workspace.isDeleted)
        throw new ApiError(404, "Workspace not found");

    // user must be owner/admin/card-member
    const isOwner = String(workspace.owner) === String(userId);
    const isAdmin = workspace.members?.some(
        (m) => String(m.user) === String(userId) && m.role === "admin"
    );
    const isAssigned = card.assignedTo?.some(
        (u) => String(u) === String(userId)
    );
    const isCreator = String(card.createdBy) === String(userId);

    if (!isOwner && !isAdmin && !isAssigned && !isCreator)
        throw new ApiError(403, "You don't have permission to access this card");

    return { card, workspace };
};

// Check message ownership
const findMessageAndCheckAccess = async (messageId, userId) => {
    validateObjectIds({ messageId });

    const message = await Message.findById(messageId).lean();
    if (!message) throw new ApiError(404, "Message not found");

    if (String(message.sender) !== String(userId))
        throw new ApiError(403, "You cannot modify this message");

    return message;
};

// uploader OR admin can delete media
const verifyMediaDeleteAccess = (media, user) => {
    if (String(media.uploadedBy) === String(user._id)) return true;
    if (user.role === "admin") return true;

    throw new ApiError(403, "Not allowed to delete this media");
};

// Upload Media
const uploadMedia = asyncHandler(async (req, res) => {
    const user = req.user;
    const { attachedTo, attachedModel } = req.body;

    validateObjectIds({ attachedTo });

    if (!["Card", "Message"].includes(attachedModel)) {
        throw new ApiError(400, "attachedModel must be 'Card' or 'Message'");
    }

    if (!req.file) throw new ApiError(400, "No file uploaded");

    // Check access based on model type
    if (attachedModel === "Card") {
        await findCardAndCheckAccess(attachedTo, user._id);
    } else if (attachedModel === "Message") {
        await findMessageAndCheckAccess(attachedTo, user._id);
    }

    const result = await uploadOnCloudinary(req.file.path);

    const type = req.file.mimetype.startsWith("image")
        ? "image"
        : req.file.mimetype.startsWith("video")
            ? "video"
            : "file";

    const media = await Media.create({
        url: result.secure_url,
        publicId: result.public_id,
        type,
        filename: req.file.originalname,
        size: req.file.size,
        uploadedBy: user._id,
        attachedTo,
        attachedModel
    });

    return res
        .status(201)
        .json(new ApiResponse(201, media, "Media uploaded successfully"));
});

// Get Media by Parent_ID
const getMediaByParent = asyncHandler(async (req, res) => {
    const { parentId, model } = req.params;

    validateObjectIds({ parentId });

    if (!["Card", "Message"].includes(model))
        throw new ApiError(400, "Invalid model type");

    const files = await Media.find({
        attachedTo: parentId,
        attachedModel: model
    }).sort({ createdAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, files, "Media fetched"));
});

// Delete Media
const deleteMedia = asyncHandler(async (req, res) => {
    const { mediaId } = req.params;
    validateObjectIds({ mediaId });

    const media = await Media.findById(mediaId);
    if (!media) throw new ApiError(404, "Media not found");

    verifyMediaDeleteAccess(media, req.user);

    await deleteFromCloudinary(media.publicId);
    await media.deleteOne();

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Media deleted successfully"));
});

// Get Media by ID
const getMediaById = asyncHandler(async (req, res) => {
    const { mediaId } = req.params;

    validateObjectIds({ mediaId });

    const media = await Media.findById(mediaId);
    if (!media) throw new ApiError(404, "Media not found");

    return res
        .status(200)
        .json(new ApiResponse(200, media, "Media fetched"));
});

// Get Media by User
const getMediaByUser = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    validateObjectIds({ userId });

    const files = await Media.find({ uploadedBy: userId })
        .sort({ createdAt: -1 });

    return res
        .status(200)
        .json(new ApiResponse(200, files, "User media fetched"));
});

export {
    uploadMedia,
    getMediaById,
    getMediaByParent,
    deleteMedia,
    getMediaByUser
};