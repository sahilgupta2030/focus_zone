import { connectDB } from "./services/db.js"
import dotenv from 'dotenv';
import cors from "cors"
import cookieParser from "cookie-parser"
import express from "express"
dotenv.config(); 

const app = express()

// CORS Config
app.use(cors({
    origin : process.env.CORS_ORIGIN ,
    credentials : true
}))
app.use(express.json({limit : "16kb"}))
app.use(express.urlencoded({extended : true , limit : "16kb"}))
app.use(express.static("public"))
// Cookies Config
app.use(cookieParser())

const PORT = process.env.PORT || 5001;

app.listen(PORT, () => {
    console.log(`Server is running at port : ${PORT}`)
    connectDB()
})