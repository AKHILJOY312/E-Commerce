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
  referralCode: { type: String, unique: true }, // Unique code for referrals
  hasReceivedReferralReward: { type: Boolean, default: false },
  referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }, // Who referred this user
  referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], // Users referred by this user
  referralRewards: [
    {
      amount: { type: Number, default: 0 }, // Reward amount 
      status: { type: String, enum: ['pending', 'credited'], default: 'pending' },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  isActive: { type: Boolean, default: true },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
