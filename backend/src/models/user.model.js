import mongoose from "mongoose";
import bcrypt from "bcrypt";

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, "Name is required"],
            trim: true,
        },
        email: {
            type: String,
            required: [true, "Email is required"],
            unique: true,
            lowercase: true,
            trim: true,
        },
        password: {
            type: String,
            required: [true, "Password is required"],
            minlength: [6, "Password must be at least 6 characters long"],
            select: false, // Hide password in queries by default
        },
        avatar: {
            type: String, // URL to profile image
            default: "", // Optional default empty string
        },
        status: {
            type: String,
            enum: ["online", "offline", "away"],
            default: "offline",
        },
        lastSeen: {
            type: Date,
            default: Date.now,
        },
        role: {
            type: String,
            enum: ["owner", "admin", "member", "viewer"],
            default: "member"
        }

    },
    { timestamps: true }
);

// Hash password before saving
userSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Add password comparison method for login
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Optional: Auto-update lastSeen when status changes
userSchema.pre("save", function (next) {
    if (this.isModified("status") && this.status === "offline") {
        this.lastSeen = new Date();
    }
    next();
});

export const User = mongoose.model("User", userSchema);