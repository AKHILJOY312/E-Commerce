const mongoose = require('mongoose');

const variantSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
  material: { type: String },
  color: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  sku: { type: String, unique: true },
  product_image: [{ type: String }], // Array of image URLs
  quantity: { type: Number, default: 0 },
  isDeleted: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Variant', variantSchema);
