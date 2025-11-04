import mongoose from "mongoose"
import bcrypt from "bcrypt"

const userSchema = new mongoose.Schema({
        name: {
            type: String,
            required: true
        },
        email: {
            type: String,
            required: true,
            unique: true
        },
        password: {
            type: String,
            required: true,
            select: false
        },
        avatar: {
            type: String // URL to profile image
        },
        status: {
            type: String,
            enum: ["online", "offline", "away"],
            default: "offline"
        },
        lastSeen: {
            type: Date,
            default: Date.now
        }
    }, { timestamps: true })

userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) {
        return next();
    }
    try {
        this.password = await bcrypt.hash(this.password, 10);
        next();
    } catch (error) {
        next(error);
    }
})

export const User = mongoose.model("User", userSchema)