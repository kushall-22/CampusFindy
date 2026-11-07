const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");
const Item = require("../models/Item");

const router = express.Router();

// GET /api/my-items
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.userId)) {
      return res.status(401).json({
        message: "Invalid user account",
      });
    }

    const items = await Item.find({
      postedBy: req.userId,
    })
      .select("-contactInfo -verificationAnswer -verificationQuestion")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json(items);
  } catch (error) {
    next(error);
  }
});

module.exports = router;