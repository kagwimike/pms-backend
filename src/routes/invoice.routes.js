const express = require('express');
const router = express.Router();
const invoiceController = require('../controllers/invoice.controller');

// POST /api/invoices
router.post('/', invoiceController.createInvoice);

// GET /api/invoices
router.get('/', invoiceController.getInvoices);

// GET /api/invoices/:id
router.get('/:id', invoiceController.getInvoiceById);

// PATCH /api/invoices/:id
router.patch('/:id', invoiceController.updateInvoice);

// DELETE /api/invoices/:id
router.delete('/:id', invoiceController.deleteInvoice);

module.exports = router;