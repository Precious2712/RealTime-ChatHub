const express = require('express');
const app = express.Router();

const {
    getMyRooms,
    getRoomMessages
} = require('../controller/room');

const verifyToken = require('../middleware/user-token');

app.get('/rooms', verifyToken, getMyRooms);

app.get("/messages/room/:roomId", verifyToken, getRoomMessages);

module.exports = app;