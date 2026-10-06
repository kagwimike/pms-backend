const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoice.controller');
const { auth } = require('../middleware/auth.middleware');

// All invoice endpoints require an authenticated user.
router.use((req, res, next) => {
  const authMiddleware = require('../middleware/auth.middleware');
  if (!authMiddleware || !authMiddleware.auth) return next(new Error("Auth middleware not loaded"));
  return authMiddleware.auth(req, res, next);
});

// POST /api/invoices
router.post('/', invoiceController.createInvoice);

// GET /api/invoices
router.get('/', invoiceController.getInvoices);

// GET /api/invoices/:id
router.get('/:id', invoiceController.getInvoiceById);

// PATCH/PUT /api/invoices/:id
router.patch('/:id', invoiceController.updateInvoice);
router.put('/:id', invoiceController.updateInvoice);

// DELETE /api/invoices/:id
router.delete('/:id', invoiceController.deleteInvoice);

module.exports = router;