const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema({
  code: { type: String, required: true, unique: true },

  discount_type: {
    type: String,
    enum: ['percentage', 'fixed'],
    default: 'percentage'
  },

  discount_value: {
    type: Number,
    required: true,
    min: 1
  },

  usage_limit: {
    type: Number,
    default: 1
  },

  used_count: {
    type: Number,
    default: 0
  },

  limit_per_user: {
    type: Number,
    default: 1
  },

  min_order_value: {
    type: Number,
    default: 0
  },

  applicable_products: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product'
  }],

  applicable_categories: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category'
  }],

  start_date: {
    type: Date,
    required: true
  },

  end_date: {
    type: Date,
    required: true
  },

  status: {
    type: Boolean,
    default: true
  },

  is_deleted: {
    type: Boolean,
    default: false
  },

  created_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }

}, {
  timestamps: true
});
module.exports = mongoose.model('Coupon', couponSchema);
