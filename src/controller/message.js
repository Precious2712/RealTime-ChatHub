const Message = require('../model/message');
const mongoose = require("mongoose");

const loadChatMsgHistory = async (req, res) => {
    try {
        const loggedInUserId = req.user.id; 
        const otherUserId = req.params.userId;

        if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
            return res.status(400).json({ message: "Invalid user id" });
        }

        const messages = await Message.find({
            type: "private",
            $or: [
                { sender: loggedInUserId, receiver: otherUserId },
                { sender: otherUserId, receiver: loggedInUserId }
            ]
        })
            .sort({ createdAt: 1 });

        res.status(200).json(messages);
        
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to load chat history" });
    }
};


module.exports = {
    loadChatMsgHistory
}