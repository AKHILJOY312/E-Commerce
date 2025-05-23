const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String },
  status: { type: String, enum: ['listed', 'unlisted'], default: 'unlisted' },
  isDeleted: { type: Boolean, default: false },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Category', categorySchema);
