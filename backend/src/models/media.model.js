import mongoose from "mongoose";

const mediaSchema = new mongoose.Schema({
    url: {
        type: String,
        required: true
    },
    publicId: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ["image", "video", "file"],
        required: true
    },
    filename: {
        type: String
    },
    size: {
        type: Number
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    attachedTo: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "attachedModel",
        required: true
    },
    attachedModel: {
        type: String,
        enum: ["Card", "Message"],
        required: true
    }
}, { timestamps: true });

export const Media = mongoose.model("Media", mediaSchema);