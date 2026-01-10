const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema(
    {
        roomName: {
            type: String,
            required: true,
            unique: true,     
            trim: true
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        createdUserName: {
            type: String,
            required: true
        },

        members: [
            {
                memberId: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "User",
                    required: true
                },
                memberName: {
                    type: String,
                    required: true
                }
            }
        ]
    },
    { timestamps: true }
);

const Room = mongoose.model("Room", roomSchema);

module.exports = Room;