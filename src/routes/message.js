
const express = require('express');
const app = express.Router();

const {
    loadChatMsgHistory
} = require('../controller/message');

const verifyToken = require('../middleware/user-token');

app.get('/messages/private/:userId', verifyToken, loadChatMsgHistory);

module.exports = app;