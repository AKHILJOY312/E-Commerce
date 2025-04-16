// paymentController.js
 const User = require("../../models/User");
const Razorpay = require('razorpay');
const crypto = require('crypto');
const dotenv = require("dotenv").config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

exports.createOrder = async (req, res) => {
    try {
        const amount = req.body.amount; // in paisa
console.log("it is working", amount);
console.log('req.body for creaing an oret',req.body);
        const options = {
            amount: amount*100,
            currency: "INR",
            receipt: "receipt_order_" + Date.now(),
        };

        const order = await razorpay.orders.create(options);
        console.log("Order created successfully:", order);
        res.status(200).json({ success: true, order });
    } catch (err) {
        res.status(500).json({ success: false, msg: err.message });
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
      req.flash('error', 'Invalid payment signature');
      return res.redirect('/wallet');
    }

    // Step 3: Find user and update wallet
    
    const user = await User.findById(user_id);

    if (!user) {
      console.error(" [verifyPayment] User not found!");
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
    console.error(" [verifyPayment] Error occurred:", error.message, error.stack);
    req.flash('error', 'Failed to add money');
    res.redirect('/wallet');
  }
};
