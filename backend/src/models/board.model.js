import mongoose from 'mongoose';

const boardSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true 
    },
    workspace: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Workspace" 
    },
    columns: [
    {
        name: String,
        tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: "Task" }],
    },
    ]
}, { timestamps: true });

export const Board = mongoose.model("Board", boardSchema);