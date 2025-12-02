import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        // The user who receives the notification
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // Who triggered the notification (commented, updated card, assigned, etc.)
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },

        // The main notification text
        message: {
            type: String,
            required: true,
        },

        type: {
            type: String,
            enum: ["task", "message", "system"],
            default: "system",
        },

        // The action location (context)
        workspace: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Workspace",
        },

        board: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Board",
        },

        card: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Card",
        },

        // Used by frontend to redirect to board/card
        redirectUrl: {
            type: String,
        },

        read: {
            type: Boolean,
            default: false,
        },

        isDeleted: {
            type: Boolean,
            default: false,
        },
    },
    { timestamps: true }
);

export const Notification = mongoose.model("Notification", notificationSchema);