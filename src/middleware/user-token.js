const User = require('../model/users');
const jwt = require('jsonwebtoken');

const userToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        // console.log("RAW AUTH HEADER:", authHeader);

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Access denied. No token or invalid format."
            });
        }

        const token = authHeader.split(" ")[1];

        // console.log("EXTRACTED TOKEN:", token);

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Token missing"
            });
        }

        const decoded = jwt.verify(token, process.env.SECRET_KEY);

        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found"
            });
        }

        req.user = user;

        next();
    } catch (error) {
        console.error("AUTH ERROR:", error.message);

        let message = "Invalid token";

        if (error.name === 'TokenExpiredError') {
            message = "Token expired. Please login again.";
        }

        return res.status(401).json({
            success: false,
            message,
            error: error.name
        });
    }
};

module.exports = userToken;
