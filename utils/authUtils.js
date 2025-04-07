const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const { assign } = require("nodemailer/lib/shared");
require("dotenv").config();




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


module.exports = { generateOtp, sendVerificationEmail, securePassword };