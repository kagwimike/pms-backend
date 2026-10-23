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

// ─── Bank Accounts Management ───
const bankAccountController = require('../controllers/bankAccount.controller');
const bankStatementController = require('../controllers/bankStatement.controller');
const multer = require('multer');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB statement file limit
});

router.get('/payments/bank-accounts/banks', auth, bankAccountController.getSupportedBanks);
router
  .route('/payments/bank-accounts')
  .get(auth, bankAccountController.getBankAccounts)
  .post(auth, bankAccountController.createBankAccount);

router
  .route('/payments/bank-accounts/:id')
  .get(auth, bankAccountController.getBankAccount)
  .patch(auth, bankAccountController.updateBankAccount)
  .delete(auth, bankAccountController.deleteBankAccount);

router.post('/payments/bank-accounts/:id/primary', auth, bankAccountController.setPrimaryBankAccount);

// ─── Bank Statement Ingestion & Reconciliation ───
router.post('/payments/statements/upload', auth, upload.single('statement'), bankStatementController.uploadAndReconcile);
router.get('/payments/statements', auth, bankStatementController.getStatementUploads);
router.get('/payments/statements/:id', auth, bankStatementController.getStatementUploadById);

// ─── Unmatched Deposits Queue & 1-Click Assignment (Phase 3) ───
const unmatchedQueueController = require('../controllers/unmatchedQueue.controller');
router.get('/payments/unmatched', auth, unmatchedQueueController.getUnmatchedQueue);
router.get('/payments/unmatched/stats', auth, unmatchedQueueController.getQueueStats);
router.get('/payments/unmatched/:paymentId/candidates', auth, unmatchedQueueController.getPaymentCandidates);
router.post('/payments/unmatched/:paymentId/assign', auth, unmatchedQueueController.assignPayment);
router.post('/payments/unmatched/:paymentId/resolve', auth, unmatchedQueueController.resolvePayment);

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