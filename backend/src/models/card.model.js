import mongoose from 'mongoose';

const cardSchema = new mongoose.Schema({
    title: { 
        type: String, 
        required: true 
    },
    description: {
        type : String
    },
    assignedTo: [
        { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "User" 
        }
    ],
    status: { 
        type: String, 
        enum: ["todo", "in-progress", "done"], 
        default: "todo" 
    },
    labels: [
        {
            type : String
        }
    ],
    dueDate: Date,
    attachments: [
        { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "Media" 
        }
    ],
    comments: [
        { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: "Message" 
        }
    ]
}, { timestamps: true });

export const Card = mongoose.model("Card", cardSchema);