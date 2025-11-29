import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace",
        required: true
    },
    board: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Board",
        default: null
    },
    action: {
        type: String,
        required: true
    },
    targetType: {
        type: String,
        enum: ["workspace", "board", "list", "card", "user"],
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null
    },
    details: {
        type: String,
        default: ""
    }
}, { timestamps: true });

export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);