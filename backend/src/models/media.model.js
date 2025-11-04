import mongoose from 'mongoose';

const mediaSchema = new mongoose.Schema({
    url: { 
        type: String, 
        required: true 
    },
    type: { 
        type: String, 
        enum: ["image", "video", "file"], 
        required: true 
    },
    uploadedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "User" 
    },
    size: {
        type : Number
    }
}, { timestamps: true });

export const Media = mongoose.model("Media", mediaSchema);
