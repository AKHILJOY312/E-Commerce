const mongoose = require('mongoose');

const offerSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  code: { type: String, required: true },
  description: { type: String },
  discount_percentage: { type: Number, required: true },
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },
  status: { type: Boolean, default: true }
});

module.exports = mongoose.model('Offer', offerSchema);
