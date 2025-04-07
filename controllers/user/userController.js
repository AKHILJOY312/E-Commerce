const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const nodemailer = require("nodemailer");
const { assign } = require("nodemailer/lib/shared");
const passport  = require("passport")
require("dotenv").config();
const Product = require("../../models/Product");
const { generateOtp, sendVerificationEmail, securePassword } = require("../../utils/authUtils");


exports.loadHomePage = async (req, res) => {
  try {
    
    let username = null;
    const user = req.session.username;
    if (user) {
      const userData = await User.findOne({ _id: user._id });
      username = user;
    }

    const newArrivals = await Product.find({
            isDeleted: false,
            status: 'listed',
          })
          .sort({created_at:-1})
            .populate('variants')
            .limit(4); 
    res.render("home", {
       username,
      newArrivals,
      currentActivePage:'home'
      });
  } catch (error) {
    console.error("Home page not found");
    res.status(500).send("Server error");
  }
};

exports.pageNotFound = async (req, res) => {
  try {
    return res.render("pageNotFound",{currentActivePage:' '});
  } catch (error) {
    console.error(" pageNotFound not found");
    res.status(500).send("Server error");
  }
};

exports.googleAuth = passport.authenticate('google', { scope: ['profile', 'email'] });

exports.googleAuthCallback = async (req, res, next) => {
  passport.authenticate("google", async (err, user, info) => {
    if (err) return next(err);
    if (!user) return res.redirect("/login?error=authFailed");

    if (!user.isActive) {
      req.logout(() => {
        return res.redirect("/login?error=blocked");
      });
    } else {
      req.login(user, (err) => {
        if (err) return next(err);
        req.session.isAuthenticated = true;
        req.session.username = user.name;
        req.session.email = user.email;
        req.session.user_id = user._id;
        res.redirect("/");
      });
    }
  })(req, res, next);
};

exports.getLogin = async (req, res) => {
  try {
    if (req.session.username) {
      return res.redirect("/");
    }
    return res.render("auth/login",{ query: req.query });
  } catch (error) {
    console.error(" pageNotFound not found");
    res.status(500).send("Server error");
  }
};
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
console.log('req.body:',req.body)
    const user = await User.findOne({ email });
    console.log('user:',user)
    

    if (!user) {
      req.flash("error", "Invalid username or password");
      console.log("Invalid username or password");
      return res.redirect("/login"); // Redirect to allow flash messages to persist
    }
    if (!user.isActive) {
      req.flash("error", "you have be blocked by admin.");
      console.log("you have be blocked by admin.");
      return res.redirect("/login"); // Redirect to allow flash messages to persist
    }
    if (!user.password) {
      console.log("Google login required for this account");
      req.flash("error", "Please log in using Google");
      return res.redirect("/login");
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      console.log("Incorrect password");
      req.flash("error", "Incorrect password");
      return res.redirect("/login");
    }

    // If password is correct, authenticate the user
    req.session.isAuthenticated = true;
    req.session.username = user.name;
    req.session.email=email;
    req.session.user_id = user._id;

    return res.redirect("/");
  } catch (error) {
    console.error("Login error:", error);
    req.flash("error", "Something went wrong. Please try again.");
    res.redirect("/login");
  }
};

exports.getSignup = async (req, res) => {
  try {
    if (req.session.username || req.session.email) {
      return res.redirect("/");
    }
    return res.render("auth/signup");
  } catch (error) {
    console.error(" pageNotFound not found");
    res.status(500).send("Server error");
  }
};


// User Signup Handler
exports.signupUser = async (req, res) => {
  try {
    console.log(`signupUser is working`);
    const { name, email, phone, password, confirm } = req.body;

    if (password !== confirm) {
      console.log(`Password check failed`);
      return res.redirect("/signup", { message: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`User already exists`);
      req.flash(
        "error",
        "You are already our customer. Click on below button to login"
      );
      return res.redirect("/signup");
    }

    const otp = generateOtp();
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.json({ error: "Failed to send email" });
    }

    req.session.userOtp = otp;
    req.session.userData = { name, email, phone, password };
    req.session.email=email;

    res.render("auth/verify-Otp");
    console.log("OTP sent:", otp);
  } catch (error) {
    console.error("Signup error", error);
    res.redirect("/pageNotFound");
  }
};

// OTP Verification Handler
exports.verifyOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log("Received OTP:", otp);

    if (parseInt(otp) === parseInt(req.session.userOtp)) {
      const userData = req.session.userData;
      const passwordHash = await securePassword(userData.password);

      const newUser = new User({
        name: userData.name || "User",
        email: userData.email,
        phone: userData.phone || "",
        password: passwordHash,
      });

      const savedUser = await newUser.save();

      // ✅ Set session properly
      req.session.user_id = savedUser._id;
      req.session.username = savedUser.name;
      req.session.email = savedUser.email;
      req.session.isAuthenticated = true;

      res.json({ success: true, redirectUrl: "/" });
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
    console.log(req.session.userData);
    const { email } = req.session.userData;
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

exports.logout = (req, res, next) => {
  try {
    
    req.session.destroy((err) => {
      if (err) {
        console.error("Session destruction error:", err);
        
        return res.status(500).send("Failed to logout. Please try again.");
      }

      
      res.clearCookie('yourSessionCookieName', { 
        httpOnly: true,
        secure: true,  
        sameSite: 'Strict' 
      });

     
      res.redirect("/");
    });
  } catch (err) {
    console.error("Logout error:", err);
    return res.redirect("/404page"); //  Consider a more generic error page.
  }
};

exports.LoadForgetPassword = (req, res, next) => {
  try {
    res.render("forgetPassword/email");
  } catch (error) {
    console.error("Error getting forget email page", error);
    res.status(500).json({
      success: false,
      message: "Internal server error,Please try again",
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      req.flash("error", "No account found with this email");
      return res.redirect("/forgetPassword");
    }

    const otp = generateOtp();
    req.session.forgotPasswordOtp = otp;
    req.session.forgotPasswordEmail = email;
    console.log("your otp is:", otp);

    const emailSent = await sendVerificationEmail(email, otp);
    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email",
      });
    }

    res.render("forgetPassword/verify-otp");
  } catch (error) {
    console.error("Forgot password error:", error);
    req.flash("error", "Something went wrong. Please try again.");
    res.redirect("/forgetPassword");
  }
};
exports.ForgotResendOtp = async (req, res) => {
  try {
    console.log( req.session.forgotPasswordEmail);
    const  email  =  req.session.forgotPasswordEmail;
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: "Email not found in session" });
    }

    const otp = generateOtp();
    req.session.forgotPasswordOtp = otp;
    console.log("worjimg");
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
    console.error("Error forgot  resending OTP", error);
    res.status(500).json({
      success: false,
      message: "Internal server error,Please try again",
    });
  }
};

exports.verifyForgotPasswordOtp = async (req, res) => {
  try {
    const { otp } = req.body;
    console.log("check1:", otp);
    if (parseInt(otp) !== parseInt(req.session.forgotPasswordOtp)) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP. Please try again.",
      });
    }
    console.log("check2:", otp);
    // res.render("forgetPassword/reset-password");
    res.json({ success: true, redirectUrl: "/reset-password" });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during OTP verification",
    });
  }
};

exports.resetPassword = async (req, res) => {
  
  try {
    if ( !req.session.forgotPasswordEmail) {
      return res.redirect("/forgetPassword");
    }
    const { password, confirmPassword } = req.body;
    const email = req.session.forgotPasswordEmail;
console.log(req.body,email);
    if (password !== confirmPassword) {
      return res.render("forgetPassword/reset-password", {
        message: "Passwords do not match",
      });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({
        success: false,
        message: "User not found",
      });
    }

    const passwordHash = await securePassword(password);
    user.password = passwordHash;
    await user.save();

    delete req.session.forgotPasswordOtp;
    delete req.session.forgotPasswordEmail;
    req.flash("success", "Password reset successfully");
    if(user.isAdmin){
      
      res.redirect("admin/login");
    }else{
        
        res.redirect("/login");
      }
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during password reset",
    });
  }
};

exports.getResetPassword = async (req, res) => {
  try {
    res.render("forgetPassword/reset-password")
    
  } catch (error) {
    console.error("error get password reset page :", error);
    res.status(500).json({
      success: false,
      message: "An error occurred during password reset",
    });
  }
};
