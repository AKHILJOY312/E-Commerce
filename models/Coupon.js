const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },
  discount_percentage: { type: Number, required: true },
  usage_limit: { type: Number, default: 1 },
  start_date: { type: Date, required: true },
  end_date: { type: Date, required: true },
  status: { type: Boolean, default: true }
});

module.exports = mongoose.model('Coupon', couponSchema);
