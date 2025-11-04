import mongoose from 'mongoose';

const listSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true 
    },
    position: { 
        type: Number, 
        default: 0 
    },
    board: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: "Board", 
        required: true 
    },
    tasks: [
        { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "Task" 
        }
    ]
}, { timestamps: true });

export const List = mongoose.model("List", listSchema)