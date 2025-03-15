const mongoose = require('mongoose');

const WalletTransactionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },
  order_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'orders',
    default: null
  },
  transaction_type: {
    type: String,
    enum: ['deposit', 'purchase', 'refund', 'referral'],
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  balance: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'pending'
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

module.exports = mongoose.model('wallet_transactions', WalletTransactionSchema);
