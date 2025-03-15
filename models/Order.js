const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },
  coupon_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'coupons',
    default: null
  },
  payment_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'payments',
    required: true
  },
  offer_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'offers',
    default: null
  },
  order_items: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'order_items',
    required: true
  }],
  delivery_charge: {
    type: Number,
    default: 0
  },
  delivery_date: {
    type: Date,
    default: null
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['confirmed', 'intransit', 'delivered', 'cancelled'],
    default: 'confirmed'
  },
  total_amount: {
    type: mongoose.Decimal128,
    required: true
  },
  refunded_amount: {
    type: mongoose.Decimal128,
    default: 0.00
  },
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  cancelled_at: {
    type: Date,
    default: null
  },
  cancellation_reason: {
    type: String,
    trim: true
  }
}, { timestamps: true });

module.exports = mongoose.model('orders', OrderSchema);
