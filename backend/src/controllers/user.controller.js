import { User } from "../models/user.model.js"
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Genetrating Token
const JWT_SECRET = process.env.JWT_SECRET;
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, JWT_SECRET || process.env.JWT_SECRET, {
        expiresIn: "6d",
    });
};

// Register a new user (signup)
const registerUser = asyncHandler(async (req, res) => {

    const { name, email, password } = req.body
    // Validate Input
    if (!name || !email || !password) {
        throw new ApiError(400, "All fields are required")
    }

    // Checking for user already present or not
    const existingUser = await User.findOne({ email })
    if (existingUser) {
        throw new ApiError(402, "User already exists with this email")
    }

    // Check if this is the first user
    const isFirstUser = (await User.countDocuments()) === 0;

    // Upload Avatar
    let avatarUrl = ""
    if (req?.file) {
        let uploadResult = await uploadOnCloudinary(req?.file?.path)
        avatarUrl = uploadResult?.url
    }

    // Creating new user
    const newUser = await User.create({
        name,
        email,
        password,
        avatar: avatarUrl,
        role: isFirstUser ? "owner" : "member" // first user = owner
    })

    // Generating access token
    const token = generateToken(newUser._id)

    // Response data
    const userData = {
        _id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        avatar: newUser?.avatar
    }

    return res
        .status(201)
        .json(new ApiResponse(201, { user: userData, token }, "User registered successfully"));
})

// Authenticate user and return JWT token (login)
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body

    // Validate input
    if (!email || !password) {
        throw new ApiError(400, "All fields are required")
    }

    // Find user
    const user = await User.findOne({ email }).select("+password")
    if (!user) {
        throw new ApiError(402, "User not found")
    }

    // Compare Password
    const isMatch = await bcrypt.compare(password, user.password)
    if (!isMatch) {
        throw new ApiError(404, "Invalid credential")
    }

    const token = generateToken(user._id)

    // Response data
    const userData = {
        _id: user._id,
        name: user.name,
        email: user.email,
        avatar: user?.avatar
    }

    return res
        .status(201)
        .json(new ApiResponse(201, { user: userData, token }, "Login successfully"))
})

// Invalidate token or end session (logout)
const logoutUser = asyncHandler(async (req, res) => {
    res.clearCookie("token");
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Logged out successfully"));
})

// Get logged-in user profile
const getUserProfile = asyncHandler(async (req, res) => {
    const userId = req.user?._id; // from auth middleware

    const user = await User.findById(userId).select("-password");
    if (!user) throw new ApiError(404, "User not found");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "User profile fetched successfully"));
})
// Update user details (name, email, avatar)
const updateUserProfile = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { name, email } = req.body;

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;

    // Handle avatar upload (optional)
    if (req.file) {
        const uploaded = await uploadOnCloudinary(req.file.path);
        updateData.avatar = uploaded.url;
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
})
// Fetch all users (admin only)
const getAllUsers = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin")
        throw new ApiError(403, "Access denied: Admins only");

    const users = await User.find().select("-password");
    return res
        .status(200)
        .json(new ApiResponse(200, users, "All users fetched successfully"));
})
// Fetch specific user details
const getUserById = asyncHandler(async (req, res) => {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) throw new ApiError(404, "User not found");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "User fetched successfully"));
})

// Delete user account (admin/self)
const deleteUser = asyncHandler(async (req, res) => {
    if (req.user.role !== "admin")
        throw new ApiError(403, "Access denied: Admins only");

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw new ApiError(404, "User not found");

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "User deleted successfully"));
})

// Change user password
const changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        throw new ApiError(400, "Old and new passwords are required");
    }

    const user = await User.findById(req.user._id).select("+password");
    if (!user) {
        throw new ApiError(404, "User not found");
    }

    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
        throw new ApiError(401, "Old password is incorrect");
    }

    user.password = newPassword; // bcrypt will hash automatically via pre-save hook
    await user.save();

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"));
})

// Upload or update user profile image
const uploadAvatar = asyncHandler(async (req, res) => {
    if (!req.file) {
        throw new ApiError(400, "No file uploaded");
    }

    const uploaded = await uploadOnCloudinary(req.file.path);
    if (!uploaded || !uploaded.url) {
        throw new ApiError(500, "Avatar upload failed");
    }

    const user = await User.findByIdAndUpdate(
        req.user._id,
        { avatar: uploaded.url },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, { user }, "Avatar updated successfully"));
})

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
    uploadAvatar
}