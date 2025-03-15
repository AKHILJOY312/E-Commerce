const mongoose = require('mongoose');

const WishlistSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'users',
    required: true
  },
  product_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'products',
    required: true
  }],
  created_at: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('wishlists', WishlistSchema);
