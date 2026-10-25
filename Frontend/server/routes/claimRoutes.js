const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const Item = require('../models/Item');
const ClaimRequest = require('../models/ClaimRequest');

// POST /api/claims/:itemId  -> student sends a claim request
router.post('/:itemId', authMiddleware, async (req, res) => {
  try {
    const { proof } = req.body;
    if (!proof || !proof.trim()) {
      return res.status(400).json({ message: 'Please describe the item as proof.' });
    }

    const item = await Item.findById(req.params.itemId);
    if (!item) {
      return res.status(404).json({ message: 'Item not found.' });
    }

    const userId = req.userId;

    if (String(item.postedBy) === String(userId)) {
      return res.status(400).json({ message: 'You cannot claim your own post.' });
    }

    const existing = await ClaimRequest.findOne({
      item: item._id,
      claimant: userId,
      status: { $in: ['pending', 'approved'] }
    });
    if (existing) {
      return res.status(400).json({ message: 'You already sent a request for this item.' });
    }

    const claim = await ClaimRequest.create({
      item: item._id,
      claimant: userId,
      finder: item.postedBy,
      proof: proof.trim()
    });

    res.status(201).json(claim);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/claims/received  -> finder sees requests on their items
router.get('/received', authMiddleware, async (req, res) => {
  try {
    const claims = await ClaimRequest.find({ finder: req.userId })
      .populate('item', 'title status location')
      .populate('claimant', 'name email')
      .sort({ createdAt: -1 });

    res.json(claims);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/claims/:id/review  -> finder approves or rejects a request
router.patch('/:id/review', authMiddleware, async (req, res) => {
  try {
    const { decision } = req.body;
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ message: 'Decision must be approved or rejected.' });
    }

    const claim = await ClaimRequest.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    if (String(claim.finder) !== String(req.userId)) {
      return res.status(403).json({ message: 'Only the finder can review this request.' });
    }

    if (claim.status !== 'pending') {
      return res.status(400).json({ message: 'This request was already reviewed.' });
    }

    claim.status = decision;
    await claim.save();

    res.json(claim);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/claims/:id/return  -> finder marks the item as returned
router.patch('/:id/return', authMiddleware, async (req, res) => {
  try {
    const claim = await ClaimRequest.findById(req.params.id);
    if (!claim) {
      return res.status(404).json({ message: 'Request not found.' });
    }

    if (String(claim.finder) !== String(req.userId)) {
      return res.status(403).json({ message: 'Only the finder can mark this as returned.' });
    }

    if (claim.status !== 'approved') {
      return res.status(400).json({ message: 'Only an approved request can be marked as returned.' });
    }

    claim.status = 'returned';
    claim.returnedAt = new Date();
    await claim.save();

    // Mark the item itself as claimed, using the fields you already added
    await Item.findByIdAndUpdate(claim.item, {
      claimed: true,
      claimedBy: claim.claimant
    });

    res.json(claim);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;