const mongoose = require('mongoose');

const WishlistSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },
  items: [{
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'products',
      required: true
    },
    variant_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'variants',
      required: true
    },
    added_at: {
      type: Date,
      default: Date.now
    }
  }],
  created_at: {
    type: Date,
    default: Date.now
  }
});


module.exports = mongoose.model('wishlists', WishlistSchema);
