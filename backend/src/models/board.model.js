import mongoose from 'mongoose';

const boardSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    workspace: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Workspace",
        required: true
    },
    columns: [
        {
            name: {
                type: String,
                required: true
            },
            tasks: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: "Task"
            }],
        },
    ],
    members: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],
}, { timestamps: true });

export const Board = mongoose.model("Board", boardSchema);