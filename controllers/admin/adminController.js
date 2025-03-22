const User = require("../../models/User");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

exports.loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin/dashboard");
  }
  res.render("adminLogin", { message: null });
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
  
    const admin = await User.findOne({ email, isAdmin: true });

    if (!admin) {
      return res.render("adminLogin", { message: "Invalid email or password." });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      return res.render("adminLogin", { message: "Invalid email or password." });
    }

    // Store admin session with ID for better tracking
    req.session.admin = admin._id;

    return res.redirect("/admin");
  } catch (error) {
    console.error("Admin login error:", error);
    return res.redirect("/404page");
  }
};

exports.loadDashboard = async (req, res) => {
  try {
    if (!req.session.admin) {
      return res.redirect("/admin/login");
    }
    res.render("adminDashboard");
  } catch (error) {
    console.error("Cannot get admin dashboard:", error);
    return res.redirect("/404page");
  }
};

exports.pageNotFound = async (req, res) => {
res.render('404page');
};


exports.logout = async (req, res) => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.log("Error destroying session:", err);
        return res.status(500).send("Logout failed");
      }
      res.redirect("/admin"); 
    });
  } catch (error) {
    console.log("Logout error:", error);
    res.redirect("/404page"); 
  }
};
