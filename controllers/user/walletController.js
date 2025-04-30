const WalletTransaction = require('../../models/WalletTransaction');
const User = require('../../models/User');
const express = require('express');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const dotenv = require("dotenv").config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});


// Add money to wallet
exports.addMoney = async (req, res) => {
  const { user_id, amount } = req.body;
 

  try {
    // Validate input
    if (!user_id || !amount || amount <= 0) {
      return res.status(400).json({ error: 'Invalid input' });
    }

    // Verify Razorpay credentials
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      console.error('Razorpay credentials missing');
      return res.status(500).json({ error: 'Server configuration error: Razorpay credentials missing' });
    }

    const options = {
      amount: amount * 100, // Convert to paise
      currency: 'INR',
      receipt: `wallet_${Date.now()}`,
    };

    // Create Razorpay order
    const order = await razorpay.orders.create(options);
    if (!order) {
      return res.status(500).json({ error: 'Failed to create order' });
    }

    
    res.json({ id: order.id, amount: order.amount, currency: order.currency });
  } catch (error) {
    console.error('Error creating Razorpay order:', error);
    if (error.response && error.response.body) {
      console.error('Razorpay API error:', error.response.body);
    }
    res.status(500).json({ error: 'Failed to initiate payment', details: error.message || 'Unknown error' });
  }
};

// Verify payment and credit wallet
exports.verifyPayment = async (req, res) => {
  const { user_id, amount, razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
  

  try {
    // Step 1: Generate HMAC signature using Razorpay key
    const generatedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

  

    // Step 2: Validate signature
    if (generatedSignature !== razorpay_signature) {
      console.warn("❌ [verifyPayment] Signature mismatch! Payment verification failed.");
      req.flash('error', 'Invalid payment signature');
      return res.redirect('/wallet');
    }

    // Step 3: Find user and update wallet
   
    const user = await User.findById(user_id);

    if (!user) {
      console.error("❌ [verifyPayment] User not found!");
      req.flash('error', 'User not found');
      return res.redirect('/wallet');
    }

    const newBalance = user.wallet + parseFloat(amount);
    
    user.wallet = newBalance;
    await user.save();

    // Step 4: Log transaction
    const txn = await WalletTransaction.create({
      user_id,
      amount,
      balance: newBalance,
      transaction_type: 'deposit',
      description: 'Added money via Razorpay',
      razorpay_order_id, 
      status: 'completed',
    });

    req.flash('success', `₹${amount} added to wallet successfully`);
    res.redirect('/wallet');
  } catch (error) {
    console.error("💥 [verifyPayment] Error occurred:", error.message, error.stack);
    req.flash('error', 'Failed to add money');
    res.redirect('/wallet');
  }
};


// Get wallet details
exports.getWallet = async (req, res) => {
  try {
    if (!req.session.user_id) {
      req.flash('error', 'Please log in to view your wallet');
      return res.redirect('/login');
    }

    const user = await User.findById(req.session.user_id);
    if (!user) {
      req.flash('error', 'User not found');
      return res.redirect('/login');
    }

    // Pagination logic
    const page = parseInt(req.query.page) || 1;
    const limit = 10; // Number of transactions per page
    const skip = (page - 1) * limit;

    const totalTransactions = await WalletTransaction.countDocuments({ user_id: req.session.user_id });
    const transactions = await WalletTransaction.find({ user_id: req.session.user_id })
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(limit);

    const totalPages = Math.ceil(totalTransactions / limit);

    res.render('payment/wallet', {
      user,
      transactions,
      currentPage: page,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      messages: req.flash(),
      currentActivePage: '',
    });
  } catch (error) {
    console.error('Error loading wallet:', error);
    req.flash('error', 'Failed to load wallet');
    res.redirect('/login');
  }
};
