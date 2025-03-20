const user= require("../../models/User");
const mongoose=require("mongoose");

const bcrypt=require("bcryptjs");

exports.loadLogin = (req,res)=>{
    if(req.session.admin){
        return res.redirect("/admin/dashboard");
    }
    res.render('adminLogin',{message:null});
}


exports.loadDashboard = (req,res)=>{
    
         res.render("adminDashboard");
   
}