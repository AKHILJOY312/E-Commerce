const express = require("express");
const router = express.Router();
const passport  = require("passport")
const userController = require("../controllers/user/userController");
const userProductController = require("../controllers/user/userProductController");
const {adminAuth,userAuth} =require("../middleware/auth");
const userProfileController = require("../controllers/user/userProfileController");
const profileUpload= require("../middleware/profileUpload");


router.get("/pageNotFound", userController.pageNotFound);
router.get("/", userController.loadHomePage);

//auth management
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


//User Profile management.
router.get("/user/profile",userAuth,userProfileController.loadProfile);
router.get("/user/edit-profile",userAuth,userProfileController.loadEditProfile);
router.post("/user/update-profile",profileUpload,userProfileController.updateProfile);
router.get("/user/verify-otp",userAuth, userProfileController.getOtp);
router.post("/user/verify-otp",userAuth, userProfileController.verifyOtp);
// router.post("/user/resend-otp", userProfileController.resendOtp);
router.get("/user/edit-password",userProfileController.editPassword);
router.post("/user/edit-password",userProfileController.updatePassword);
router.get("/user/edit-email",userProfileController.getEditEmail);
 router.post("/user/edit-email",userProfileController.editEmail);
 router.get("/user/change-email",userProfileController.changeEmail);
 router.get("/user/edit-phone",userProfileController.getPhone);
 router.post("/user/update-mobile",userProfileController.updatePhone);


module.exports = router;
