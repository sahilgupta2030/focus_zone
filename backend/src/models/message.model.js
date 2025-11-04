import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
    sender: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
    },
    workspace: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Workspace" 
    },
    content: { 
        type: String 
    },
    media: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Media" 
    },
    type: { 
        type: String, 
        enum: ["text", "image", "file"], 
        default: "text" 
    }
}, { timestamps: true });

export const Message = mongoose.model("Message", messageSchema);