import mongoose from "mongoose";

const presenceSchema = new mongoose.Schema(
    {
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        workspace: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Workspace",
            required: true,
        },
        isOnline: {
            type: Boolean,
            default: false,
        },
        lastActive: {
            type: Date,
            default: Date.now,
        },
        browserInfo: {
            ip: { type: String },
            userAgent: { type: String },
            device: { type: String },
        },
    },
    { timestamps: true }
);

// Ensure only ONE presence record per user per workspace
presenceSchema.index({ user: 1, workspace: 1 }, { unique: true });

export const Presence = mongoose.model("Presence", presenceSchema);