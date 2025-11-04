import mongoose from 'mongoose';

const presenceSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
    },
    workspace: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Workspace" 
    },
    isOnline: { 
        type: Boolean, 
        default: false 
    },
    lastActive: { 
        type: Date, 
        default: Date.now 
    }
}, { timestamps: true });

export const Presence = mongoose.model("Presence", presenceSchema);