const express = require('express');
const paymentController = require('../controllers/payment.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

// Invoice Endpoints (legacy – the app uses /api/invoices)
router
  .route('/invoices')
  .post(auth, paymentController.createInvoice)
  .get(auth, paymentController.getInvoices);

router
  .route('/invoices/:invoiceId')
  .get(auth, paymentController.getInvoice)
  .patch(auth, paymentController.updateInvoiceStatus)
  .delete(auth, paymentController.deleteInvoice);

// ─── Gateway endpoints (must be declared before /payments/:paymentId) ───
router.get('/payments/gateways', auth, paymentController.getGateways);

// M-Pesa (Daraja)
router.post('/payments/mpesa/stk-push', auth, paymentController.initiateMpesaStk);
router.post('/payments/mpesa/register-c2b', auth, paymentController.registerMpesaC2B);
// Public callbacks from Safaricom (no JWT; optional ?token= check)
router.post('/payments/mpesa/callback', paymentController.mpesaStkCallback);
router.post('/payments/mpesa/c2b/validation', paymentController.mpesaC2bValidation);
router.post('/payments/mpesa/c2b/confirmation', paymentController.mpesaC2bConfirmation);

// Bank instant payment notification (public, HMAC-signed)
router.post('/payments/bank/webhook', paymentController.bankWebhook);

// Payment Endpoints
router
  .route('/payments')
  .post(auth, paymentController.createPayment)
  .get(auth, paymentController.getPayments);

router
  .route('/payments/:paymentId')
  .get(auth, paymentController.getPayment)
  .patch(auth, paymentController.updatePaymentStatus)
  .delete(auth, paymentController.deletePayment);

router.post('/payments/:paymentId/match', auth, paymentController.matchPayment);
router.get('/payments/:paymentId/mpesa-status', auth, paymentController.getMpesaStatus);

module.exports = router;