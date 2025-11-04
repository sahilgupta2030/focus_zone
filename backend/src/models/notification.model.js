import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    user: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
    },
    message: {
        type : String
    },
    type: { 
        type: String, 
        enum: ["task", "message", "system"], 
        default: "system" 
    },
    read: { 
        type: Boolean, 
        default: false 
    }
}, { timestamps: true });

export const Notification = mongoose.model("Notification", notificationSchema);