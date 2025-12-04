const express = require('express');
const router = express.Router();
const User = require('../models/userSchema');

// Create a new user or update createdAt if user exists
router.post('/', async (req, res) => {
    try {
        // Check if user already exists by email
        const existingUser = await User.findOne({ email: req.body.email });
        
        if (existingUser) {
            // If user exists, only update the createdAt field
            const updatedUser = await User.findByIdAndUpdate(
                existingUser._id,
                { createdAt: new Date() },
                { new: true }
            );
            return res.status(200).json(updatedUser);
        } else {
            // If user doesn't exist, create a new user
            const user = new User({
                name: req.body.name,
                email: req.body.email,
                password: req.body.password,
                profileURL: req.body.profileURL
            });
            const newUser = await user.save();
            res.status(201).json(newUser);
        }
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Get all users or get user by email
router.get('/', async (req, res) => {
    try {
        const { email } = req.query;
        
        // If email query parameter is provided, find user by email
        if (email) {
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(404).json({ message: 'User not found' });
            }
            return res.json(user);
        }
        
        // Otherwise, return all users
        const users = await User.find();
        res.json(users);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get a specific user
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Update a user
router.put('/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndUpdate(
            req.params.id,
            {
                name: req.body.name,
                email: req.body.email,
                password: req.body.password
            },
            { new: true }
        );
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

// Delete a user
router.delete('/:id', async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'User deleted successfully' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;