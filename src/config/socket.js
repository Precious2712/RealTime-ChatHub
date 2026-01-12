const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

const User = require("../model/users");
const Message = require("../model/message");
const Room = require("../model/room");

const onlineUsers = new Map();

const userStatus = new Map();

const awayTimers = new Map();

const allowedOrigins = [
    "https://talk-flow-ten.vercel.app",
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
];

module.exports = function initSocket(server) {
    const io = new Server(server, {
        cors: {
            origin: allowedOrigins,
            methods: ["GET", "POST"],
            allowedHeaders: ["Authorization"],
        },
    });

    // 🔐 socket auth
    io.use(async (socket, next) => {
        try {
            const token = socket.handshake.auth.token;
            if (!token) return next(new Error("Token missing"));

            const decoded = jwt.verify(token, process.env.SECRET_KEY);
            const user = await User.findById(decoded.id).select("-password");

            if (!user) return next(new Error("User not found"));

            socket.user = user;
            next();
        } catch {
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


        socket.on("create-room", async ({ roomName }) => {
            if (!roomName) return;

            const exists = await Room.findOne({ roomName: roomName.trim() });
            if (exists) {
                return socket.emit("error", "Room already exists");
            }

            const room = await Room.create({
                roomName: roomName.trim(),
                createdBy: socket.user._id,
                createdUserName: socket.user.firstName,


                members: [
                    {
                        memberId: socket.user._id,
                        memberName: socket.user.firstName
                    }
                ]
            });


            socket.join(`room:${room._id}`);

            io.emit("room-created", room);
        });


        socket.on("join-room", async ({ roomId }) => {
            if (!roomId) return;

            const room = await Room.findById(roomId);
            if (!room) return;

            const isMember = room.members.some(
                m => String(m.memberId) === userId
            );

            if (!isMember) {
                return socket.emit("error", "You are not a member of this room");
            }

            socket.join(`room:${roomId}`);
        });


        socket.on("room-message", async ({ roomId, message }) => {
            if (!roomId || !message) return;

            const room = await Room.findById(roomId);
            if (!room) return;

            const isMember = room.members.some(
                m => String(m.memberId) === userId
            );

            if (!isMember) {
                return socket.emit("error", "You are not allowed to send messages here");
            }

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
                senderName: socket.user.firstName,
                message: saved.message,
                createdAt: saved.createdAt
            });
        });

        socket.on("add-member-to-room", async ({ roomId, memberId }) => {
            if (!roomId || !memberId) return;

            const room = await Room.findById(roomId);
            if (!room) {
                return socket.emit("error", "Room not found");
            }

            const requesterId = socket.user._id.toString();


            const isCreator = String(room.createdBy) === requesterId;
            const isMember = room.members.some(
                m => String(m.memberId) === requesterId
            );

            if (!isCreator && !isMember) {
                return socket.emit("error", "You are not allowed to add members");
            }


            const alreadyMember = room.members.some(
                m => String(m.memberId) === String(memberId)
            );

            if (alreadyMember) {
                return socket.emit("error", "User already in room");
            }


            const userToAdd = await User.findById(memberId);
            if (!userToAdd) {
                return socket.emit("error", "User does not exist");
            }

            room.members.push({
                memberId: userToAdd._id,
                memberName: userToAdd.firstName
            });

            await room.save();

            io.to(`user:${memberId}`).socketsJoin(`room:${roomId}`);


            io.to(`room:${roomId}`).emit("member-added", {
                roomId,
                memberId: userToAdd._id,
                memberName: userToAdd.firstName
            });
        });


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

};
