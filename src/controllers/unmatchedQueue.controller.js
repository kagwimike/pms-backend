const { Op } = require('sequelize');
const Payment = require('../models/Payment');
const BankAccount = require('../models/BankAccount');
const BankStatementUpload = require('../models/BankStatementUpload');
const {
  getSuggestedMatchesForPayment,
  assignPaymentToInvoice,
  resolveUnmatchedPayment,
  getUnmatchedQueueStats,
} = require('../services/payments/unmatchedQueue.service');
const { successResponse, errorResponse } = require('../utils/formatResponse');
const AuditService = require('../services/audit.service');

const isStaff = (user) => user && ['ADMIN', 'OWNER'].includes(user.role);

/**
 * List all UNMATCHED deposits with pre-computed smart suggestions
 */
const getUnmatchedQueue = async (req, res) => {
  try {
    if (!isStaff(req.user)) {
      return errorResponse(res, 'Access denied. Only staff can access the unmatched reconciliation queue.', 403);
    }

    const {
      q,
      bank_account_id,
      statement_upload_id,
      min_amount,
      max_amount,
      date_from,
      date_to,
      page = 1,
      limit = 20,
    } = req.query;

    const where = {
      status: 'UNMATCHED',
    };

    if (bank_account_id) where.bank_account_id = bank_account_id;
    if (statement_upload_id) where.statement_upload_id = statement_upload_id;

    if (min_amount || max_amount) {
      where.amount = {};
      if (min_amount) where.amount[Op.gte] = parseFloat(min_amount);
      if (max_amount) where.amount[Op.lte] = parseFloat(max_amount);
    }

    if (date_from || date_to) {
      where.paid_at = {};
      if (date_from) where.paid_at[Op.gte] = new Date(date_from);
      if (date_to) where.paid_at[Op.lte] = new Date(date_to);
    }

    if (q) {
      const term = `%${q.trim()}%`;
      where[Op.or] = [
        { transaction_reference: { [Op.like]: term } },
        { account_reference: { [Op.like]: term } },
        { payer_name: { [Op.like]: term } },
        { notes: { [Op.like]: term } },
      ];
    }

    const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);

    const { count, rows } = await Payment.findAndCountAll({
      where,
      include: [
        {
          model: BankAccount,
          as: 'bank_account',
          attributes: ['id', 'bank_name', 'account_name', 'account_number', 'paybill_number'],
        },
        {
          model: BankStatementUpload,
          as: 'statement_upload',
          attributes: ['id', 'file_name', 'created_at'],
        },
      ],
      order: [['paid_at', 'DESC']],
      limit: parseInt(limit, 10),
      offset,
    });

    // Compute top suggested matches for each row in this page
    const itemsWithSuggestions = await Promise.all(
      rows.map(async (payment) => {
        const paymentJson = payment.toJSON();
        const suggestions = await getSuggestedMatchesForPayment(payment);
        paymentJson.suggested_matches = suggestions;
        return paymentJson;
      })
    );

    return successResponse(
      res,
      {
        total: count,
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        totalPages: Math.ceil(count / parseInt(limit, 10)),
        items: itemsWithSuggestions,
      },
      'Unmatched deposits retrieved successfully'
    );
  } catch (error) {
    console.error('Error in getUnmatchedQueue:', error);
    return errorResponse(res, 'Failed to fetch unmatched deposits queue', 500, error);
  }
};

/**
 * Real-time queue statistics
 */
const getQueueStats = async (req, res) => {
  try {
    if (!isStaff(req.user)) {
      return errorResponse(res, 'Access denied', 403);
    }

    const stats = await getUnmatchedQueueStats();
    return successResponse(res, stats, 'Unmatched queue statistics retrieved successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to compute queue statistics', 500, error);
  }
};

/**
 * 1-Click Assignment of an Unmatched Payment to an Invoice
 */
const assignPayment = async (req, res) => {
  try {
    if (!isStaff(req.user)) {
      return errorResponse(res, 'Access denied. Only staff can assign payments.', 403);
    }

    const { paymentId } = req.params;
    const { invoice_id, notes } = req.body;

    if (!invoice_id) {
      return errorResponse(res, 'Target invoice_id is required for assignment', 400);
    }

    const updatedPayment = await assignPaymentToInvoice({
      paymentId,
      invoiceId: invoice_id,
      notes,
    });

    await AuditService.logEvent({
      req,
      action: 'PAYMENT_1CLICK_MATCHED',
      module: 'FINANCE',
      entity_type: 'PAYMENT',
      entity_id: paymentId,
      summary: `Staff (${req.user.username}) assigned unmatched deposit #${paymentId} (KSh ${updatedPayment.amount}) to Invoice #${invoice_id}`,
      outcome: 'SUCCESS',
      details: {
        payment_id: paymentId,
        invoice_id,
        amount: updatedPayment.amount,
        reference: updatedPayment.transaction_reference,
      },
    });

    return successResponse(
      res,
      updatedPayment,
      `Payment #${paymentId} successfully matched and confirmed to Invoice #${invoice_id}`
    );
  } catch (error) {
    console.error('Error in assignPayment:', error);
    return errorResponse(res, error.message || 'Failed to assign payment', error.statusCode || 500, error);
  }
};

/**
 * Resolve / dismiss an unmatched transaction (e.g. non-rental, refund)
 */
const resolvePayment = async (req, res) => {
  try {
    if (!isStaff(req.user)) {
      return errorResponse(res, 'Access denied', 403);
    }

    const { paymentId } = req.params;
    const { resolution, reason } = req.body;

    if (!resolution) {
      return errorResponse(res, 'Resolution type required (NON_RENTAL, REFUNDED, or CANCELLED)', 400);
    }

    const resolved = await resolveUnmatchedPayment({
      paymentId,
      resolution,
      reason,
    });

    await AuditService.logEvent({
      req,
      action: 'PAYMENT_UNMATCHED_RESOLVED',
      module: 'FINANCE',
      entity_type: 'PAYMENT',
      entity_id: paymentId,
      summary: `Staff dismissed deposit #${paymentId} from unmatched queue as [${resolution}]`,
      outcome: 'SUCCESS',
      details: {
        resolution,
        reason,
      },
    });

    return successResponse(res, resolved, `Unmatched deposit #${paymentId} marked as ${resolution}`);
  } catch (error) {
    return errorResponse(res, error.message || 'Failed to resolve payment', error.statusCode || 500, error);
  }
};

/**
 * On-demand candidates calculation for a single payment
 */
const getPaymentCandidates = async (req, res) => {
  try {
    if (!isStaff(req.user)) {
      return errorResponse(res, 'Access denied', 403);
    }

    const payment = await Payment.findByPk(req.params.paymentId, {
      include: [{ association: 'bank_account' }],
    });

    if (!payment) {
      return errorResponse(res, 'Payment not found', 404);
    }

    const candidates = await getSuggestedMatchesForPayment(payment);
    return successResponse(res, candidates, 'Candidate invoice matches retrieved successfully');
  } catch (error) {
    return errorResponse(res, 'Failed to fetch candidate matches', 500, error);
  }
};

module.exports = {
  getUnmatchedQueue,
  getQueueStats,
  assignPayment,
  resolvePayment,
  getPaymentCandidates,
};
