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
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    cards: [
        { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "Card" 
        }
    ]
}, { timestamps: true });

export const List = mongoose.model("List", listSchema)