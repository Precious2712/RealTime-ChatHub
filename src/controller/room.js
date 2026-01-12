const Room = require('../model/room');
const Message = require('../model/message');

const getMyRooms = async (req, res) => {
    try {
        const userId = req.user._id;

        const rooms = await Room.find({
            "members.memberId": userId
        })
            .select("roomName createdBy createdUserName members createdAt")
            .sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            count: rooms.length,
            rooms
        });
    } catch (error) {
        console.error("Get rooms error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch rooms"
        });
    }
};

const getRoomMessages = async (req, res) => {
    try {
        const { roomId } = req.params;

        if (!roomId) {
            return res.status(400).json({
                success: false,
                message: "Room ID is required"
            });
        }

        const messages = await Message.find({
            room: roomId,
            type: "room"
        })
            .sort({ createdAt: 1 });

        res.status(200).json({
            success: true,
            count: messages.length,
            messages
        });

    } catch (error) {
        console.error("Get room messages error:", error);
        res.status(500).json({
            success: false,
            message: "Server error"
        });
    }
};


module.exports = {
    getMyRooms,
    getRoomMessages
}