const express=require('express');
const router =express.Router();

const userController = require("../controllers/user/userController") 


router.get("/pageNotFound",userController.pageNotFound);
router.get("/",userController.loadHomePage);
router.get("/login",userController.loginUser);
router.get("/signup",userController.getUser);
router.post("/signup",userController.signupUser);
router.post("/verify-otp",userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);

module.exports = router;