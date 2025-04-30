const User = require("../../models/User");
const Product = require('../../models/Product');
const Category =require('../../models/Category');
const Order =require('../../models/Order');
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
   
    const categoryCount = await Category.countDocuments({ status: 'listed', isDeleted: false });
    const totalUsers = await User.countDocuments({ isActive: true });
    const totalProducts = await Product.countDocuments({ isDeleted: false });
    const totalOrders = await Order.countDocuments({ status: "confirmed" });
    
    // Get monthly revenue data for the current year
    const currentYear = new Date().getFullYear();
    const monthlyRevenueData = await getMonthlyRevenueForYear(currentYear);
    
    // Get daily revenue data for current month
    const currentMonth = new Date().getMonth() + 1; // JavaScript months are 0-indexed
    const dailyRevenueData = await getDailyRevenueForMonth(currentYear, currentMonth);
    
    // Get yearly revenue data for the past 5 years
    const yearlyRevenueData = await getYearlyRevenue(5);

    //payment
    const dailyPaymentStats = await getPaymentMethodStats("daily");
    const monthlyPaymentStats = await getPaymentMethodStats("monthly");
    const yearlyPaymentStats = await getPaymentMethodStats("yearly");


    const topSellingProducts = {
      daily: await getTopSellingStats("products", "daily"),
      monthly: await getTopSellingStats("products", "monthly"),
      yearly: await getTopSellingStats("products", "yearly")
    };
    
    const topSellingCategories = {
      daily: await getTopSellingStats("categories", "daily"),
      monthly: await getTopSellingStats("categories", "monthly"),
      yearly: await getTopSellingStats("categories", "yearly")
    };
    
    const topSellingBrands = {
      daily: await getTopSellingStats("brands", "daily"),
      monthly: await getTopSellingStats("brands", "monthly"),
      yearly: await getTopSellingStats("brands", "yearly")
    };
    
    res.render('adminDashboard', {
      categoryCount,
      totalUsers,
      totalProducts,
      totalOrders,
      monthlyRevenueData: JSON.stringify(monthlyRevenueData),
      dailyRevenueData: JSON.stringify(dailyRevenueData),
      yearlyRevenueData: JSON.stringify(yearlyRevenueData),
      dailyPaymentStats: JSON.stringify(dailyPaymentStats),
      monthlyPaymentStats: JSON.stringify(monthlyPaymentStats),
      yearlyPaymentStats: JSON.stringify(yearlyPaymentStats),
      topSellingProducts: JSON.stringify(topSellingProducts),
      topSellingCategories: JSON.stringify(topSellingCategories),
      topSellingBrands: JSON.stringify(topSellingBrands),
      messages: req.flash()
    });
  } catch (error) {
    console.error('Cannot get admin dashboard:', error);
    req.flash('error', 'Error loading dashboard.');
    return res.redirect('/404page');
  }
};

// Add these helper functions to your controller file

// Function to get monthly revenue data for a specific year
async function getMonthlyRevenueForYear(year) {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31, 23, 59, 59);
  
  const monthlyData = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $in: ["confirmed", "intransit", "delivered"] }
      }
    },
    {
      $group: {
        _id: { $month: "$createdAt" },
        revenue: { $sum: { $toDouble: "$total_amount" } }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  // Format the result into months
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const revenueByMonth = Array(12).fill(0);
  
  monthlyData.forEach(item => {
    revenueByMonth[item._id - 1] = item.revenue;
  });
  
  return {
    labels: months,
    values: revenueByMonth
  };
}

// Function to get daily revenue data for a specific month and year
async function getDailyRevenueForMonth(year, month) {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0, 23, 59, 59); // Last day of month
  
  const dailyData = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $in: ["confirmed", "intransit", "delivered"] }
      }
    },
    {
      $group: {
        _id: { $dayOfMonth: "$createdAt" },
        revenue: { $sum: { $toDouble: "$total_amount" } }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  // Get the number of days in the month
  const daysInMonth = new Date(year, month, 0).getDate();
  
  // Create arrays for labels and values
  const labels = Array.from({ length: daysInMonth }, (_, i) => `Day ${i + 1}`);
  const values = Array(daysInMonth).fill(0);
  
  // Fill in the values we have data for
  dailyData.forEach(item => {
    values[item._id - 1] = item.revenue;
  });
  
  return {
    labels: labels,
    values: values
  };
}

// Function to get yearly revenue data for the past N years
async function getYearlyRevenue(numberOfYears) {
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - numberOfYears + 1;
  const startDate = new Date(startYear, 0, 1);
  const endDate = new Date(currentYear, 11, 31, 23, 59, 59);
  
  const yearlyData = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $in: ["confirmed", "intransit", "delivered"] }
      }
    },
    {
      $group: {
        _id: { $year: "$createdAt" },
        revenue: { $sum: { $toDouble: "$total_amount" } }
      }
    },
    { $sort: { _id: 1 } }
  ]);
  
  // Create arrays for labels and values
  const years = Array.from({ length: numberOfYears }, (_, i) => (startYear + i).toString());
  const revenues = Array(numberOfYears).fill(0);
  
  // Fill in the values we have data for
  yearlyData.forEach(item => {
    const index = item._id - startYear;
    if (index >= 0 && index < numberOfYears) {
      revenues[index] = item.revenue;
    }
  });
  
  return {
    labels: years,
    values: revenues
  };
}

async function getPaymentMethodStats(period = "monthly") {
  let startDate, endDate = new Date();
  
  // Set time period for filtering
  if (period === "daily") {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  } else if (period === "monthly") {
    startDate = new Date();
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
  } else if (period === "yearly") {
    startDate = new Date();
    startDate.setMonth(0, 1);
    startDate.setHours(0, 0, 0, 0);
  }
  
  // Aggregate payment methods
  const paymentStats = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: startDate, $lte: endDate },
        status: { $in: ["confirmed", "intransit", "delivered"] }
      }
    },
    {
      $group: {
        _id: "$pay_method",
        total: { $sum: { $toDouble: "$total_amount" } }
      }
    }
  ]);
  
  // Format the result for the pie chart
  const paymentMethods = ["cod", "wallet", "razorpay"];
  const formattedData = {
    labels: ["COD", "Wallet", "Online"],
    values: [0, 0, 0] // Default zeros
  };
  
  // Fill in actual values
  paymentStats.forEach(stat => {
    const index = paymentMethods.indexOf(stat._id);
    if (index !== -1) {
      formattedData.values[index] = stat.total;
    }
  });
  
  return formattedData;
}


async function getTopSellingStats(type, period = "monthly", limit = 10) {
  let startDate, endDate = new Date();
  
  // Set time period for filtering
  if (period === "daily") {
    startDate = new Date();
    startDate.setHours(0, 0, 0, 0);
  } else if (period === "monthly") {
    startDate = new Date();
    startDate.setDate(1);
    startDate.setHours(0, 0, 0, 0);
  } else if (period === "yearly") {
    startDate = new Date();
    startDate.setMonth(0, 1);
    startDate.setHours(0, 0, 0, 0);
  }

  // Basic match stage for time period and valid order statuses
  let matchStage = {
    $match: {
      createdAt: { $gte: startDate, $lte: endDate },
      status: { $in: ["confirmed", "intransit", "delivered"] }
    }
  };

  let pipeline = [];
  
  // Different aggregation based on type
  switch(type) {
    case "products":
      pipeline = [
        matchStage,
        // Lookup to get order items
        {
          $lookup: {
            from: "order_items",
            localField: "order_items",
            foreignField: "_id",
            as: "items"
          }
        },
        // Unwind the items array
        { $unwind: "$items" },
        // Lookup to get product details
        {
          $lookup: {
            from: "products",
            localField: "items.product_id",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        // Group by product
        {
          $group: {
            _id: "$items.product_id",
            name: { $first: { $arrayElemAt: ["$productInfo.name", 0] } },
            quantity: { $sum: "$items.quantity" },
            revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
          }
        },
        // Sort by quantity sold
        { $sort: { quantity: -1 } },
        // Limit to top results
        { $limit: limit }
      ];
      break;
      
    case "categories":
      pipeline = [
        matchStage,
        // Lookup to get order items
        {
          $lookup: {
            from: "order_items",
            localField: "order_items",
            foreignField: "_id",
            as: "items"
          }
        },
        // Unwind the items array
        { $unwind: "$items" },
        // Lookup to get product details (to get category_id)
        {
          $lookup: {
            from: "products",
            localField: "items.product_id",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        // Unwind the productInfo array
        { $unwind: "$productInfo" },
        // Lookup to get category details
        {
          $lookup: {
            from: "categories",
            localField: "productInfo.category_id",
            foreignField: "_id",
            as: "categoryInfo"
          }
        },
        // Group by category
        {
          $group: {
            _id: "$productInfo.category_id",
            name: { $first: { $arrayElemAt: ["$categoryInfo.title", 0] } },
            quantity: { $sum: "$items.quantity" },
            revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
          }
        },
        // Sort by quantity sold
        { $sort: { quantity: -1 } },
        // Limit to top results
        { $limit: limit }
      ];
      break;
      
    case "brands":
      pipeline = [
        matchStage,
        // Lookup to get order items
        {
          $lookup: {
            from: "order_items",
            localField: "order_items",
            foreignField: "_id",
            as: "items"
          }
        },
        // Unwind the items array
        { $unwind: "$items" },
        // Lookup to get product details
        {
          $lookup: {
            from: "products",
            localField: "items.product_id",
            foreignField: "_id",
            as: "productInfo"
          }
        },
        // Group by brand
        {
          $group: {
            _id: { $arrayElemAt: ["$productInfo.brand", 0] },
            name: { $first: { $arrayElemAt: ["$productInfo.brand", 0] } },
            quantity: { $sum: "$items.quantity" },
            revenue: { $sum: { $multiply: ["$items.price", "$items.quantity"] } }
          }
        },
        // Sort by quantity sold
        { $sort: { quantity: -1 } },
        // Limit to top results
        { $limit: limit }
      ];
      break;
  }
  
  // Perform aggregation
  const topSellingStats = await mongoose.model("orders").aggregate(pipeline);
  
  // Format the results
  return topSellingStats.map(item => ({
    name: item.name || "Unknown",
    quantity: item.quantity,
    revenue: item.revenue
  }));
}


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
    console.error("Logout error:", error);
    res.redirect("/404page"); 
  }
};

