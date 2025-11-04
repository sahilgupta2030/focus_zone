import mongoose from 'mongoose';

const workspaceSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: true 
    },
    description: {
        type : String
    },
    members: [
        {
            user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
            role: { type: String, enum: ["admin", "member", "viewer"], default: "member" }
        }
    ]
}, { timestamps: true });

export const Workspace = mongoose.model("Workspace", workspaceSchema);