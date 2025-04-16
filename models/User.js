const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: false },
  profileImage:{ type: String, required: false },
  phone: { type: String, sparse: true, default: null },
  googleId: {type:String,unique:true ,sparse: true},
  isAdmin: { type: Boolean, default: false },
  wallet: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
