const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Item = require('../models/Item');

// GET /api/my-items  -> everything the logged-in user posted
router.get('/', authMiddleware, async (req, res) => {
  try {
    const items = await Item.find({ postedBy: req.userId })
      .select('-verificationAnswer')
      .sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;