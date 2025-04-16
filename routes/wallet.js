const express = require('express');
const router = express.Router();
const walletController = require('../controllers/user/walletController');

router.post('/add-money', walletController.addMoney);
router.post('/verify-payment', walletController.verifyPayment);
router.get('/', walletController.getWallet);

module.exports = router;