const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const nodemailer = require("nodemailer");
const { assign } = require("nodemailer/lib/shared");
require("dotenv").config();

exports.loadHomePage = async (req, res) => {
  try {
    const user = req.session.username;
    console.log(user);
    if (user) {
      const userData = await User.findOne({ _id: user._id });
      res.render("home", { username: user });
    } else {
      res.render("home", { username: null });
    }
  } catch (error) {
    console.error("Home page not found");
    res.status(500).send("Server error");
  }
};

exports.pageNotFound = async (req, res) => {
  try {
    return res.render("pageNotFound");
  } catch (error) {
    console.error(" pageNotFound not found");
    res.status(500).send("Server error");
  }
};

exports.getLogin = async (req, res) => {
  try {
    return res.render("login");
  } catch (error) {
    console.error(" pageNotFound not found");
    res.status(500).send("Server error");
  }
};
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log(req.body);

    const user = await User.findOne({ email });
    console.log(email);

    if (!user) {
      req.flash("error", "Invalid username or password");
      console.log("Invalid username or password");
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

    return res.redirect("/");
  } catch (error) {
    console.error("Login error:", error);
    req.flash("error", "Something went wrong. Please try again.");
    res.redirect("/login");
  }
};

exports.getSignup = async (req, res) => {
  try {
    return res.render("signup");
  } catch (error) {
    console.error(" pageNotFound not found");
    res.status(500).send("Server error");
  }
};

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Function to send OTP email
async function sendVerificationEmail(email, otp) {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      port: 587,
      secure: false,
      requireTLS: true,
      auth: {
        user: process.env.NODEMAILER_Email,
        pass: process.env.NODEMAILER_Password,
      },
    });

    const info = await transporter.sendMail({
      from: process.env.NODEMAILER_Email,
      to: email,
      subject: "Verify your email",
      text: `${otp} is your OTP, Please input`,
      html: `<b>Your OTP: ${otp}</b>`,
    });

    return info.accepted.length > 0;
  } catch (error) {
    console.error("Error sending email", error);
    return false;
  }
}

// Secure password hashing function
const securePassword = async (password) => {
  try {
    return await bcrypt.hash(password, 10);
  } catch (error) {
    console.error("Error hashing password:", error);
    throw new Error("Password hashing failed");
  }
};

// User Signup Handler
exports.signupUser = async (req, res) => {
  try {
    console.log(`signupUser is working`);
    const { name, email,phone, password, confirm } = req.body;

    if (password !== confirm) {
      console.log(`Password check failed`);
      return res.render("signup", { message: "Passwords do not match" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`User already exists`);
      req.flash("error", "User already exists.");
      return res.render("signup", { error: "Invalid username or password" });
    }

    const otp = generateOtp(); // Ensure `generateOtp()` function exists
    const emailSent = await sendVerificationEmail(email, otp);

    if (!emailSent) {
      return res.json({ error: "Failed to send email" });
    }

    req.session.userOtp = otp;
    req.session.userData = { name, email,phone, password };

    res.render("verify-Otp");
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

      await newUser.save();
      req.session.user = newUser.id;
      req.session.username = userData.name;

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
      res
        .status(500)
        .json({
          success: false,
          message: "Failed to send OTP, please try again.",
        });
    }
  } catch (error) {
    console.error("Error resending OTP", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Internal server error,Please try again",
      });
  }
};

exports.logout = (req, res, next) => {
  req.logout(function (err) {
    if (err) {
      return next(err);
    }
    req.session.destroy(() => {
      res.redirect("/");
    });
  });
};
