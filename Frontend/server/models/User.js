const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ["student", "admin"],
    default: "student"
  },
  status: {
    type: String,
    enum: ["active", "suspended"],
    default: "active"
  },
    emailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationCodeHash: {
    type: String,
    select: false
  },
  emailVerificationExpires: {
    type: Date,
    select: false
  },
  emailVerificationAttempts: {
    type: Number,
    default: 0,
    select: false
  },
  passwordResetTokenHash: {
    type: String,
    select: false
  },
  passwordResetExpires: {
    type: Date,
    select: false
  },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);