import dotenv from "dotenv";
dotenv.config();
// import fs from "fs";
import { User } from "../models/user.model.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// ===============================================================
// 🔑 Helper - Generate JWT Token
// ===============================================================
const JWT_SECRET = process.env.JWT_SECRET;
const generateToken = (userId) => {
    if (!JWT_SECRET) {
        throw new Error("JWT_SECRET not configured in environment variables");
    }
    return jwt.sign({ id: userId }, JWT_SECRET || process.env.JWT_SECRET, { expiresIn: "6d" });
};

// ===============================================================
// 👤 Register a new user
// ===============================================================
const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;

    // Validate input
    if (!name?.trim() || !email?.trim() || !password?.trim()) {
        throw new ApiError(400, "All fields (name, email, password) are required");
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
        throw new ApiError(409, "User already exists with this email");
    }

    // Check if this is the first user
    const isFirstUser = (await User.countDocuments()) === 0;

    // Upload avatar if provided
    let avatarUrl = "";
    if (req.file?.path) {
        const uploadResult = await uploadOnCloudinary(req.file.path);
        avatarUrl = uploadResult?.url || "";
    }

    // Create new user
    const newUser = await User.create({
        name: name.trim(),
        email: email.trim(),
        password,
        avatar: avatarUrl,
        role: isFirstUser ? "owner" : "member", // owner for first user
    });

    // Generate token
    const token = generateToken(newUser._id);

    // Prepare response data
    const userData = {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        avatar: newUser.avatar,
        role: newUser.role,
    };

    return res
        .status(201)
        .json(new ApiResponse(201, { user: userData, token }, "User registered successfully"));
});

// ===============================================================
// 🔐 Login user
// ===============================================================
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    // Validate input
    if (!email?.trim() || !password?.trim()) {
        throw new ApiError(400, "Email and password are required");
    }

    // Find user
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    // Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
        throw new ApiError(401, "Invalid credentials");
    }

    // Generate token
    const token = generateToken(user._id);

    const userData = {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        role: user.role,
    };

    return res
        .status(200)
        .json(new ApiResponse(200, { user: userData, token }, "Login successful"));
});

// ===============================================================
// 🚪 Logout user
// ===============================================================
const logoutUser = asyncHandler(async (req, res) => {
    res.clearCookie("token");
    return res.status(200).json(new ApiResponse(200, {}, "Logged out successfully"));
});

// ===============================================================
// 📄 Get logged-in user profile
// ===============================================================
const getUserProfile = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    if (!userId) {
        throw new ApiError(401, "Unauthorized: User not authenticated");
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "User profile fetched successfully"));
});

// ===============================================================
// ✏️ Update user profile
// ===============================================================
const updateUserProfile = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { name, email } = req.body;

    if (!userId) {
        throw new ApiError(401, "Unauthorized: User not authenticated");
    }

    const updateData = {};
    if (name?.trim()) updateData.name = name.trim();
    if (email?.trim()) updateData.email = email.trim();

    // Upload avatar if provided
    if (req.file?.path) {
        const uploaded = await uploadOnCloudinary(req.file.path);
        if (uploaded?.url) updateData.avatar = uploaded.url;
    }

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateData },
        { new: true, runValidators: true }
    ).select("-password");

    if (!updatedUser) {
        throw new ApiError(404, "User not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, { user: updatedUser }, "Profile updated successfully"));
});

// ===============================================================
// 👥 Get all users (admin / owner only)
// ===============================================================
const getAllUsers = asyncHandler(async (req, res) => {
    const role = req.user?.role;

    if (role !== "admin" && role !== "owner") {
        throw new ApiError(403, "Access denied: Admins or Owners only");
    }

    const users = await User.find().select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, users, "All users fetched successfully"));
});

// ===============================================================
// 🔍 Get user by ID
// ===============================================================
const getUserById = asyncHandler(async (req, res) => {
    const userId = req.params.id;

    if (!userId) {
        throw new ApiError(400, "User ID is required");
    }

    const user = await User.findById(userId).select("-password");
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "User fetched successfully"));
});

// ===============================================================
// ❌ Delete user (admin / owner only)
// ===============================================================
const deleteUser = asyncHandler(async (req, res) => {
    const role = req.user?.role;

    if (role !== "admin" && role !== "owner") {
        throw new ApiError(403, "Access denied: Admins or Owners only");
    }

    const targetUserId = req.params.id;
    if (!targetUserId) {
        throw new ApiError(400, "User ID is required");
    }

    const user = await User.findByIdAndDelete(targetUserId);
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    return res.status(200).json(new ApiResponse(200, {}, "User deleted successfully"));
});

// ===============================================================
// 🔒 Change user password
// ===============================================================
const changePassword = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { oldPassword, newPassword } = req.body;

    if (!userId) {
        throw new ApiError(401, "Unauthorized: User not authenticated");
    }

    if (!oldPassword?.trim() || !newPassword?.trim()) {
        throw new ApiError(400, "Old and new passwords are required");
    }

    const user = await User.findById(userId).select("+password");
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
        throw new ApiError(401, "Old password is incorrect");
    }

    user.password = newPassword; // bcrypt pre-save hook will hash it
    await user.save();

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"));
});

// ===============================================================
// 🖼️ Upload or update avatar
// ===============================================================
const uploadAvatar = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    if (!userId) {
        throw new ApiError(401, "Unauthorized: User not authenticated");
    }

    if (!req.file?.path) {
        throw new ApiError(400, "No file uploaded");
    }

    // // Debug logs
    // console.log("File exists:", fs.existsSync(req.file.path));
    // console.log("File path:", req.file.path);

    const uploaded = await uploadOnCloudinary(req.file.path);
    if (!uploaded?.url) {
        throw new ApiError(500, "Avatar upload failed");
    }

    const updatedUser = await User.findByIdAndUpdate(
        userId,
        { avatar: uploaded.url },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, { user: updatedUser }, "Avatar updated successfully"));
});

// ===============================================================
// 🧩 Exports
// ===============================================================
export {
    registerUser,
    loginUser,
    logoutUser,
    getUserProfile,
    updateUserProfile,
    getAllUsers,
    getUserById,
    deleteUser,
    changePassword,
    uploadAvatar,
};