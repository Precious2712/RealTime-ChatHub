require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { createServer } = require("http");

const userRoutes = require("./src/routes/users");
const messageRoutes = require("./src/routes/message");
const room = require('./src/routes/room');
const initSocket = require("./src/config/socket");

const app = express();
const server = createServer(app);

const allowedOrigins = [
    "https://talk-flow-ten.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
];

app.use(
    cors({
        origin: (origin, callback) => {
            if (!origin) return callback(null, true);

            if (allowedOrigins.includes(origin)) {
                return callback(null, true);
            }

            return callback(new Error("Not allowed by CORS"));
        },
        methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization"],
    })
);

app.options("*", cors());


app.use(express.json());


app.use("/api/v1", userRoutes);
app.use("/api/v1", messageRoutes);
app.use('/api/v1', room);


initSocket(server);

async function startServer() {
    try {
        await mongoose.connect(process.env.MONGODB);
        console.log("✅ MongoDB connected");

        const PORT = process.env.PORT || 3000;
        server.listen(PORT, () => {
            console.log(`🚀 Server running on http://localhost:${PORT}`);
        });
    } catch (err) {
        console.error("Startup error:", err);
    }
}

startServer();
