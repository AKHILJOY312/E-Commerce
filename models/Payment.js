const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
  pay_method: { type: String, enum: ['cod', 'upi', 'wallet', 'card'], required: true },
  total_amount: { type: Number, required: true },
  pay_status: { type: String, enum: ['pending', 'completed', 'failed'], default: 'pending' },
  created_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Payment', paymentSchema);
