const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

const Users = require('../model/users');

const generateToken = (id, email) => {
    return jwt.sign({ id, email }, process.env.SECRET_KEY, {
        expiresIn: process.env.JWT_TIMEOUT
    });
};

const createUser = async (req, res) => {
    const { firstName, lastName, email, password } = req.body;

    try {
        if (!firstName || !lastName || !email || !password) {
            return res.status(400).json({
                message: 'All fields are required'
            });
        }

        const existingUser = await Users.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                message: 'User with this email already exists'
            });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const registeredUser = await Users.create({
            firstName,
            lastName,
            email,
            password: hashedPassword
        });

        res.status(201).json({
            message: 'User created successfully',
            registeredUser
        });
    } catch (error) {
        console.log('error', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


const loginUsers = async (req, res) => {
    const { email, password } = req.body;

    try {
        if (!email || !password) {
            return res.status(400).json({
                message: 'Email and password are required'
            });
        }

        const user = await Users.findOne({ email })

        if (!user) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            return res.status(401).json({
                message: 'Invalid credentials'
            });
        }

        const token = generateToken(user._id, user.email);

        res.status(200).json({
            success: true,
            message: 'Login successful',
            user: {
                id: user._id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                token
            },
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
}


const getUsers = async (req, res) => {
    try {
        const getUser = await Users.find()

        if (!getUser) {
            return res.status(400).json({
                message: 'User with this email already exists'
            });
        }

        res.status(200).json({
            message: 'All users found',
            getUser
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};


const getCurrentUser = async (req, res) => {
    try {
        const user = req.user;

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated'
            });
        }

        const userId = await Users.findById(user._id);

        if (!userId) {
            return res.status(400).json({
                message: 'User with this email already exists'
            });
        }

        res.status(201).json({
            message: 'User Found',
            userId
        });

    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



module.exports = {
    createUser,
    loginUsers,
    getUsers,
    getCurrentUser
}