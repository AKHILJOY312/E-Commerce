const express=require('express');
const router = express.Router();
const adminController=require('../controllers/admin/adminController');
const {adminAuth,userAuth} =require("../middleware/auth")
const customerController = require("../controllers/admin/customerController");
const categoryController = require('../controllers/admin/categoryController')


router.get('/404page',adminController.pageNotFound);

//admin login Management
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get('/',adminAuth,adminController.loadDashboard);
router.get("/logout",adminController.logout);

//Costumer Management
router.get("/users",adminAuth,customerController.customerInfo);
router.get('/blockUser',adminAuth,customerController.userBlocked);
router.get('/unblockUser',adminAuth,customerController.userUnblocked);

//category management
router.get('/category',adminAuth,categoryController.categoryInfo);
router.post('/category',adminAuth,categoryController.postEditCategory);
router.delete('/category',adminAuth,categoryController.softDeleteCategory);
router.get('/unlistCategory',adminAuth,categoryController.unlistCategory);
router.get('/listCategory',adminAuth,categoryController.listCategory);
router.post('/addCategory',adminAuth,categoryController.addCategory);
 



module.exports =router;