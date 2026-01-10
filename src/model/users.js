const mongoose = require('mongoose');
const { Schema } = mongoose;

const userObj = new Schema({
    firstName: {
        type: String,
        required: true
    },
    lastName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        validate: {
            validator: function (v) {
                return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
            },
            message: props => `${props.value} is not a valid email address!`
        }
    },
    password: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ["online", "offline", "away"],
        default: "offline"
    },
    lastSeen: {
        type: Date,
        default: null
    }
});

const User = mongoose.model('User', userObj);

module.exports = User;