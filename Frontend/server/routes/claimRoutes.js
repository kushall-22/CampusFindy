const express = require("express");
const mongoose = require("mongoose");
const authMiddleware = require("../middleware/authMiddleware");
const Item = require("../models/Item");
const ClaimRequest = require("../models/ClaimRequest");
const isValidId = require("../utils/isValidId");

const router = express.Router();

// Submit a claim
router.post("/:itemId", authMiddleware, async (req, res, next) => {
  try {
    const { itemId } = req.params;
    const proof = req.body?.proof;

    if (!isValidId(itemId)) {
      return res.status(400).json({
        message: "Invalid item ID",
      });
    }

    if (
      typeof proof !== "string" ||
      proof.trim().length < 5 ||
      proof.trim().length > 1000
    ) {
      return res.status(400).json({
        message: "Proof must be between 5 and 1000 characters",
      });
    }

    const item = await Item.findById(itemId).select("+contactInfo");

    if (!item) {
      return res.status(404).json({
        message: "Item not found",
      });
    }

    if (
      item.status !== "found" ||
      item.state !== "open" ||
      item.claimed
    ) {
      return res.status(409).json({
        message: "This item is not available to claim",
      });
    }

    if (String(item.postedBy) === String(req.userId)) {
      return res.status(403).json({
        message: "You cannot claim your own item",
      });
    }

    const existing = await ClaimRequest.findOne({
      item: item._id,
      claimant: req.userId,
      status: { $in: ["pending", "approved"] },
    });

    if (existing) {
      return res.status(409).json({
        message: "You already have an active claim for this item",
      });
    }

    const claim = await ClaimRequest.create({
      item: item._id,
      claimant: req.userId,
      finder: item.postedBy,
      proof: proof.trim(),
    });

    return res.status(201).json({
      message: "Claim request submitted",
      claim,
      contactInfo: item.contactInfo,
    });
  } catch (error) {
    next(error);
  }
});

// View claims received by the finder
router.get("/received", authMiddleware, async (req, res, next) => {
  try {
    const claims = await ClaimRequest.find({
      finder: req.userId,
    })
      .populate("item", "title status location state")
      .populate("claimant", "name")
      .sort({ createdAt: -1 })
      .lean();

    return res.json(claims);
  } catch (error) {
    next(error);
  }
});

// Approve or reject a pending claim
router.patch("/:id/review", authMiddleware, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { decision } = req.body || {};

    if (!isValidId(id)) {
      return res.status(400).json({
        message: "Invalid claim ID",
      });
    }

    if (!["approved", "rejected"].includes(decision)) {
      return res.status(400).json({
        message: "Decision must be approved or rejected",
      });
    }

    const claim = await ClaimRequest.findById(id);

    if (!claim) {
      return res.status(404).json({
        message: "Claim request not found",
      });
    }

    if (String(claim.finder) !== String(req.userId)) {
      return res.status(403).json({
        message: "Only the finder can review this request",
      });
    }

    if (claim.status !== "pending") {
      return res.status(409).json({
        message: "Only pending requests can be reviewed",
      });
    }

    const item = await Item.findById(claim.item);

    if (!item || item.state !== "open" || item.claimed) {
      return res.status(409).json({
        message: "The item is no longer available",
      });
    }

    // Conditional update prevents two requests from reviewing
    // the same pending claim at the same time.
    const updatedClaim = await ClaimRequest.findOneAndUpdate(
      {
        _id: id,
        finder: req.userId,
        status: "pending",
      },
      { $set: { status: decision } },
      { new: true, runValidators: true }
    );

    if (!updatedClaim) {
      return res.status(409).json({
        message: "This claim was already reviewed",
      });
    }

    return res.json({
      message: `Claim ${decision}`,
      claim: updatedClaim,
    });
  } catch (error) {
    next(error);
  }
});

// Mark an approved claim as returned
router.patch("/:id/return", authMiddleware, async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { id } = req.params;

    if (!isValidId(id)) {
      return res.status(400).json({
        message: "Invalid claim ID",
      });
    }

    let updatedClaim;

    await session.withTransaction(async () => {
      const claim = await ClaimRequest.findOne({
        _id: id,
        finder: req.userId,
        status: "approved",
      }).session(session);

      if (!claim) {
        const error = new Error(
          "Approved claim not found or already processed"
        );
        error.statusCode = 409;
        throw error;
      }

      // Atomically reserve/close the item for this claimant.
      const updatedItem = await Item.findOneAndUpdate(
        {
          _id: claim.item,
          postedBy: req.userId,
          state: "open",
          claimed: false,
        },
        {
          $set: {
            claimed: true,
            claimedBy: claim.claimant,
            state: "closed",
          },
        },
        {
          new: true,
          session,
          runValidators: true,
        }
      );

      if (!updatedItem) {
        const error = new Error(
          "Item is no longer available for return"
        );
        error.statusCode = 409;
        throw error;
      }

      updatedClaim = await ClaimRequest.findOneAndUpdate(
        {
          _id: claim._id,
          finder: req.userId,
          status: "approved",
        },
        {
          $set: {
            status: "returned",
            returnedAt: new Date(),
          },
        },
        {
          new: true,
          session,
          runValidators: true,
        }
      );

      if (!updatedClaim) {
        const error = new Error(
          "Claim status changed; please retry"
        );
        error.statusCode = 409;
        throw error;
      }
    });

    return res.json({
      message: "Item marked as returned",
      claim: updatedClaim,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({
        message: error.message,
      });
    }

    next(error);
  } finally {
    await session.endSession();
  }
});

module.exports = router;