const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const ApiError = require('../utils/ApiError');
const { successResponse, errorResponse } = require('../utils/formatResponse');
const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');
const NotificationService = require('../services/notification.service');
const mpesa = require('../services/payments/mpesa.service');
const bank = require('../services/payments/bank.service');
const recon = require('../services/payments/reconciliation.service');
const env = require('../config/env');
const logger = require('../utils/logger');

const SAFE_USER_ATTRS = ['id', 'username', 'email', 'first_name', 'last_name', 'phone'];
const isStaff = (user) => user && ['ADMIN', 'OWNER'].includes(user.role);

const fail = (res, error, fallback) => {
  console.error(fallback, error);
  return errorResponse(res, error.message || fallback, error.statusCode || 400, error);
};

// ==================== INVOICE CONTROLLERS (legacy /finance/invoices) ====================

const createInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.create(req.body);
    await NotificationService.notifyInvoiceCreated(invoice.tenant_id, invoice.amount, invoice.id);
    return successResponse(res, invoice, 'Invoice created successfully', 201);
  } catch (error) {
    return fail(res, error, 'Failed to create invoice');
  }
};

const getInvoices = async (req, res) => {
  try {
    const { limit, cursor } = req.query;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    if (req.user?.role === 'TENANT') where.tenant_id = req.user.id;
    const data = await Invoice.findAll({ where, include: ['lease'], limit: size, order });
    const { rows, meta } = getCursorPagingData(data, size);
    return successResponse(res, rows, 'Invoices retrieved successfully', 200, meta);
  } catch (error) {
    return fail(res, error, 'Failed to retrieve invoices');
  }
};

const getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.invoiceId, { include: ['lease', 'payments'] });
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    return successResponse(res, invoice, 'Invoice retrieved successfully');
  } catch (error) {
    return fail(res, error, 'Failed to retrieve invoice');
  }
};

const updateInvoiceStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const invoice = await Invoice.findByPk(req.params.invoiceId);
    if (!invoice) throw new ApiError(404, 'Invoice not found');

    const validStatuses = ['PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'];
    if (!status || !validStatuses.includes(status)) throw new ApiError(400, 'Invalid invoice status');

    const oldStatus = invoice.status;
    invoice.status = status;
    await invoice.save();
    if (status === 'OVERDUE' && oldStatus !== 'OVERDUE') {
      await NotificationService.notifyInvoiceOverdue(invoice.tenant_id, invoice.amount, invoice.id);
    }
    return successResponse(res, invoice, 'Invoice status updated successfully');
  } catch (error) {
    return fail(res, error, 'Failed to update invoice status');
  }
};

const deleteInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findByPk(req.params.invoiceId);
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    await invoice.destroy();
    return successResponse(res, null, 'Invoice deleted successfully', 200);
  } catch (error) {
    return fail(res, error, 'Failed to delete invoice');
  }
};

// ==================== PAYMENT CONTROLLERS ====================

/**
 * Manual payment entry.
 *  - Tenant: submits proof (M-Pesa code / bank ref) -> PENDING until staff confirm
 *  - Owner/Admin: records money received (cash, bank, etc.) -> CONFIRMED immediately
 *  - No invoice -> UNMATCHED
 */
const createPayment = async (req, res) => {
  try {
    const { amount, payment_method, transaction_reference, invoice_id, phone_number, notes } = req.body;
    if (!amount || Number(amount) <= 0) throw new ApiError(400, 'A positive amount is required');
    if (payment_method && !Payment.METHODS.includes(payment_method)) throw new ApiError(400, 'Invalid payment method');

    let invoice = null;
    if (invoice_id) {
      invoice = await Invoice.findByPk(invoice_id);
      if (!invoice) throw new ApiError(404, 'Invoice not found');
      if (invoice.status === 'CANCELLED') throw new ApiError(400, 'Cannot pay a cancelled invoice');
      if (req.user.role === 'TENANT' && String(invoice.tenant_id) !== String(req.user.id)) {
        throw new ApiError(403, 'This invoice does not belong to you');
      }
    }

    if (transaction_reference) {
      const dup = await Payment.findOne({ where: { transaction_reference } });
      if (dup) throw new ApiError(409, 'A payment with this transaction reference already exists');
    }

    const staff = isStaff(req.user);
    const tenantId = staff ? (invoice?.tenant_id || req.body.tenant_id || null) : req.user.id;

    const payment = await Payment.create({
      amount,
      payment_method: payment_method || 'MPESA',
      transaction_reference: transaction_reference || null,
      invoice_id: invoice?.id || null,
      tenant_id: tenantId,
      phone_number: phone_number || null,
      account_reference: invoice ? recon.invoiceReference(invoice.id) : null,
      notes: notes || null,
      status: invoice ? 'PENDING' : 'UNMATCHED',
    });

    if (staff && invoice) {
      await recon.confirmPayment(payment);
    } else if (!invoice && tenantId) {
      await NotificationService.notifyPaymentUnmatched(tenantId, payment.amount, payment.transaction_reference || 'N/A');
    }

    await payment.reload({ include: ['invoice'] });
    return successResponse(res, payment, staff ? 'Payment recorded successfully' : 'Payment submitted for confirmation', 201);
  } catch (error) {
    return fail(res, error, 'Failed to create payment');
  }
};

const getPayments = async (req, res) => {
  try {
    const { limit, cursor, status, invoice_id, tenant_id, payment_method } = req.query;
    const { limit: size, where, order } = getCursorPagination(cursor, limit);
    if (status) where.status = status;
    if (invoice_id) where.invoice_id = invoice_id;
    if (payment_method) where.payment_method = payment_method;
    if (req.user.role === 'TENANT') where.tenant_id = req.user.id;
    else if (tenant_id) where.tenant_id = tenant_id;

    const data = await Payment.findAll({
      where,
      include: [
        { association: 'invoice' },
        { association: 'tenant', attributes: SAFE_USER_ATTRS },
      ],
      limit: size,
      order,
    });
    const { rows, meta } = getCursorPagingData(data, size);
    return successResponse(res, rows, 'Payments retrieved successfully', 200, meta);
  } catch (error) {
    return fail(res, error, 'Failed to retrieve payments');
  }
};

const getPayment = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.paymentId, {
      include: [{ association: 'invoice' }, { association: 'tenant', attributes: SAFE_USER_ATTRS }],
    });
    if (!payment) throw new ApiError(404, 'Payment not found');
    if (req.user.role === 'TENANT' && String(payment.tenant_id) !== String(req.user.id)) {
      throw new ApiError(404, 'Payment not found');
    }
    return successResponse(res, payment, 'Payment retrieved successfully');
  } catch (error) {
    return fail(res, error, 'Failed to retrieve payment');
  }
};

// Allowed status transitions (staff only)
const TRANSITIONS = {
  PENDING: ['CONFIRMED', 'FAILED', 'CANCELLED'],
  UNMATCHED: ['CANCELLED', 'REFUNDED'], // confirm UNMATCHED via /match
  CONFIRMED: ['REVERSED', 'REFUNDED'],
  FAILED: [],
  CANCELLED: [],
  REVERSED: [],
  REFUNDED: [],
};

const updatePaymentStatus = async (req, res) => {
  try {
    if (!isStaff(req.user)) throw new ApiError(403, 'Only owners/admins can change payment status');
    const { status, notes } = req.body;
    const payment = await Payment.findByPk(req.params.paymentId);
    if (!payment) throw new ApiError(404, 'Payment not found');

    const current = payment.status || (payment.is_confirmed ? 'CONFIRMED' : 'PENDING');
    if (!Payment.STATUSES.includes(status)) throw new ApiError(400, 'Invalid payment status');
    if (!(TRANSITIONS[current] || []).includes(status)) {
      throw new ApiError(400, `Cannot change payment from ${current} to ${status}`);
    }
    if (notes) payment.notes = notes;

    if (status === 'CONFIRMED') {
      await recon.confirmPayment(payment);
    } else if (status === 'FAILED') {
      await recon.failPayment(payment, notes);
    } else {
      payment.status = status;
      payment.is_confirmed = false;
      await payment.save();
      await recon.recalcInvoice(payment.invoice_id);

      if (payment.tenant_id) {
        if (status === 'REVERSED') await NotificationService.notifyPaymentReversed(payment.tenant_id, payment.amount);
        if (status === 'REFUNDED') await NotificationService.notifyPaymentRefunded(payment.tenant_id, payment.amount);
      }
    }

    await payment.reload({ include: ['invoice'] });
    return successResponse(res, payment, 'Payment status updated successfully');
  } catch (error) {
    return fail(res, error, 'Failed to update payment status');
  }
};

/** Attach an UNMATCHED/PENDING payment to an invoice (staff) */
const matchPayment = async (req, res) => {
  try {
    if (!isStaff(req.user)) throw new ApiError(403, 'Only owners/admins can match payments');
    const payment = await Payment.findByPk(req.params.paymentId);
    if (!payment) throw new ApiError(404, 'Payment not found');
    if (!['UNMATCHED', 'PENDING'].includes(payment.status)) {
      throw new ApiError(400, `Only UNMATCHED or PENDING payments can be matched (current: ${payment.status})`);
    }
    const invoice = await Invoice.findByPk(req.body.invoice_id);
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (invoice.status === 'CANCELLED') throw new ApiError(400, 'Cannot match to a cancelled invoice');

    await recon.matchPayment(payment, invoice);
    await payment.reload({ include: ['invoice'] });
    return successResponse(res, payment, 'Payment matched and confirmed');
  } catch (error) {
    return fail(res, error, 'Failed to match payment');
  }
};

const deletePayment = async (req, res) => {
  try {
    if (!isStaff(req.user)) throw new ApiError(403, 'Only owners/admins can delete payments');
    const payment = await Payment.findByPk(req.params.paymentId);
    if (!payment) throw new ApiError(404, 'Payment not found');
    const invoiceId = payment.invoice_id;
    await payment.destroy();
    await recon.recalcInvoice(invoiceId);
    return successResponse(res, null, 'Payment deleted successfully', 200);
  } catch (error) {
    return fail(res, error, 'Failed to delete payment');
  }
};

// ==================== GATEWAYS ====================

/** Which channels are live + instructions the app can show tenants */
const getGateways = async (req, res) => {
  return successResponse(res, {
    mpesa: {
      enabled: mpesa.isConfigured(),
      environment: env.mpesa.env,
      stk_push: mpesa.isConfigured() && Boolean(mpesa.callbackUrl()),
      paybill: env.mpesa.c2bShortcode || null,
      account_reference_format: 'INV-<invoice number>',
    },
    bank: {
      enabled: bank.isConfigured(),
      ...bank.publicDetails(),
      account_reference_format: 'INV-<invoice number>',
    },
  }, 'Payment gateways');
};

/** Tenant (or staff on behalf of tenant) initiates an STK push for an invoice */
const initiateMpesaStk = async (req, res) => {
  try {
    const { invoice_id, phone } = req.body;
    const invoice = await Invoice.findByPk(invoice_id);
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (req.user.role === 'TENANT' && String(invoice.tenant_id) !== String(req.user.id)) {
      throw new ApiError(403, 'This invoice does not belong to you');
    }
    if (['PAID', 'CANCELLED'].includes(invoice.status)) throw new ApiError(400, `Invoice is already ${invoice.status}`);

    const balance = Number(invoice.amount) - Number(invoice.amount_paid || 0);
    const amount = req.body.amount ? Number(req.body.amount) : balance;
    if (!(amount > 0)) throw new ApiError(400, 'Nothing to pay on this invoice');
    if (amount > balance) throw new ApiError(400, `Amount exceeds the outstanding balance (KSh ${balance.toFixed(2)})`);

    const reference = recon.invoiceReference(invoice.id);
    const result = await mpesa.stkPush({ phone, amount, accountReference: reference, description: 'Rent' });

    const payment = await Payment.create({
      amount: Math.ceil(amount),
      payment_method: 'MPESA',
      invoice_id: invoice.id,
      tenant_id: invoice.tenant_id || req.user.id,
      phone_number: mpesa.normalizePhone(phone),
      account_reference: reference,
      checkout_request_id: result.CheckoutRequestID,
      merchant_request_id: result.MerchantRequestID,
      gateway_response: result,
      status: 'PENDING',
    });

    return successResponse(res, {
      payment_id: payment.id,
      checkout_request_id: result.CheckoutRequestID,
      message: result.CustomerMessage || 'Check your phone and enter your M-Pesa PIN',
    }, 'STK push sent', 201);
  } catch (error) {
    return fail(res, error, 'Failed to initiate M-Pesa payment');
  }
};

/** Poll / force-refresh an STK payment status via Daraja query */
const getMpesaStatus = async (req, res) => {
  try {
    const payment = await Payment.findByPk(req.params.paymentId);
    if (!payment) throw new ApiError(404, 'Payment not found');
    if (req.user.role === 'TENANT' && String(payment.tenant_id) !== String(req.user.id)) {
      throw new ApiError(404, 'Payment not found');
    }

    if (payment.status === 'PENDING' && payment.checkout_request_id && mpesa.isConfigured()) {
      try {
        const q = await mpesa.stkQuery(payment.checkout_request_id);
        const code = Number(q.ResultCode);
        if (code === 0) await recon.confirmPayment(payment, { raw: q });
        else if (!Number.isNaN(code) && code !== 4999) await recon.failPayment(payment, q.ResultDesc, q); // 4999 = still processing
      } catch (e) {
        logger.warn(`STK query failed for payment ${payment.id}: ${e.message}`);
      }
    }
    return successResponse(res, { id: payment.id, status: payment.status, transaction_reference: payment.transaction_reference }, 'Payment status');
  } catch (error) {
    return fail(res, error, 'Failed to get payment status');
  }
};

/** PUBLIC: Daraja STK callback. Must always answer 200 quickly. */
const mpesaStkCallback = async (req, res) => {
  try {
    if (!mpesa.verifyCallbackToken(req)) {
      logger.warn('Rejected M-Pesa callback with invalid token');
      return res.status(200).json({ ResultCode: 1, ResultDesc: 'Rejected' });
    }
    const cb = mpesa.parseStkCallback(req.body);
    if (!cb) return res.status(200).json({ ResultCode: 0, ResultDesc: 'Ignored' });

    const payment = await Payment.findOne({ where: { checkout_request_id: cb.checkoutRequestId } });
    if (!payment) {
      logger.warn(`STK callback for unknown CheckoutRequestID ${cb.checkoutRequestId}`);
    } else if (cb.success) {
      await recon.confirmPayment(payment, { receipt: cb.receipt, phone: cb.phone, raw: req.body });
    } else {
      await recon.failPayment(payment, cb.resultDesc, req.body);
    }
  } catch (error) {
    logger.error(`M-Pesa callback error: ${error.message}`);
  }
  return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
};

/** PUBLIC: C2B validation – accept all; reconciliation happens on confirmation */
const mpesaC2bValidation = async (req, res) => {
  if (!mpesa.verifyCallbackToken(req)) return res.status(200).json({ ResultCode: 'C2B00016', ResultDesc: 'Rejected' });
  return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
};

/** PUBLIC: C2B confirmation – tenant paid via Paybill with account no. INV-<id> */
const mpesaC2bConfirmation = async (req, res) => {
  try {
    if (!mpesa.verifyCallbackToken(req)) return res.status(200).json({ ResultCode: 1, ResultDesc: 'Rejected' });
    const c2b = mpesa.parseC2B(req.body);
    await recon.recordIncomingPayment({
      method: 'MPESA',
      amount: c2b.amount,
      reference: c2b.receipt,
      accountReference: c2b.accountReference,
      phone: c2b.phone,
      payerName: c2b.payerName,
      raw: req.body,
    });
  } catch (error) {
    logger.error(`M-Pesa C2B confirmation error: ${error.message}`);
  }
  return res.status(200).json({ ResultCode: 0, ResultDesc: 'Accepted' });
};

const registerMpesaC2B = async (req, res) => {
  try {
    if (!isStaff(req.user)) throw new ApiError(403, 'Forbidden');
    const result = await mpesa.registerC2BUrls();
    return successResponse(res, result, 'C2B URLs registered');
  } catch (error) {
    return fail(res, error, 'Failed to register C2B URLs');
  }
};

/** PUBLIC: bank instant payment notification (HMAC signed) */
const bankWebhook = async (req, res) => {
  try {
    if (!bank.isConfigured()) throw new ApiError(503, 'Bank integration is not configured');
    if (!bank.verifySignature(req)) throw new ApiError(401, 'Invalid signature');

    const n = bank.normalize(req.body);
    if (!n.reference || !(n.amount > 0)) throw new ApiError(400, 'Missing transaction reference or amount');

    const { payment, duplicate } = await recon.recordIncomingPayment({
      method: 'BANK_TRANSFER',
      amount: n.amount,
      reference: n.reference,
      accountReference: n.accountReference,
      phone: n.phone,
      payerName: n.payerName,
      raw: req.body,
    });
    return successResponse(res, { payment_id: payment.id, status: payment.status, duplicate }, 'Bank notification processed');
  } catch (error) {
    return fail(res, error, 'Failed to process bank notification');
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
  matchPayment,
  deletePayment,
  getGateways,
  initiateMpesaStk,
  getMpesaStatus,
  mpesaStkCallback,
  mpesaC2bValidation,
  mpesaC2bConfirmation,
  registerMpesaC2B,
  bankWebhook,
};