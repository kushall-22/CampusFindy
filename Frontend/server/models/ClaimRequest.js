const mongoose = require('mongoose');

const claimRequestSchema = new mongoose.Schema({
  item: { type: mongoose.Schema.Types.ObjectId, ref: 'Item', required: true },
  claimant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  finder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  proof: { type: String, required: true },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'returned'],
    default: 'pending'
  },
  returnedAt: { type: Date }
}, { timestamps: true });

module.exports = mongoose.model('ClaimRequest', claimRequestSchema);