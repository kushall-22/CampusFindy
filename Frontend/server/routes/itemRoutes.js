const express = require("express");
const Item = require("../models/Item");
const ClaimRequest = require("../models/ClaimRequest");
const authMiddleware = require("../middleware/authMiddleware");
const isValidId = require("../utils/isValidId");

const router = express.Router();

const cleanString = (value, maxLength) =>
  typeof value === "string" &&
  value.trim().length > 0 &&
  value.trim().length <= maxLength;

// Create an item
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const {
      title,
      description,
      status,
      category,
      location,
      contactInfo,
      verificationQuestion,
      verificationAnswer,
    } = req.body || {};

    if (
      !cleanString(title, 120) ||
      !cleanString(description, 2000) ||
      !cleanString(location, 150) ||
      !cleanString(contactInfo, 200)
    ) {
      return res.status(400).json({
        message: "Invalid title, description, location or contact information",
      });
    }

    if (!["lost", "found"].includes(status)) {
      return res.status(400).json({
        message: "Status must be lost or found",
      });
    }

    if (
      category !== undefined &&
      (typeof category !== "string" || category.length > 60)
    ) {
      return res.status(400).json({
        message: "Invalid category",
      });
    }

    if (
      verificationQuestion != null &&
      (typeof verificationQuestion !== "string" ||
        verificationQuestion.trim().length > 300)
    ) {
      return res.status(400).json({
        message: "Invalid verification question",
      });
    }

    if (
      verificationAnswer != null &&
      (typeof verificationAnswer !== "string" ||
        verificationAnswer.trim().length > 200)
    ) {
      return res.status(400).json({
        message: "Invalid verification answer",
      });
    }

    const item = await Item.create({
      title: title.trim(),
      description: description.trim(),
      status,
      category:
        typeof category === "string" && category.trim()
          ? category.trim()
          : "other",
      location: location.trim(),
      contactInfo: contactInfo.trim(),
      postedBy: req.userId,
      verificationQuestion:
        verificationQuestion?.trim() || null,
      verificationAnswer:
        verificationAnswer?.trim() || null,
    });

    // Never return private contact or verification answers.
    const safeItem = item.toObject();
    delete safeItem.contactInfo;
    delete safeItem.verificationAnswer;

    return res.status(201).json({
      message: "Item posted successfully",
      item: safeItem,
    });
  } catch (error) {
    next(error);
  }
});

// Browse public items
router.get("/", async (req, res, next) => {
  try {
    const items = await Item.find({
      state: "open",
      claimed: false,
      approvedClaim: null,
    })
      .select("-contactInfo -verificationAnswer -verificationQuestion")
      .populate("postedBy", "name")
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json(items);
  } catch (error) {
    next(error);
  }
});

// Securely release contact information after an approved claim.
router.get(
  "/:id/contact",
  authMiddleware,
  async (req, res, next) => {
    try {
      if (!isValidId(req.params.id)) {
        return res.status(400).json({
          message: "Invalid item ID",
        });
      }

        const item = await Item.findById(req.params.id)
          .select("+contactInfo +approvedClaim");

      if (!item) {
        return res.status(404).json({
          message: "Item not found",
        });
      }

      const claim = await ClaimRequest.findOne({
        item: item._id,
        claimant: req.userId,
        status: { $in: ["approved", "returned"] },
      }).select("_id");

      if (
        !claim ||
        (item.approvedClaim &&
          String(item.approvedClaim) !== String(claim._id))
      ) {
        return res.status(403).json({
          message: "An approved claim is required",
        });
      }

      return res.json({
        contactInfo: item.contactInfo,
      });
    } catch (error) {
      next(error);
    }
  }
);

// IMPORTANT:
// There is intentionally NO PATCH /:id/claim route.
// Claims must go through POST /api/claims/:itemId.

module.exports = router;