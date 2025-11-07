import mongoose from "mongoose";

const workspaceSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    members: [
        {
            user: {
                type: mongoose.Schema.Types.ObjectId, ref: "User"
            },
            role: {
                type: String,
                enum: ["owner", "admin", "member", "viewer"],
                default: "member"
            }
        }
    ],
    tags: [{
        type: String,
        trim: true
    }],
    isDeleted: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

// Text index for searching
workspaceSchema.index({ name: "text", description: "text" });

export const Workspace = mongoose.model("Workspace", workspaceSchema);