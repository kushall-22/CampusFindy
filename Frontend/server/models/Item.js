const mongoose = require("mongoose");

const itemSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
    },

    category: {
      type: String,
      trim: true,
      maxlength: 60,
      default: "other",
    },

    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 2000,
    },

    status: {
      type: String,
      enum: ["lost", "found"],
      required: true,
    },

    location: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },

    contactInfo: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
      select: false,
    },

    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    claimed: {
      type: Boolean,
      default: false,
    },

    state: {
      type: String,
      enum: ["open", "closed", "removed"],
      default: "open",
    },

    claimedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedClaim: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClaimRequest",
      default: null,
      select: false,
    },

    verificationQuestion: {
      type: String,
      trim: true,
      maxlength: 300,
      default: null,
    },

    verificationAnswer: {
      type: String,
      trim: true,
      maxlength: 200,
      default: null,
      select: false,
    },
  },
  { timestamps: true }
);

itemSchema.index({ state: 1, claimed: 1, createdAt: -1 });
itemSchema.index({ postedBy: 1, createdAt: -1 });

module.exports = mongoose.model("Item", itemSchema);