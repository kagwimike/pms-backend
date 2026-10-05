const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const DepositRefund = require('../models/DepositRefund');
const ApiError = require('../utils/ApiError');
const { successResponse, errorResponse } = require('../utils/formatResponse');
const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');

// ==================== INVOICE CONTROLLERS ====================

const createInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.create(req.body);
    return successResponse(res, invoice, 'Invoice created successfully', 201);
  } catch (error) {
    console.error('Error in createInvoice:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to create invoice', statusCode, error);
  }
};

const getInvoices = async (req, res) => {
  try {
    const { limit, cursor } = req.query;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    const data = await Invoice.findAll({ where, include: ['lease'], limit: size, order });
    const { rows, meta } = getCursorPagingData(data, size);
    
    return successResponse(res, rows, 'Invoices retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getInvoices:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to retrieve invoices', statusCode, error);
  }
};

const getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.invoiceId, { include: ['lease', 'payments'] });
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    return successResponse(res, invoice, 'Invoice retrieved successfully');
  } catch (error) {
    console.error('Error in getInvoice:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to retrieve invoice', statusCode, error);
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
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to update invoice status', statusCode, error);
  }
};

const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.invoiceId);
    if (!invoice) throw new ApiError(404, 'Invoice not found');

    await invoice.destroy();
    return successResponse(res, null, 'Invoice deleted successfully', 200);
  } catch (error) {
    console.error('Error in deleteInvoice:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to delete invoice', statusCode, error);
  }
};

// ==================== PAYMENT CONTROLLERS ====================

const createPayment = async (req, res) => {
  try {
    const payment = await Payment.create({
      ...req.body,
      tenant_id: req.user.id
    });

    // If confirmed right away (e.g. cash payment), update associated invoice balance
    if (payment.is_confirmed && payment.invoice_id) {
      const invoice = await Invoice.findByPk(payment.invoice_id);
      if (invoice) {
        const updatedAmountPaid = parseFloat(invoice.amount_paid || 0) + parseFloat(payment.amount);
        invoice.amount_paid = updatedAmountPaid;
        invoice.status = updatedAmountPaid >= parseFloat(invoice.amount) ? 'PAID' : 'PARTIAL';
        await invoice.save();
      }
    }

    return successResponse(res, payment, 'Payment created successfully', 201);
  } catch (error) {
    console.error('Error in createPayment:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to create payment', statusCode, error);
  }
};

const getPayments = async (req, res) => {
  try {
    const { limit, cursor } = req.query;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    if (req.user && req.user.role === 'TENANT') where.tenant_id = req.user.id;
    const data = await Payment.findAll({ where, include: ['invoice', 'tenant'], limit: size, order });
    const { rows, meta } = getCursorPagingData(data, size);

    return successResponse(res, rows, 'Payments retrieved successfully', 200, meta);
  } catch (error) {
    console.error('Error in getPayments:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to retrieve payments', statusCode, error);
  }
};

const getPayment = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.paymentId, { include: ['invoice', 'tenant'] });
    if (!payment) throw new ApiError(404, 'Payment not found');
    return successResponse(res, payment, 'Payment retrieved successfully');
  } catch (error) {
    console.error('Error in getPayment:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to retrieve payment', statusCode, error);
  }
};

const updatePaymentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const payment = await Payment.findByPk(req.params.paymentId);
    if (!payment) throw new ApiError(404, 'Payment not found');
    
    const validStatuses = ['REVERSED', 'REFUNDED', 'CANCELLED', 'CONFIRMED'];
    if (status && validStatuses.includes(status)) {
      const previousStatus = payment.status;
      payment.status = status; 
      
      if (status === 'CONFIRMED') {
        payment.is_confirmed = true;
      }

      await payment.save();

      // Recalculate invoice balance if payment becomes CONFIRMED
      if (status === 'CONFIRMED' && previousStatus !== 'CONFIRMED' && payment.invoice_id) {
        const invoice = await Invoice.findByPk(payment.invoice_id);
        if (invoice) {
          const updatedAmountPaid = parseFloat(invoice.amount_paid || 0) + parseFloat(payment.amount);
          invoice.amount_paid = updatedAmountPaid;
          invoice.status = updatedAmountPaid >= parseFloat(invoice.amount) ? 'PAID' : 'PARTIAL';
          await invoice.save();
        }
      }

      // Deduct invoice balance if confirmed payment is REVERSED, REFUNDED, or CANCELLED
      if (['REVERSED', 'REFUNDED', 'CANCELLED'].includes(status) && previousStatus === 'CONFIRMED' && payment.invoice_id) {
        const invoice = await Invoice.findByPk(payment.invoice_id);
        if (invoice) {
          const updatedAmountPaid = Math.max(0, parseFloat(invoice.amount_paid || 0) - parseFloat(payment.amount));
          invoice.amount_paid = updatedAmountPaid;
          if (updatedAmountPaid === 0) {
            invoice.status = 'PENDING';
          } else if (updatedAmountPaid < parseFloat(invoice.amount)) {
            invoice.status = 'PARTIAL';
          }
          await invoice.save();
        }
      }

      return successResponse(res, payment, 'Payment status updated successfully');
    }
    throw new ApiError(400, 'Invalid payment status');
  } catch (error) {
    console.error('Error in updatePaymentStatus:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to update payment status', statusCode, error);
  }
};

const deletePayment = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.paymentId);
    if (!payment) throw new ApiError(404, 'Payment not found');

    await payment.destroy();
    return successResponse(res, null, 'Payment deleted successfully', 200);
  } catch (error) {
    console.error('Error in deletePayment:', error);
    const statusCode = error.statusCode || 400;
    return errorResponse(res, error.message || 'Failed to delete payment', statusCode, error);
  }
};

module.exports = {
  createInvoice,
  getInvoices,
  getInvoice,
  updateInvoiceStatus,
  deleteInvoice,
  createPayment,
  getPayments,
  getPayment,
  updatePaymentStatus,
  deletePayment
};