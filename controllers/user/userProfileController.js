const User = require("../../models/User");
const { generateOtp, sendVerificationEmail, securePassword } = require("../../utils/authUtils");
const bcrypt = require("bcryptjs");

const Order = require("../../models/Order");
const Address= require("../../models/Addresses");
const Coupon = require("../../models/Coupon");
const mongoose = require('mongoose');
const CouponUsage = require("../../models/CouponUsage");


exports.loadProfile = async (req, res) => {
  try {
    const userEmail = req.session.email;
    if (!userEmail) {
      console.error("No user found in session");
      return res.redirect('/login');
    }
    const userData = await User.findOne({ email: userEmail });
    if (!userData) {
      console.error("User not found in database");
      return res.redirect('/login');
    }
   
    // Generate referral code if user doesn't have one
    if (!userData.referralCode) {
      const crypto = require('crypto');
      const randomString = crypto.randomBytes(3).toString('hex').toUpperCase();
      userData.referralCode = `SOLO${randomString}`;
      await userData.save();
    }
    
    // Populate referrals data for display
    await userData.populate('referrals', 'name email created_at');
    
    // Calculate referral statistics
    const totalReferrals = userData.referrals ? userData.referrals.length : 0;
    const earnedRewards = userData.referralRewards ? 
      userData.referralRewards.reduce((total, reward) => 
        reward.status === 'credited' ? total + reward.amount : total, 0) : 0;
    const pendingRewards = userData.referralRewards ? 
      userData.referralRewards.reduce((total, reward) => 
        reward.status === 'pending' ? total + reward.amount : total, 0) : 0;

    const recentOrders = await Order.find({ user_id: userData._id })
      .sort({ created_at: 1 })
      .limit(5)
      .lean();
    const orderCount = await Order.countDocuments({ user_id: userData._id });
   
    const addresses = await Address.find({ user_id: userData._id }).lean();
   
    const currentDate = new Date();
    const activeCoupons = await Coupon.find({
      status: true,
      is_deleted: false,
      start_date: { $lte: currentDate },
      end_date: { $gte: currentDate }
    }).lean();
   
    const usedCoupons = await CouponUsage.find({
      user_id: userData._id
    }).distinct('coupon_id');
   
    const availableCoupons = activeCoupons.filter(coupon => {
      const hasUsed = usedCoupons.some(usedId =>
        usedId.toString() === coupon._id.toString()
      );
      
      const reachedLimit = coupon.used_count >= coupon.usage_limit;
      
      return !hasUsed && !reachedLimit;
    });

    res.render("userProfile/profile", {
      currentActivePage: '',
      user: {
        name: userData.name,
        email: userData.email,
        phone: userData.phone || null,
        profileImage: userData.profileImage || "/img/profiledemo.jpg",
        created_at: userData.created_at,
        updated_at: userData.updated_at,
        isActive: userData.isActive,
        // Add referral information to be passed to the view
        referralCode: userData.referralCode,
        referrals: userData.referrals || [],
        referralRewards: userData.referralRewards || [],
        totalReferrals: totalReferrals,
        earnedRewards: earnedRewards,
        pendingRewards: pendingRewards
      },
      recentOrders,
      orderCount,
      addresses,
      availableCoupons
    });
  } catch (error) {
    console.error("Error loading Profile page", error);
    res.redirect('/');
  }
};


exports.loadEditProfile = async (req, res) => {
    try {
        const email = req.session.email;
        const user = await User.findOne({ email });
    
        if (!user) {
          return res.redirect("/login");
        }
    
        res.render("userProfile/edit-profile", {
          user: {
            name: user.name,
            phone:user.phone,
            profileImage: user.profileImage
          },
          message: req.flash("message") ,
          currentActivePage:""
        });
      } catch (error) {
        console.error("Error loading edit profile page:", error);
        res.redirect("/user/profile");
      }
};

exports.updateProfile = async (req, res) => {
  try {
    const email = req.session.email;
    const user = await User.findOne({ email });

    if (!user) {
      return res.redirect("/login");
    }

   

    const { name } = req.body;
    user.name = name || user.name;

    if (req.file) {
      const imagePath = "/uploads/profile/" + req.file.filename;
      user.profileImage = imagePath;
    }

    user.updated_at = Date.now();
    await user.save();
    
    req.flash("success", "Profile updated successfully");
    res.redirect("/user/profile");
  } catch (error) {
    console.error("Error updating profile:", error);
    req.flash("error", "Error updating profile");
    res.redirect("/user/edit-profile");
  }
  };

  exports.getOtp = async (req, res) => {
    try {
      console.log(`getOtp working`);
      const email=req.session.email;
  const type=req.query.type;
      const otp = generateOtp();
      const emailSent = await sendVerificationEmail(email, otp);
  
      if (!emailSent) {
        return res.json({ error: "Failed to send email" });
      }
  
      req.session.userOtp = otp;
      
      res.render("userProfile/otp",{type,currentActivePage:""});
      console.log("OTP sent:", otp);
    } catch (error) {
      console.error("Signup error", error);
      res.redirect("/pageNotFound");
    }
  };
  
  // OTP Verification Handler
  exports.verifyOtp = async (req, res) => {
    try {
      const { otp,type } = req.body;
    
      console.log("Received OTP:", otp);
  
      if (parseInt(otp) === parseInt(req.session.userOtp)) {
        
       if(type==="password"){
        res.json({ success: true, redirectUrl: "/user/edit-password" });
       }else if(type==="email"){
        res.json({ success: true, redirectUrl: "/user/change-email" });
       }else{
        res.json({ success: true, redirectUrl: "/user/edit-phone" });
       }
        
      } else {
        res
          .status(400)
          .json({ success: false, message: "Invalid OTP. Please try again." });
      }
    } catch (error) {
      console.error("Error verifying the OTP:", error);
      res.status(400).json({ success: false, message: "An error occurred" });
    }
  };
  
  exports.resendOtp = async (req, res) => {
    try {
      
      const  email  = req.session.email;
      if (!email) {
        return res
          .status(400)
          .json({ success: false, message: "Email not found in session" });
      }
  
      const otp = generateOtp();
      req.session.userOtp = otp;
      const emailSend = await sendVerificationEmail(email, otp);
      if (emailSend) {
        console.log("Resend Otp:", otp);
        res
          .status(200)
          .json({ success: true, message: "OTP Resend successfully" });
      } else {
        res.status(500).json({
          success: false,
          message: "Failed to send OTP, please try again.",
        });
      }
    } catch (error) {
      console.error("Error resending OTP", error);
      res.status(500).json({
        success: false,
        message: "Internal server error,Please try again",
      });
    }
  };


  exports.editPassword = async (req, res) => {
    try {
     res.render("userProfile/edit-password",{currentActivePage:""})
    } catch (error) {
      console.error("Error verifying the OTP:", error);
      res.status(400).json({ success: false, message: "An error occurred" });
    }
  };

  exports.updatePassword = async (req, res) => {
    try {
      
      const email = req.session.email;
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ success: false, message: 'User not found' });
  
      const { currentPassword, newPassword } = req.body;
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return res.json({ success: false, message: 'Incorrect current password' });
  
      user.password = await bcrypt.hash(newPassword, 10);
      user.updated_at = Date.now();
      await user.save();
  
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating password:', error);
      res.status(500).json({ success: false, message: 'Failed to update password' });
    }
  };

  exports.getEditEmail = async (req,res)=>{
try {
  const email = req.session.email;
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ success: false, message: 'User not found' });

  res.render("userProfile/edit-email",{
    currentActivePage:'',
    user
  });
} catch (error) {
  console.error("Error loading email edit page:",error);
res.redirect("/");
}

  }
  exports.editEmail = async (req, res) => {
    try {
      const { newEmail } = req.body;
      console.log("New Email from AJAX:", newEmail);
  req.session.newEmail=newEmail;
      // Here you would typically:
      // 1. Validate if new email already exists
      // 2. Send verification OTP or mail
      // 3. Temporarily store the new email and proceed to OTP
  
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error updating email:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  };

  exports.changeEmail =async (req,res)=>{
    try {
      const userId = req.session.user_id;
     
      newEmail=req.session.newEmail;
    if (!newEmail) {
      return res.status(400).json({ success: false, message: 'New email is required.' });
    }

    // Check if the email is already taken
    const existingUser = await User.findOne({ email: newEmail });
    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email already in use.' });
    }

    // Update the email
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { email: newEmail },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    req.session.email=newEmail;
    res.redirect("/user/profile");
    } catch (error) {
      console.error("Error swap  email:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  }
  exports.getPhone =async (req,res)=>{
    try {
      const email = req.session.email;
      const user = await User.findOne({ email });
      if (!user) return res.status(401).json({ success: false, message: 'User not found' });

      res.render("userProfile/phone",{currentActivePage:"",user})
    } catch (error) {
      console.error("loading phone page failed:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  }

  exports.updatePhone =async (req,res) =>{
    try {
      const email = req.session.email;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ success: false, message: 'User not found' });

    const { newMobile } = req.body;

    
    const existingUser = await User.findOne({ phone: newMobile });
    if (existingUser && existingUser.email !== user.email) {
      return res.json({ success: false, message: 'Mobile number is already in use by another account.' });
    }

    user.phone = newMobile;
    user.updated_at = Date.now();
    await user.save();

    res.json({ success: true });
      
    } catch (error) {
      console.error("Error updating the phone number:", error);
      res.status(500).json({ success: false, message: "Internal Server Error" });
    }
  }

  exports.addAddress = async (req, res) => {
    try {
      const userId = req.user._id; // Assuming you have user auth middleware
      const newAddressData = {
        user_id: userId,
        apartment: req.body.apartment,
        building: req.body.building,
        street: req.body.street,
        city: req.body.city,
        state: req.body.state,
        country: req.body.country,
        zip_code: req.body.zip_code,
        is_default: req.body.is_default || false
      };
  
      // If the new address is set as default, unset default from all other addresses
      if (newAddressData.is_default) {
        await Address.updateMany(
          { user_id: userId, _id: { $ne: newAddressData._id } },
          { $set: { is_default: false } }
        );
      }
  
      const newAddress = new Address(newAddressData);
      const savedAddress = await newAddress.save();
  
      res.status(201).json({ success: true, savedAddress });
    } catch (error) {
      console.error("Error adding address:", error);
      res.status(400).json({ error: error.message });
    }
  };

  // Edit Address
  exports.editAddress = async (req, res) => {
    try {
      const addressId = req.params.id;
      const userId = req.user._id; // Assuming you have user auth middleware
      const updatedData = {
        apartment: req.body.apartment,
        building: req.body.building,
        street: req.body.street,
        city: req.body.city,
        state: req.body.state,
        country: req.body.country,
        zip_code: req.body.zip_code,
        is_default: req.body.is_default || false,
        updated_at: Date.now()
      };
  
      // If this address is set as default, unset default from all other addresses
      if (updatedData.is_default) {
        await Address.updateMany(
          { user_id: userId, _id: { $ne: addressId } },
          { $set: { is_default: false } }
        );
      }
  
      const updatedAddress = await Address.findByIdAndUpdate(addressId, updatedData, { new: true });
      if (!updatedAddress) {
        return res.status(404).json({ error: "Address not found" });
      }
  
      res.status(200).json({ success: true, updatedAddress });
    } catch (error) {
      console.error("Error updating address:", error);
      res.status(400).json({ error: error.message });
    }
  };

// Delete Address
exports.deleteAddress = async (req, res) => {
  try {
    const addressId = req.params.id;
    const deletedAddress = await Address.findByIdAndDelete(addressId);
    if (!deletedAddress) {
      return res.status(404).json({ error: "Address not found" });
    }
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};