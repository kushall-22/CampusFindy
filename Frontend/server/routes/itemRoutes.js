const express = require('express');
const Item = require('../models/Item');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// Post a new item (lost or found) — protected route
router.post('/', authMiddleware, async (req, res) => {
  try {
    const { title, description, status, category, location, contactInfo, verificationQuestion, verificationAnswer } = req.body;
    const newItem = new Item({
      title,
      description,
      status,
      category,
      location,
      contactInfo,
      postedBy: req.userId,
      verificationQuestion: verificationQuestion || null,
      verificationAnswer: verificationAnswer || null
    });

    await newItem.save();

    res.status(201).json({ message: 'Item posted successfully', item: newItem });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Browse all items — public route
router.get('/', async (req, res) => {
  try {
    const items = await Item.find().sort({ createdAt: -1 });
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Claim an item — protected route
router.patch('/:id/claim', authMiddleware, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id)
      .select('+verificationAnswer +contactInfo');

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (item.claimed) {
      return res.status(400).json({ message: 'Item already claimed' });
    }

    if (item.verificationAnswer) {
      const given = (req.body.answer || '').trim().toLowerCase();
      if (given !== item.verificationAnswer.trim().toLowerCase()) {
        return res.status(400).json({ message: 'Wrong answer. Try again.' });
      }
    }

    item.claimed = true;
    item.claimedBy = req.userId;
    await item.save();

    const result = item.toObject();
    delete result.verificationAnswer;

    res.status(200).json({ message: 'Item claimed successfully', item: result });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});
// Get contact info of an item you claimed — protected route
router.get('/:id/contact', authMiddleware, async (req, res) => {
  try {
    const item = await Item.findById(req.params.id).select('+contactInfo');

    if (!item) {
      return res.status(404).json({ message: 'Item not found' });
    }

    if (!item.claimed || String(item.claimedBy) !== String(req.userId)) {
      return res.status(403).json({ message: 'Not allowed' });
    }

    res.status(200).json({ contactInfo: item.contactInfo });
  } catch (err) {
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;