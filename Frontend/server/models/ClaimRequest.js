const mongoose = require("mongoose");

const claimRequestSchema = new mongoose.Schema(
  {
    item: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Item",
      required: true,
      index: true,
    },

    claimant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    finder: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    proof: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 1000,
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "returned"],
      default: "pending",
      index: true,
    },

    reviewMessage: {
      type: String,
      maxlength: 200,
      default: null,
    },

    returnedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

claimRequestSchema.index({ finder: 1, createdAt: -1 });
claimRequestSchema.index({ item: 1, claimant: 1, status: 1 });

module.exports = mongoose.model(
  "ClaimRequest",
  claimRequestSchema
);