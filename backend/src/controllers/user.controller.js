import { User } from "../models/user.model.js"
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const JWT_SECRET = process.env.JWT_SECRET;
const generateToken = (userId) => {
    return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
        expiresIn: "6d",
    });
};

// Register a new user (signup)
const registerUser = asyncHandler(async (req, res) => { })
// Authenticate user and return JWT token (login)
const loginUser = asyncHandler(async (req, res) => { })
// Invalidate token or end session (logout)
const logoutUser = asyncHandler(async (req, res) => { })
// Get logged-in user profile
const getUserProfile = asyncHandler(async (req, res) => { })
// Update user details (name, avatar, etc.)
const updateUserProfile = asyncHandler(async (req, res) => { })
// Fetch all users (admin only)
const getAllUsers = asyncHandler(async (req, res) => { })
// Fetch specific user details
const getUserById = asyncHandler(async (req, res) => { })
// Delete user account (admin/self)
const deleteUser = asyncHandler(async (req, res) => { })
// Change user password
const changePassword = asyncHandler(async (req, res) => { })
// Upload or update user profile image
const uploadAvatar = asyncHandler(async (req, res) => { })

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