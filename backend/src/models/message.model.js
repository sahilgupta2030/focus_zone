import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
    {
        url: { type: String, required: true },
        fileType: { type: String, trim: true },   // image/png, application/pdf etc.
        fileName: { type: String, trim: true },
        fileSize: { type: Number },               // bytes
    },
    { _id: false }
);

const messageSchema = new mongoose.Schema(
    {
        // User who sent the message
        sender: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        workspace: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Workspace",
            required: true,
        },

        channel: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Card",
            required: true,
        },

        // Plain text content
        text: {
            type: String,
            trim: true,
            default: "",
        },

        // Message attachments (images, files)
        attachments: {
            type: [attachmentSchema],
            default: [],
        },

        // Thread replies
        parentMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Message",
            default: null,
        },

        // Track users who have read the message
        readBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User",
            }
        ],

        // Audit fields
        edited: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

export const Message = mongoose.model("Message", messageSchema);