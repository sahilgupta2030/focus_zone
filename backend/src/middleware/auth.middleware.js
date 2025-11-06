import jwt from "jsonwebtoken";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/apiError.js";

export const verifyJWT = async (req, res, next) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) throw new ApiError(401, "No token provided");

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = await User.findById(decoded.id).select("-password");
        if (!req.user) throw new ApiError(404, "User not found");
        next();
    } catch (err) {
        throw new ApiError(401, "Invalid or expired token");
    }
};