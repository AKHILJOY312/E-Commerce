const express=require('express');
const router = express.Router();
const adminController=require('../controllers/admin/adminController');
const {adminAuth,userAuth} =require("../middleware/auth");
const customerController = require("../controllers/admin/customerController");
const categoryController = require('../controllers/admin/categoryController')
const productController = require('../controllers/admin/productController');
const upload = require('../middleware/uploadMiddleware'); 
const CouponController= require("../controllers/admin/CouponController");
const adminOrderController= require("../controllers/admin/adminOrderController");
const OfferController = require("../controllers/admin/OfferController");
const SalesController = require("../controllers/admin/salesController");
const walletController= require("../controllers/admin/walletController");


router.get('/404page',adminController.pageNotFound);

//admin login Management
router.get("/login",adminController.loadLogin);
router.post("/login",adminController.login);
router.get('/',adminAuth,adminController.loadDashboard);
router.get("/logout",adminController.adminLogout);

//Customer Management
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


//products management
router.get('/products',adminAuth,productController.getProducts);
router.post('/products',adminAuth,productController.createProduct);
router.get('/products/:productId',adminAuth, productController.getProductDetails);
router.get('/listProduct', adminAuth,productController.listProduct);
router.get('/unlistProduct',adminAuth, productController.unlistProduct);
router.put('/products/:productId',adminAuth, productController.updateProduct);
router.patch('/products/:productId',adminAuth, productController.deleteProduct);
router.post('/products/:productId/variants',adminAuth, productController.createVariant);
router.get('/products/:productId/variants/:variantId',adminAuth, productController.getVariant);
router.patch('/products/:productId/variants/:variantId',adminAuth, productController.updateVariant);
router.patch('/variants/soft-delete/:variantId',adminAuth, productController.softDeleteVariant);
router.post('/products/:productId/variants/:variantId/upload',adminAuth, upload, productController.addImage);
router.delete('/products/:productId/variants/:variantId/remove-image',adminAuth, productController.removeImage);



//coupon management 
router.get('/coupon',adminAuth, CouponController.getCoupons);
router.post('/coupon/add',adminAuth, CouponController.addCoupon);
router.post('/coupon/edit',adminAuth, CouponController.editCoupon);
router.delete('/coupon/delete',adminAuth, CouponController.deleteCoupon);


//Order management 
router.get('/orders',adminAuth, adminOrderController.getOrders);
router.get('/orders/:id',adminAuth, adminOrderController.getOrderDetails);
router.post('/updateOrderStatus',adminAuth, adminOrderController.updateOrderStatus);
router.post('/cancelOrder',adminAuth, adminOrderController.cancelOrder);

// Offer Management
router.get('/offers',adminAuth, OfferController.getAdminOffersPage);
router.post('/offers',adminAuth, OfferController.createOffer);
router.post('/updateOffer',adminAuth, OfferController.updateOffer);
router.get('/activateOffer',adminAuth, OfferController.activateOffer);
router.get('/deactivateOffer',adminAuth, OfferController.deactivateOffer);
router.delete('/deleteOffer',adminAuth, OfferController.deleteOffer);
router.get('/activeOffers',adminAuth, OfferController.getActiveOffers);


//sale management
router.get('/sales',adminAuth, SalesController.getSalesReport);
router.get('/sales/report',adminAuth, SalesController.getSalesReportApi);
router.get('/sales/download',adminAuth, SalesController.downloadSalesReport);

//wallet usage details
router.get('/wallet-transactions',walletController.getWalletTransactions);
router.get('/wallet-transactions/suggestions', walletController.getSearchSuggestions);
router.get('/wallet-transactions/:id', walletController.getTransactionDetails);

module.exports =router;