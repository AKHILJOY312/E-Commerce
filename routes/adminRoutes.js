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



//coupen mangenmet
router.get('/coupon', CouponController.getCoupons);
router.post('/coupon/add', CouponController.addCoupon);
router.post('/coupon/edit', CouponController.editCoupon);
router.delete('/coupon/delete', CouponController.deleteCoupon);


//Order management 
router.get('/orders',adminAuth, adminOrderController.getOrders);
router.get('/orders/:id',adminAuth, adminOrderController.getOrderDetails);
router.post('/updateOrderStatus',adminAuth, adminOrderController.updateOrderStatus);
router.post('/cancelOrder',adminAuth, adminOrderController.cancelOrder);

// Offer Managment
router.get('/offers', OfferController.getAdminOffersPage);

// Create a new offer
router.post('/offers', OfferController.createOffer);

// Update an existing offer
router.post('/updateOffer', OfferController.updateOffer);

// Activate an offer
router.get('/activateOffer', OfferController.activateOffer);

// Deactivate an offer
router.get('/deactivateOffer', OfferController.deactivateOffer);

// Soft delete an offer
router.delete('/deleteOffer', OfferController.deleteOffer);

// Get active offers (for other pages)
router.get('/activeOffers', OfferController.getActiveOffers);

// // Calculate cart total
// router.post('/cart/calculate', OfferController.calculateCartTotal);

//sale mangement
// router.get('/sales-report', adminAuth, salesReportController.renderSalesReportPage);
// router.get('/api/sales-report', adminAuth, salesReportController.getSalesReport);
// router.get('/sales-report/export/excel', adminAuth, salesReportController.exportSalesReportExcel);
// router.get('/sales-report/export/pdf', adminAuth, salesReportController.exportSalesReportPDF);

// router.get('/report', salesController.getSalesReport);
// router.get('/download', salesController.downloadSalesReport);

router.get('/sales', SalesController.getSalesReport);
router.get('/sales/report', SalesController.getSalesReportApi);
router.get('/sales/download', SalesController.downloadSalesReport);

module.exports =router;