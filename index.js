require("dotenv").config();
const cors = require("cors");
const express = require("express");
const { createServer } = require("node:http");
const { join } = require("node:path");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");

const User = require("./src/model/users");
const Message = require("./src/model/message");
const Room = require("./src/model/room");

const userRoutes = require("./src/routes/users");
const messageRoutes = require("./src/routes/message");

const app = express();
const server = createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.sendFile(join(__dirname, "index.html"));
});

app.use("/api/v1", userRoutes);
app.use("/api/v1", messageRoutes);



// userId -> Set(socketId)
const onlineUsers = new Map();

// userId -> status ("online" | "away" | "offline")
const userStatus = new Map();

// userId -> away timeout
const awayTimers = new Map();


io.use(async (socket, next) => {
    try {
        const token = socket.handshake.auth.token;
        if (!token) return next(new Error("Token missing"));

        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        const user = await User.findById(decoded.id).select("-password");

        if (!user) return next(new Error("User not found"));

        socket.user = user;
        next();
    } catch (err) {
        next(new Error("Authentication failed"));
    }
});


io.on("connection", (socket) => {
    const userId = socket.user._id.toString();

    /* ---------- Online ---------- */
    if (!onlineUsers.has(userId)) {
        onlineUsers.set(userId, new Set());
    }

    onlineUsers.get(userId).add(socket.id);
    userStatus.set(userId, "online");

    socket.join(`user:${userId}`);

    io.emit("presence-update", {
        userId,
        status: "online"
    });

    console.log(`✅ ${userId} connected`);

    /* ---------- Typing ---------- */
    socket.on("typing", ({ to }) => {
        io.to(`user:${to}`).emit("typing", { from: userId });
    });

    socket.on("stop-typing", ({ to }) => {
        io.to(`user:${to}`).emit("stop-typing", { from: userId });
    });

    /* ---------- Seen ---------- */
    socket.on("message-seen", async ({ messageId, to }) => {
        await Message.findByIdAndUpdate(messageId, { $set: { seen: true } });

        io.to(`user:${to}`).emit("message-seen", {
            messageId,
            by: userId
        });
    });

    /* ---------- Private Message ---------- */
    socket.on("private-message", async ({ toUserId, message }) => {
        if (!toUserId || !message) return;

        const savedMessage = await Message.create({
            sender: socket.user._id,
            receiver: toUserId,
            senderName: socket.user.firstName,
            message,
            type: "private"
        });

        io.to(`user:${toUserId}`).emit("private-message", {
            _id: savedMessage._id,
            sender: socket.user._id,
            receiver: toUserId,
            message: savedMessage.message,
            createdAt: savedMessage.createdAt,
            seen: false
        });

        io.to(`user:${userId}`).emit("private-message", {
            _id: savedMessage._id,
            sender: socket.user._id,
            receiver: toUserId,
            message: savedMessage.message,
            createdAt: savedMessage.createdAt,
            seen: false
        });
    });

    /* ---------- Rooms ---------- */
    socket.on("create-room", async ({ roomName, members }) => {
        if (!roomName) return;

        const exists = await Room.findOne({ roomName: roomName.trim() });
        if (exists) return socket.emit("error", "Room exists");

        const uniqueMembers = new Map();
        uniqueMembers.set(userId, {
            memberId: socket.user._id,
            memberName: socket.user.firstName
        });

        members?.forEach(m => {
            uniqueMembers.set(String(m.memberId), m);
        });

        const room = await Room.create({
            roomName: roomName.trim(),
            createdBy: socket.user._id,
            createdUserName: socket.user.firstName,
            members: [...uniqueMembers.values()]
        });

        room.members.forEach(m => {
            io.to(`user:${m.memberId}`).socketsJoin(`room:${room._id}`);
        });

        io.emit("room-created", room);
    });

    socket.on("join-room", ({ roomId }) => {
        socket.join(`room:${roomId}`);
    });

    socket.on("room-message", async ({ roomId, message }) => {
        if (!roomId || !message) return;

        const saved = await Message.create({
            sender: socket.user._id,
            receiver: null,
            room: roomId,
            senderName: socket.user.firstName,
            message,
            type: "room"
        });

        io.to(`room:${roomId}`).emit("room-message", {
            _id: saved._id,
            sender: socket.user._id,
            message: saved.message,
            createdAt: saved.createdAt
        });
    });

    /* ---------- Activity / Away ---------- */
    socket.on("activity", () => {
        clearTimeout(awayTimers.get(userId));
        userStatus.set(userId, "online");

        awayTimers.set(
            userId,
            setTimeout(() => {
                userStatus.set(userId, "away");
                io.emit("presence-update", {
                    userId,
                    status: "away"
                });
            }, 5 * 60 * 1000)
        );
    });

    /* ---------- Disconnect ---------- */
    socket.on("disconnect", () => {
        const sockets = onlineUsers.get(userId);
        if (!sockets) return;

        sockets.delete(socket.id);

        if (sockets.size === 0) {
            onlineUsers.delete(userId);
            userStatus.set(userId, "offline");

            io.emit("presence-update", {
                userId,
                status: "offline"
            });

            console.log(`❌ ${userId} offline`);
        }
    });
});

/* ================= SERVER ================= */

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
