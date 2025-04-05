const express = require("express");
const router = express.Router();
const passport  = require("passport")
const userController = require("../controllers/user/userController");
const userProductController = require("../controllers/user/userProductController");
const {adminAuth,userAuth} =require("../middleware/auth");

router.get("/pageNotFound", userController.pageNotFound);
router.get("/", userController.loadHomePage);

//auth managment
router.get("/login", userController.getLogin);
router.post('/login', userController.login);
router.get("/signup", userController.getSignup);
router.post("/signup", userController.signupUser);
router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);
router.get("/auth/google",userController.googleAuth);
router.get( "/auth/google/callback",userController.googleAuthCallback);


//forgot password section
router.get("/logout",userController.logout);
router.get("/forgetPassword",userController.LoadForgetPassword);
router.post('/forgetPassword', userController.forgotPassword);
router.post("/forgot-resend-otp", userController.ForgotResendOtp);
router.post('/verify-forgot-password-otp', userController.verifyForgotPasswordOtp);
router.get('/reset-password', userController.getResetPassword);
router.post('/reset-password', userController.resetPassword);

//shopping page management
router.get("/shop", userProductController.loadShop);
router.get("/product/:productId", userProductController.productDetail);

module.exports = router;
