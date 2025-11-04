import mongoose from 'mongoose';

const activityLogSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
    },
    workspace: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Workspace" 
    },
    board: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Board" 
    },
    action: { // e.g. "moved task", "uploaded file"
        type: String, 
        required: true 
    }, 
    targetType: { 
        type: String, 
        enum: ["task", "list", "board", "message"], 
        required: true 
    },
    targetId: { 
        type: mongoose.Schema.Types.ObjectId 
    },
    details: { // extra info (old/new list, filenames, etc.)
        type: String  
    }
}, { timestamps: true });

export const ActivityLog = mongoose.model("ActivityLog", activityLogSchema);