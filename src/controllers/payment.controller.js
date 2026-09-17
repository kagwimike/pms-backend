const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const DepositRefund = require('../models/DepositRefund');
const ApiError = require('../utils/ApiError');
const { successResponse, errorResponse } = require('../utils/formatResponse');

const createInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.create(req.body);
    return successResponse(res, invoice, 'Invoice created successfully', 201);
  } catch (error) {
    console.error('Error in createInvoice:', error);
    return errorResponse(res, 'Failed to create invoice', 400, error);
  }
};

const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');

const getInvoices = async (req, res) => {
  try {
    const { limit, cursor } = req.query;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    const data = await Invoice.findAll({ where, include: ['lease'], limit: size, order });
    const { rows, meta } = getCursorPagingData(data, size);
    
    return successResponse(res, rows, 'Invoices retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getInvoices:', error);
    return errorResponse(res, 'Failed to retrieve invoices', 400, error);
  }
};

const getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.invoiceId, { include: ['lease', 'payments'] });
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    return successResponse(res, invoice, 'Invoice retrieved successfully');
  } catch (error) {
    console.error('Error in getInvoice:', error);
    return errorResponse(res, 'Failed to retrieve invoice', 400, error);
  }
};

const createPayment = async (req, res) => {
  try {
    const payment = await Payment.create({
      ...req.body,
      tenant_id: req.user.id
    });

    // If confirmed right away (e.g. cash payment), update invoice
    if (payment.is_confirmed) {
      const invoice = await Invoice.findByPk(payment.invoice_id);
      if (invoice) {
        invoice.amount_paid = parseFloat(invoice.amount_paid) + parseFloat(payment.amount);
        if (invoice.amount_paid >= invoice.amount) {
          invoice.status = 'PAID';
        } else {
          invoice.status = 'PARTIAL';
        }
        await invoice.save();
      }
    }

    return successResponse(res, payment, 'Payment created successfully', 201);
  } catch (error) {
    console.error('Error in createPayment:', error);
    return errorResponse(res, 'Failed to create payment', 400, error);
  }
};

const getPayments = async (req, res) => {
  try {
    const { limit, cursor } = req.query;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    const data = await Payment.findAll({ where, include: ['invoice', 'tenant'], limit: size, order });
    const { rows, meta } = getCursorPagingData(data, size);

    return successResponse(res, rows, 'Payments retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getPayments:', error);
    return errorResponse(res, 'Failed to retrieve payments', 400, error);
  }
};

const updateInvoiceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const invoice = await Invoice.findByPk(req.params.invoiceId);
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    
    const validStatuses = ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'];
    if (status && validStatuses.includes(status)) {
      invoice.status = status;
      await invoice.save();
      return successResponse(res, invoice, 'Invoice status updated successfully');
    }
    throw new ApiError(400, 'Invalid invoice status');
  } catch (error) {
    console.error('Error in updateInvoiceStatus:', error);
    return errorResponse(res, 'Failed to update invoice status', 400, error);
  }
};

const updatePaymentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const payment = await Payment.findByPk(req.params.paymentId);
    if (!payment) throw new ApiError(404, 'Payment not found');
    
    // Status transitions based on Rule 6: No update to amount/delete — only status transitions
    const validStatuses = ['REVERSED', 'REFUNDED', 'CANCELLED', 'CONFIRMED'];
    if (status && validStatuses.includes(status)) {
      // Basic implementation for status update
      payment.status = status; 
      // If confirmed, you would also set is_confirmed = true
      if (status === 'CONFIRMED') payment.is_confirmed = true;
      await payment.save();
      return successResponse(res, payment, 'Payment status updated successfully');
    }
    throw new ApiError(400, 'Invalid payment status');
  } catch (error) {
    console.error('Error in updatePaymentStatus:', error);
    return errorResponse(res, 'Failed to update payment status', 400, error);
  }
};

module.exports = {
  createInvoice,
  getInvoices,
  getInvoice,
  updateInvoiceStatus,
  createPayment,
  getPayments,
  updatePaymentStatus
};
