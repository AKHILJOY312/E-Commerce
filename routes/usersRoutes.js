const express = require("express");
const router = express.Router();
const passport  = require("passport")
const userController = require("../controllers/user/userController");

router.get("/pageNotFound", userController.pageNotFound);
router.get("/", userController.loadHomePage);

router.get("/login", userController.getLogin);
router.post('/login', userController.login);

router.get("/signup", userController.getSignup);
router.post("/signup", userController.signupUser);

router.post("/verify-otp", userController.verifyOtp);
router.post("/resend-otp", userController.resendOtp);

router.get("/auth/google",passport.authenticate("google", { scope: ["profile", "email"] }));


router.get(
  "/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/signup" }),
  (req, res) => {
    if (req.user) {
      req.session.isAuthenticated = true;
      req.session.username = req.user.name; // Store username in session
    }
    res.redirect("/");
  }
);



router.get("/logout",userController.logout);

module.exports = router;
