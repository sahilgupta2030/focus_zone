import { connectDB } from "./db/db.js"
import dotenv from 'dotenv';
import cors from "cors"
import cookieParser from "cookie-parser"
import express from "express"

// Import Routes
import userRoutes from "./routes/user.routes.js"
import workspaceRoutes from "./routes/workspace.routes.js"
import boardRoutes from "./routes/board.routes.js"
import listRoutes from "./routes/list.routes.js"
import cardRoutes from "./routes/card.routes.js"
import activityLogRoutes from "./routes/activityLog.routes.js"
import messageRoutes from "./routes/message.routes.js"

dotenv.config();

const app = express()

// CORS Config
app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
}))
app.use(express.json({ limit: "16kb" }))
app.use(express.urlencoded({ extended: true, limit: "16kb" }))
app.use(express.static("public"))
// Cookies Config
app.use(cookieParser())

// Test Route
app.get("/", (req, res) => {
    res.send("Focus Zone API is running...");
});

// Error Middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ message: err.message || "Server Error" });
});


// Routes
app.use("/api/users", userRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/boards", boardRoutes)
app.use("/api/lists", listRoutes)
app.use("/api/cards", cardRoutes)
app.use("/api/activityLogs", activityLogRoutes)
app.use("/api/messages", messageRoutes)

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    console.log(`Server is running at port : ${PORT}`)
    connectDB()
})