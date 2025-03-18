const bcrypt = require("bcryptjs");
const User = require("../../models/User");
const nodemailer = require("nodemailer");
require("dotenv").config();

exports.loadHomePage = async (req, res) => {
  try {
    return res.render("home");
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

exports.loginUser = async (req, res) => {
  try {
    return res.render("login");
  } catch (error) {
    console.error(" pageNotFound not found");
    res.status(500).send("Server error");
  }
};

exports.getUser = async (req, res) => {
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
      const { email, password, confirm } = req.body;
  
      if (password !== confirm) {
        console.log(`Password check failed`);
        return res.render("signup", { message: "Passwords do not match" });
      }
  
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        console.log(`User already exists`);
        return res.render("signup", { message: "User already exists" });
      }
  
      const otp = generateOtp(); // Ensure `generateOtp()` function exists
      const emailSent = await sendVerificationEmail(email, otp);
  
      if (!emailSent) {
        return res.json({ error: "Failed to send email" });
      }
  
      req.session.userOtp = otp;
      req.session.userData = { email, password };
  
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
  
        res.json({ success: true, redirectUrl: "/" });
      } else {
        res.status(400).json({ success: false, message: "Invalid OTP. Please try again." });
      }
    } catch (error) {
      console.error("Error verifying the OTP:", error);
      res.status(400).json({ success: false, message: "An error occurred" });
    }
  };
exports.resendOtp =async (req,res)=>{
    try {
        const {email}=req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"});
        }

        const otp= generateOtp();
        req.session.userOtp=otp;
        const emailSend =await sendVerificationEmail(email,otp);
        if(emailSend){
            console.log("Resend Otp:",otp);
            res.status(200).json({success:true,message:"OTP Resend successfully"})
        }else{
            res.status(500).json({success:false,message:"Failed to send OTP, please try again."})
        }
    } catch (error) {
        console.error("Error resending OTP",error);
        res.status(500).json({success:false,message:"Internal server error,Please try again"});
    }
}