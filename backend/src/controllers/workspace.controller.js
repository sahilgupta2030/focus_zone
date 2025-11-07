import { Workspace } from "../models/workspace.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";

// Creating new workspace 
const createWorkspace = asyncHandler(async (req, res) => {
    const { name, description, tags } = req.body;

    // Ensure workspace name is provided
    if (!name || !name.trim()) {
        throw new ApiError(400, "Workspace name is required");
    }

    // Get logged-in user (from JWT middleware)
    const ownerId = req.user?._id;
    if (!ownerId) {
        throw new ApiError(401, "Unauthorized: User not logged in");
    }

    // Check if the user has permission (must be admin or owner)
    const userRole = req.user?.role; // Assuming role is stored in the User model
    if (!["admin", "owner"].includes(userRole)) {
        throw new ApiError(403, "You do not have permission to create a workspace");
    }

    // Create workspace and assign current user as owner + admin
    const workspace = await Workspace.create({
        name: name.trim(),
        description,
        owner: ownerId,
        members: [{ user: ownerId, role: "owner" }],
        tags
    });

    // Send success response
    return res
        .status(201)
        .json(new ApiResponse(201, workspace, "Workspace created successfully"));
})

// Fetching all workspace
const getAllWorkspace = asyncHandler(async (req, res) => {
    // Fetch all workspaces that are not deleted
    const workspaces = await Workspace.find({ isDeleted: false })
        .populate("owner", "username email") // Populate basic owner info
        .populate("members.user", "username email") // Populate member info
        .sort({ createdAt: -1 }); // Most recent first

    // If no workspaces found
    if (!workspaces.length) {
        throw new ApiError(404, "No workspaces found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, workspaces, "All workspaces fetched successfully"));
})

// Fetch workspace by Id
const getWorkspaceById = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user?._id; // logged-in user

    // Find workspace
    const workspace = await Workspace.findOne({ _id: workspaceId, isDeleted: false })
        .populate("owner", "username email")
        .populate("members.user", "username email");

    if (!workspace) {
        throw new ApiError(404, "Workspace not found");
    }

    // Check if user is a member
    const isMember = workspace.members.some(
        (member) => member.user._id.toString() === userId.toString()
    );

    if (!isMember) {
        throw new ApiError(403, "Access denied. You are not a member of this workspace.");
    }

    // Return workspace
    return res
        .status(200)
        .json(new ApiResponse(200, workspace, "Workspace fetched successfully"));
})

// Update workspace
const updateWorkspace = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const { name, description } = req.body;
    const userId = req.user?._id;

    // Find workspace
    const workspace = await Workspace.findOne({
        _id: workspaceId,
        isDeleted: false
    });
    if (!workspace) {
        throw new ApiError(404, "Workspace not found");
    }

    // Check if user is owner/admin
    const userMember = workspace.members.find(
        (m) => m.user.toString() === userId.toString()
    );

    if (!userMember || (userMember.role !== "owner" && userMember.role !== "admin")) {
        throw new ApiError(403, "Only owner or admin can update workspace");
    }

    // Update fields if provided
    if (name) workspace.name = name.trim();
    if (description) workspace.description = description.trim();

    await workspace.save();

    // Send response
    return res
        .status(200)
        .json(new ApiResponse(200, workspace, "Workspace updated successfully"));
})

// Delete workspace
const deleteWorkspace = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user?._id;

    // Find workspace
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
        throw new ApiError(404, "Workspace not found");
    }

    // Verify if user is the owner
    const owner = workspace.members.find(
        (m) => m.user.toString() === userId.toString() && m.role === "owner"
    );

    if (!owner) {
        throw new ApiError(403, "Only the owner can delete this workspace");
    }

    // Soft delete (mark as deleted)
    workspace.isDeleted = true;
    await workspace.save();

    // Send response
    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Workspace deleted successfully"));
})

// Add member to workspace
const addMemberToWorkspace = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const { memberId, role } = req.body; // role = "member" | "viewer" | "admin"
    const userId = req.user?._id;

    // Find workspace
    const workspace = await Workspace.findById(workspaceId).populate("members.user", "username email");
    if (!workspace || workspace.isDeleted) {
        throw new ApiError(404, "Workspace not found");
    }

    // Verify if requester is owner or admin
    const requester = workspace.members.find(
        (m) => m.user._id.toString() === userId.toString()
    );
    if (!requester || (requester.role !== "owner" && requester.role !== "admin")) {
        throw new ApiError(403, "Only owner or admin can add members");
    }

    // Prevent duplicate members
    const existingMember = workspace.members.find(
        (m) => m.user._id.toString() === memberId.toString()
    );
    if (existingMember) {
        throw new ApiError(400, "User is already a member of this workspace");
    }

    // Add new member
    workspace.members.push({
        user: memberId,
        role: role || "member",
    });

    await workspace.save();

    // Return updated workspace
    return res
        .status(200)
        .json(new ApiResponse(200, workspace, "Member added successfully"));
})

// Remove a member from workspace
const removeMemberFromWorkspace = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const { memberId } = req.body;
    const userId = req.user?._id;

    // Find workspace
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace || workspace.isDeleted) {
        throw new ApiError(404, "Workspace not found");
    }

    // Check if requester is owner/admin
    const requester = workspace.members.find(
        (m) => m.user.toString() === userId.toString()
    );
    if (!requester || (requester.role !== "owner" && requester.role !== "admin")) {
        throw new ApiError(403, "Only owner or admin can remove members");
    }

    // Prevent removing the owner
    const member = workspace.members.find(
        (m) => m.user.toString() === memberId.toString()
    );
    if (!member) {
        throw new ApiError(404, "Member not found in workspace");
    }

    if (member.role === "owner") {
        throw new ApiError(400, "Cannot remove the workspace owner");
    }

    // Remove member
    workspace.members = workspace.members.filter(
        (m) => m.user.toString() !== memberId.toString()
    );

    await workspace.save();

    // Return success
    return res
        .status(200)
        .json(new ApiResponse(200, workspace, "Member removed successfully"));
})

// Get workspace member
const getWorkspaceMember = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user?._id;

    // Find workspace
    const workspace = await Workspace.findById(workspaceId)
        .populate("members.user", "username email role")
        .populate("owner", "username email");

    if (!workspace || workspace.isDeleted) {
        throw new ApiError(404, "Workspace not found");
    }

    // Verify that the requester is a member
    const isMember = workspace.members.some(
        (m) => m.user._id.toString() === userId.toString()
    );
    if (!isMember) {
        throw new ApiError(403, "Access denied. You are not a member of this workspace.");
    }

    // Return all members
    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {
                    members: workspace.members,
                    owner: workspace.owner,
                    totalMembers: workspace.members.length,
                },
                "Workspace members fetched successfully"
            )
        );
})

// Update member role
const updateMemberRole = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const { memberId, newRole } = req.body;
    const userId = req.user?._id;

    // Find workspace
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace || workspace.isDeleted) {
        throw new ApiError(404, "Workspace not found");
    }

    // Check if requester is owner
    const requester = workspace.members.find(
        (m) => m.user.toString() === userId.toString() && m.role === "owner"
    );
    if (!requester) {
        throw new ApiError(403, "Only the owner can update member roles");
    }

    // Find the member to update
    const member = workspace.members.find(
        (m) => m.user.toString() === memberId.toString()
    );
    if (!member) {
        throw new ApiError(404, "Member not found in workspace");
    }

    // Prevent updating the owner's role
    if (member.role === "owner") {
        throw new ApiError(400, "Cannot change the owner's role");
    }

    // Validate new role
    const validRoles = ["admin", "member", "viewer"];
    if (!validRoles.includes(newRole)) {
        throw new ApiError(400, "Invalid role");
    }

    // Update role and save
    member.role = newRole;
    await workspace.save();

    // Return updated workspace
    return res
        .status(200)
        .json(new ApiResponse(200, workspace, "Member role updated successfully"));
})

// Check workspace access
const checkWorkspaceAccess = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user?._id;

    // Find workspace
    const workspace = await Workspace.findById(workspaceId)
        .populate("members.user", "username email")
        .populate("owner", "username email");

    if (!workspace || workspace.isDeleted) {
        throw new ApiError(404, "Workspace not found");
    }

    // Check if user is a member
    const member = workspace.members.find(
        (m) => m.user._id.toString() === userId.toString()
    );

    if (!member) {
        throw new ApiError(403, "Access denied. You are not a member of this workspace.");
    }

    // Return access info
    return res.status(200).json(
        new ApiResponse(200, {
            hasAccess: true,
            role: member.role,
            workspace: {
                id: workspace._id,
                name: workspace.name,
                owner: workspace.owner,
            },
        }, "Workspace access verified successfully")
    );
})

// Get user workspace
const getUserWorkspace = asyncHandler(async (req, res) => {
    const userId = req.user?._id;

    // Find all workspaces where user is owner or member
    const workspaces = await Workspace.find({
        $or: [
            { owner: userId },
            { "members.user": userId }
        ],
        isDeleted: false
    })
        .populate("owner", "username email")
        .populate("members.user", "username email")
        .sort({ createdAt: -1 });

    // If no workspace found
    if (!workspaces.length) {
        throw new ApiError(404, "No workspaces found for this user");
    }

    // Respond with list of workspaces
    return res.status(200).json(
        new ApiResponse(200, workspaces, "User workspaces fetched successfully")
    );
})

// Restore deleted workspace
const restoreWorkspace = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user?._id;

    // 1️⃣ Find workspace including deleted ones
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
        throw new ApiError(404, "Workspace not found");
    }

    // Only owner or admin can restore
    const isOwner = workspace.owner.toString() === userId.toString();
    const isAdmin = workspace.members.some(
        (member) =>
            member.user.toString() === userId.toString() &&
            member.role === "admin"
    );

    if (!isOwner && !isAdmin) {
        throw new ApiError(403, "You are not authorized to restore this workspace");
    }

    // If already active
    if (!workspace.isDeleted) {
        throw new ApiError(400, "Workspace is already active");
    }

    // Restore workspace
    workspace.isDeleted = false;
    await workspace.save();

    // Respond success
    return res
        .status(200)
        .json(
            new ApiResponse(200, workspace, "Workspace restored successfully")
        );
})

// Search workspace
const searchWorkspace = asyncHandler(async (req, res) => {
    const userId = req.user?._id;
    const { query } = req.query;

    if (!query || query.trim() === "") {
        throw new ApiError(400, "Search query is required");
    }

    // Find workspaces user can access
    const workspaces = await Workspace.find({
        $and: [
            {
                $or: [
                    { owner: userId },
                    { "members.user": userId }
                ]
            },
            {
                $or: [
                    { name: { $regex: query, $options: "i" } },
                    { description: { $regex: query, $options: "i" } }
                ]
            },
            { isDeleted: false }
        ]
    })
        .populate("owner", "username email")
        .populate("members.user", "username email")
        .sort({ createdAt: -1 });

    if (!workspaces.length) {
        throw new ApiError(404, "No workspaces found matching your search");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, workspaces, "Search results fetched successfully")
        );
})

// Get workspace status
const getWorkspaceStats = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user?._id;

    // Find the workspace
    const workspace = await Workspace.findById(workspaceId).populate("members.user", "username email");

    if (!workspace) {
        throw new ApiError(404, "Workspace not found");
    }

    // Check access (owner/admin only)
    const isOwner = workspace.owner.toString() === userId.toString();
    const isAdmin = workspace.members.some(
        (member) => member.user._id.toString() === userId.toString() && member.role === "admin"
    );

    if (!isOwner && !isAdmin) {
        throw new ApiError(403, "You are not authorized to view workspace stats");
    }

    // Calculate stats
    const totalMembers = workspace.members.length + 1; // +1 for owner
    const roleCount = {
        owner: 1,
        admin: workspace.members.filter((m) => m.role === "admin").length,
        member: workspace.members.filter((m) => m.role === "member").length,
        viewer: workspace.members.filter((m) => m.role === "viewer").length
    };

    // Response data
    const stats = {
        workspaceId: workspace._id,
        name: workspace.name,
        totalMembers,
        roleCount,
        createdAt: workspace.createdAt,
        updatedAt: workspace.updatedAt
    };

    return res
        .status(200)
        .json(
            new ApiResponse(200, stats, "Workspace stats fetched successfully")
        );
})

// Leave workspace
const leaveWorkspace = asyncHandler(async (req, res) => {
    const { workspaceId } = req.params;
    const userId = req.user?._id;

    // Find workspace
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
        throw new ApiError(404, "Workspace not found");
    }

    // Prevent owner from leaving
    if (workspace.owner.toString() === userId.toString()) {
        throw new ApiError(400, "Owner cannot leave their own workspace");
    }

    // Check if user is part of members
    const isMember = workspace.members.some(
        (m) => m.user.toString() === userId.toString()
    );
    if (!isMember) {
        throw new ApiError(400, "You are not a member of this workspace");
    }

    // Remove user from members array
    workspace.members = workspace.members.filter(
        (m) => m.user.toString() !== userId.toString()
    );

    await workspace.save();

    // Respond success
    return res
        .status(200)
        .json(
            new ApiResponse(200, {}, "You have left the workspace successfully")
        );
})

export {
    createWorkspace,
    getAllWorkspace,
    getWorkspaceById,
    updateWorkspace,
    deleteWorkspace,
    addMemberToWorkspace,
    removeMemberFromWorkspace,
    getWorkspaceMember,
    updateMemberRole,
    checkWorkspaceAccess,
    getUserWorkspace,
    restoreWorkspace,
    searchWorkspace,
    getWorkspaceStats,
    leaveWorkspace
}