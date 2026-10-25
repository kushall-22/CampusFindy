const express = require('express');
const User = require('../models/User');
const Item = require('../models/Item');

const router = express.Router();

// Summary numbers for the admin page
router.get('/stats', async (req, res) => {
  try {
    const [totalUsers, openItems, claimedItems] = await Promise.all([
      User.countDocuments(),
      Item.countDocuments({ claimed: { $ne: true }, state: { $nin: ['closed', 'removed'] } }),
      Item.countDocuments({ claimed: true })
    ]);
    res.json({ stats: { totalUsers, openItems, claimedItems } });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// All reports (private fields like contact and answers are NOT sent)
router.get('/items', async (req, res) => {
  try {
    const items = await Item.find({ state: { $ne: 'removed' } })
      .sort({ createdAt: -1 })
      .limit(200)
      .populate('postedBy', 'name')
      .select('title description location status claimed state createdAt postedBy');

    res.json({
      items: items.map(i => ({
        _id: i._id,
        title: i.title,
        description: i.description,
        location: i.location,
        status: i.status,
        claimed: !!i.claimed,
        state: i.state || (i.claimed ? 'claimed' : 'open'),
        createdAt: i.createdAt,
        reporterName: i.postedBy ? i.postedBy.name : ''
      }))
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Close a report, or remove it (hidden, not erased)
router.patch('/items/:id/moderation', async (req, res) => {
  try {
    const { action } = req.body;
    if (!['close', 'remove'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }

    const item = await Item.findByIdAndUpdate(
      req.params.id,
      { state: action === 'close' ? 'closed' : 'removed' },
      { new: true }
    );
    if (!item) return res.status(404).json({ message: 'Item not found' });

    console.log(`[admin] ${req.userId} ${action} item ${item._id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// All users (no passwords)
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().sort({ _id: -1 }).limit(200).select('name email role status');
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Suspend or restore a student
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { action } = req.body;
    if (!['suspend', 'restore'].includes(action)) {
      return res.status(400).json({ message: 'Invalid action' });
    }

    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ message: 'User not found' });
    if (target.role === 'admin') {
      return res.status(400).json({ message: 'Admin accounts cannot be suspended' });
    }

    target.status = action === 'suspend' ? 'suspended' : 'active';
    await target.save();

    console.log(`[admin] ${req.userId} ${action} user ${target._id}`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;