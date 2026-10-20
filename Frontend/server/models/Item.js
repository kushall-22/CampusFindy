const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  category: {
    type: String,
    default: 'other'
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['lost', 'found'],
    required: true
  },
  
  location: {
    type: String,
    required: true
  },
  contactInfo: {
  type: String,
  required: true,
  select: false
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  claimed: {
    type: Boolean,
    default: false
  },
  claimedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  verificationQuestion: {
    type: String,
    default: null
  },
  verificationAnswer: {
  type: String,
  default: null,
  select: false
  }
}, { timestamps: true });

module.exports = mongoose.model('Item', itemSchema);