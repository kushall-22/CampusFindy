const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({ name, email, password: hashedPassword });
    await newUser.save();

    res.status(201).json({ message: 'Signup successful' });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ message: 'JWT_SECRET is not configured on the server' });
    }

    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.status(200).json({ token, name: user.name, email: user.email });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Current user (used by the dashboard and admin page to check the role)
router.get('/me', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('name email role status');

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }
    if (user.status === 'suspended') {
      return res.status(403).json({ message: 'Account suspended' });
    }

    res.json({
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;