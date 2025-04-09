// models/CouponUsage.js
const mongoose = require('mongoose');

const couponUsageSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  coupon_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Coupon', required: true },
  used_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('CouponUsage', couponUsageSchema);
