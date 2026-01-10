const express = require('express');
const app = express.Router();

const verifyToken = require('../middleware/user-token');

const {
    createUser,
    loginUsers,
    getUsers,
    getCurrentUser
} = require('../controller/users');

app.post('/create-user', createUser);

app.post('/login-user', loginUsers);

app.get('/get-users', getUsers);

app.get('/get-current-user', verifyToken, getCurrentUser);

module.exports = app;