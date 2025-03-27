const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  brand: { type: String },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  variants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Variant' }], 
  isDeleted: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
