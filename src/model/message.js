const mongoose = require("mongoose");
const { Schema } = mongoose;

const messageSchema = new Schema(
    {
        sender: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        receiver: {
            type: Schema.Types.ObjectId,
            ref: "User",
            default: null // ✅ optional
        },

        room: {
            type: Schema.Types.ObjectId,
            ref: "Room",
            default: null // ✅ optional
        },

        senderName: {
            type: String,
            required: true
        },

        message: {
            type: String,
            required: true
        },

        type: {
            type: String,
            enum: ["private", "room"],
            required: true
        },
        
        delivered: { type: Boolean, default: false },
        read: { type: Boolean, default: false }
    },
    { timestamps: true }
);

const message = mongoose.model("message", messageSchema);

module.exports = message;