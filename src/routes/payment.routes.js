const express = require('express');
const paymentController = require('../controllers/payment.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

// Invoice Endpoints
router
  .route('/invoices')
  .post(auth, paymentController.createInvoice)
  .get(auth, paymentController.getInvoices);

router
  .route('/invoices/:invoiceId')
  .get(auth, paymentController.getInvoice)
  .patch(auth, paymentController.updateInvoiceStatus)
  .delete(auth, paymentController.deleteInvoice);

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

module.exports = router;