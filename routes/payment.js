const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/user/paymentController');
const { userAuth }=require('../middleware/auth');

router.post('/create-order', paymentController.createOrder);
router.post('/verify-payment', paymentController.verifyPayment);
// router.get('/success', paymentController.paymentSuccess);
 router.post('/log-failure', paymentController.paymentFailure);

module.exports = router;