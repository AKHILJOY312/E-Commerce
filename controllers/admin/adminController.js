const User = require("../../models/User");
const Product = require('../../models/Product');
const Category =require('../../models/Category');
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

exports.loadLogin = (req, res) => {
  if (req.session.admin) {
    return res.redirect("/admin");
  }
  res.render("adminLogin", { message: null });
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
  
    const admin = await User.findOne({ email, isAdmin: true });

    if (!admin) {
      return res.render("adminLogin", { message: "Invalid email or password" });
    }

    const passwordMatch = await bcrypt.compare(password, admin.password);
    if (!passwordMatch) {
      return res.render("adminLogin", { message: "Invalid  password." });
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
      return res.redirect('/admin/login');
    }

    
    const categoryCount = await Category.countDocuments({ status: 'listed',isDeleted:false }); 
    const totalUsers = await User.countDocuments({ isActive: true }); 
    const totalProducts = await Product.countDocuments({ isDeleted: false }); 

    
    res.render('adminDashboard', {
      categoryCount,
      totalUsers,
      totalProducts,
      messages: req.flash() 
    });
  } catch (error) {
    console.error('Cannot get admin dashboard:', error);
    req.flash('error', 'Error loading dashboard.');
    return res.redirect('/404page'); 
  }
};

exports.pageNotFound = async (req, res) => {
res.render('404page');
};


exports.adminLogout = async (req, res) => {
  try {
    if (req.session.admin) {
      delete req.session.admin; // Remove only the admin session
    }
    res.redirect("/admin/login");
  } catch (error) {
    console.log("Logout error:", error);
    res.redirect("/404page"); 
  }
};

