const express = require('express');
const subscriptionController = require('../controllers/subscription.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

// Public / Authenticated plans listing
router.get('/plans', subscriptionController.getPlans);

// Authenticated workspace subscription management
router.get('/current', auth, subscriptionController.getCurrentSubscription);
router.post('/initiate-mpesa', auth, subscriptionController.initiateMpesa);
router.post('/confirm-payment', auth, subscriptionController.confirmPayment);
router.get('/invoices', auth, subscriptionController.getInvoices);
router.post('/check-expirations', auth, subscriptionController.triggerExpirationCheck);

module.exports = router;
