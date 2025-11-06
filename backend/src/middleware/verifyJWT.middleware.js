import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const verifyJWT = asyncHandler(async (req, res, next) => {
    let token;

    // Check token in Authorization header or cookies
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer")) {
        token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.token) {
        token = req.cookies.token;
    }

    if (!token) {
        throw new ApiError(401, "Unauthorized, no token provided");
    }

    try {
        // Verify the token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Find the user from token payload
        const user = await User.findById(decoded.id).select("-password");
        if (!user) throw new ApiError(404, "User not found");

        // Attach user to request
        req.user = user;

        next();
    } catch (error) {
        throw new ApiError(401, "Invalid or expired token");
    }
});