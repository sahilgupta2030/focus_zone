import mongoose from "mongoose";

const checklistItemSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
        trim: true
    },
    completed: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Auto-update checklist item's updatedAt
checklistItemSchema.pre("save", function (next) {
    this.updatedAt = Date.now();
    next();
});

const cardSchema = new mongoose.Schema({

    title: {
        type: String,
        required: true,
        trim: true
    },

    description: {
        type: String,
        default: ""
    },

    board: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Board",
        required: true
    },

    list: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "List",
        required: true
    },

    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    assignedTo: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        }
    ],

    labels: [
        {
            type: String,
            trim: true
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
    ],

    status: {
        type: String,
        enum: ["todo", "in-progress", "done"],
        default: "todo"
    },

    position: {
        type: Number,
        default: 0
    },

    isArchived: {
        type: Boolean,
        default: false
    },

    activity: [
        {
            message: String,
            createdAt: { type: Date, default: Date.now }
        }
    ],

    checklist: [checklistItemSchema]

}, { timestamps: true });

// Needed for fast reordering
cardSchema.index({ list: 1, position: 1 });

export const Card = mongoose.model("Card", cardSchema);