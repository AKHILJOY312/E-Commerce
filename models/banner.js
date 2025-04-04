// models/Banner.js (example)
const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
  image: { type: String, required: true }, // URL of the background image
  subTitle: { type: String, default: 'Summer Collection' },
  title: { type: String, required: true },
  description: { type: String, required: true },
  link: { type: String, default: '#' }, // URL for "Shop now" button
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Banner', bannerSchema);