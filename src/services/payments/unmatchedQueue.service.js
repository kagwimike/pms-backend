const { Op } = require('sequelize');
const Payment = require('../../models/Payment');
const Invoice = require('../../models/Invoice');
const Lease = require('../../models/Lease');
const Unit = require('../../models/Unit');
const Property = require('../../models/Property');
const User = require('../../models/User');
const BankAccount = require('../../models/BankAccount');
const BankStatementUpload = require('../../models/BankStatementUpload');
const NotificationService = require('../notification.service');
const { recalcInvoice, confirmPayment } = require('./reconciliation.service');
const ApiError = require('../../utils/ApiError');
const logger = require('../../utils/logger');

/**
 * Score potential matching invoices for an unmatched payment
 */
const getSuggestedMatchesForPayment = async (payment) => {
  const pAmount = Number(payment.amount);
  const narration = String(payment.account_reference || '').toLowerCase();
  const payerName = String(payment.payer_name || '').toLowerCase();
  const fullText = `${narration} ${payerName}`.trim();

  // Find all unpaid or partially paid invoices with active leases
  const openInvoices = await Invoice.findAll({
    where: {
      status: { [Op.in]: ['PENDING', 'PARTIAL', 'OVERDUE'] },
    },
    include: [
      {
        model: Lease,
        as: 'lease',
        include: [
          {
            model: Unit,
            as: 'unit',
            include: [{ model: Property, as: 'property', attributes: ['id', 'name'] }],
          },
        ],
      },
      {
        model: User,
        as: 'tenant',
        attributes: ['id', 'username', 'first_name', 'last_name', 'phone', 'tenant_id_passport'],
      },
    ],
    order: [['due_date', 'ASC']],
    limit: 150,
  });

  const scoredCandidates = [];

  for (const inv of openInvoices) {
    let score = 0;
    const reasons = [];

    const total = Number(inv.amount);
    const paid = Number(inv.amount_paid || 0);
    const balance = total - paid;

    // 1. Amount matching
    if (Math.abs(balance - pAmount) < 0.01) {
      score += 45;
      reasons.push(`Exact balance match (KSh ${pAmount.toLocaleString()})`);
    } else if (Math.abs(total - pAmount) < 0.01) {
      score += 35;
      reasons.push(`Exact invoice total match (KSh ${total.toLocaleString()})`);
    } else if (Math.abs(balance - pAmount) <= 500) {
      score += 15;
      reasons.push(`Close balance match (within KSh 500)`);
    }

    // 2. Unit number matching
    const unitNo = inv.lease?.unit?.unit_number?.toLowerCase()?.trim();
    if (unitNo && unitNo.length >= 2) {
      const unitRegex = new RegExp(`(?:unit|apt|house|flat|rm)?\\s*[-#]?\\s*${unitNo}(?:\\b|[^a-zA-Z0-9])`, 'i');
      if (unitRegex.test(fullText)) {
        score += 35;
        reasons.push(`Unit number [${inv.lease.unit.unit_number}] mentioned in narration/particulars`);
      }
    }

    // 3. Tenant matching (Name, Phone, National ID)
    const tenant = inv.tenant;
    if (tenant) {
      const fName = String(tenant.first_name || '').toLowerCase().trim();
      const lName = String(tenant.last_name || '').toLowerCase().trim();
      const uName = String(tenant.username || '').toLowerCase().trim();
      const natId = String(tenant.tenant_id_passport || '').trim();

      if (natId && natId.length >= 6 && fullText.includes(natId)) {
        score += 40;
        reasons.push(`National ID / Passport [${natId}] matched`);
      }

      if (fName.length > 2 && fullText.includes(fName)) {
        score += 25;
        reasons.push(`Tenant first name [${tenant.first_name}] found`);
      }
      if (lName.length > 2 && fullText.includes(lName)) {
        score += 25;
        reasons.push(`Tenant last name [${tenant.last_name}] found`);
      } else if (uName.length > 3 && fullText.includes(uName)) {
        score += 20;
        reasons.push(`Username [${tenant.username}] found`);
      }

      if (tenant.phone && tenant.phone.length >= 9) {
        const cleanPhone = tenant.phone.replace(/[^0-9]/g, '');
        const last7 = cleanPhone.slice(-7);
        if (fullText.includes(last7)) {
          score += 30;
          reasons.push(`Phone number snippet matched`);
        }
      }
    }

    // 4. Property matching
    if (payment.bank_account && payment.bank_account.property_id) {
      if (inv.lease?.unit?.property_id === payment.bank_account.property_id) {
        score += 15;
        reasons.push(`Property matches dedicated bank account`);
      }
    }

    if (score >= 20) {
      scoredCandidates.push({
        invoice_id: inv.id,
        invoice_amount: total,
        balance_due: balance,
        due_date: inv.due_date,
        property_name: inv.lease?.unit?.property?.name || 'Unknown Property',
        unit_number: inv.lease?.unit?.unit_number || 'N/A',
        tenant_id: inv.tenant_id,
        tenant_name: tenant
          ? `${tenant.first_name || ''} ${tenant.last_name || ''} (@${tenant.username})`.trim()
          : 'Unknown Tenant',
        confidence_score: Math.min(score, 100),
        reasons,
      });
    }
  }

  // Sort descending by confidence score
  scoredCandidates.sort((a, b) => b.confidence_score - a.confidence_score);

  return scoredCandidates.slice(0, 5);
};

/**
 * 1-Click Assignment of an Unmatched Payment to an Invoice
 */
const assignPaymentToInvoice = async ({ paymentId, invoiceId, notes }) => {
  const payment = await Payment.findByPk(paymentId, {
    include: [{ association: 'statement_upload' }],
  });

  if (!payment) {
    throw new ApiError(404, 'Payment record not found');
  }

  if (payment.status === 'CONFIRMED') {
    throw new ApiError(400, 'Payment is already confirmed and matched');
  }

  const invoice = await Invoice.findByPk(invoiceId, {
    include: [{ association: 'tenant' }],
  });

  if (!invoice) {
    throw new ApiError(404, 'Target invoice not found');
  }

  if (invoice.status === 'CANCELLED') {
    throw new ApiError(400, 'Cannot match payment to a cancelled invoice');
  }

  // Update payment linkage
  payment.invoice_id = invoice.id;
  payment.tenant_id = invoice.tenant_id || payment.tenant_id;
  payment.status = 'CONFIRMED';
  payment.is_confirmed = true;
  if (notes) {
    payment.notes = payment.notes ? `${payment.notes} | ${notes}` : notes;
  }
  await payment.save();

  // Recalculate invoice balance and status
  await recalcInvoice(invoice.id);

  // Notify tenant of confirmed receipt
  if (payment.tenant_id) {
    try {
      await NotificationService.notifyPaymentReceived(
        payment.tenant_id,
        payment.amount,
        invoice.id
      );
    } catch (e) {
      logger.warn('Failed to dispatch payment notification to tenant:', e.message);
    }
  }

  // Update BankStatementUpload stats if the payment was part of an upload
  if (payment.statement_upload_id) {
    try {
      const upload = await BankStatementUpload.findByPk(payment.statement_upload_id);
      if (upload) {
        upload.matched_count = (upload.matched_count || 0) + 1;
        upload.unmatched_count = Math.max((upload.unmatched_count || 1) - 1, 0);
        await upload.save();
      }
    } catch (e) {
      logger.warn('Failed to update BankStatementUpload count:', e.message);
    }
  }

  await payment.reload({
    include: [
      { association: 'invoice' },
      { association: 'tenant' },
      { association: 'bank_account' },
    ],
  });

  return payment;
};

/**
 * Resolve an Unmatched Deposit that is not rental income (refund, non-rental, cancelled)
 */
const resolveUnmatchedPayment = async ({ paymentId, resolution, reason }) => {
  const payment = await Payment.findByPk(paymentId);
  if (!payment) {
    throw new ApiError(404, 'Payment record not found');
  }

  const validResolutions = ['NON_RENTAL', 'REFUNDED', 'CANCELLED'];
  if (!validResolutions.includes(resolution)) {
    throw new ApiError(400, `Invalid resolution. Expected one of: ${validResolutions.join(', ')}`);
  }

  const newStatus = resolution === 'REFUNDED' ? 'REFUNDED' : 'CANCELLED';
  payment.status = newStatus;
  payment.is_confirmed = false;
  payment.notes = payment.notes
    ? `${payment.notes} | Resolution [${resolution}]: ${reason || 'Dismissed from queue'}`
    : `Resolution [${resolution}]: ${reason || 'Dismissed from queue'}`;

  await payment.save();

  // Update BankStatementUpload count if linked
  if (payment.statement_upload_id) {
    try {
      const upload = await BankStatementUpload.findByPk(payment.statement_upload_id);
      if (upload) {
        upload.unmatched_count = Math.max((upload.unmatched_count || 1) - 1, 0);
        await upload.save();
      }
    } catch (_) {}
  }

  return payment;
};

/**
 * Compute real-time Unmatched Queue Statistics
 */
const getUnmatchedQueueStats = async () => {
  const where = {
    status: 'UNMATCHED',
  };

  const count = await Payment.count({ where });
  const totalAmount = await Payment.sum('amount', { where }) || 0;

  const oldest = await Payment.findOne({
    where,
    order: [['paid_at', 'ASC']],
    attributes: ['paid_at', 'transaction_reference'],
  });

  // Group by Bank Account
  const bankAccounts = await BankAccount.findAll({
    attributes: ['id', 'bank_name', 'account_number', 'account_name'],
  });

  const byBank = [];
  for (const acc of bankAccounts) {
    const accCount = await Payment.count({
      where: { ...where, bank_account_id: acc.id },
    });
    const accAmount = await Payment.sum('amount', {
      where: { ...where, bank_account_id: acc.id },
    }) || 0;

    if (accCount > 0) {
      byBank.push({
        bank_account_id: acc.id,
        bank_name: acc.bank_name,
        account_number: acc.account_number,
        account_name: acc.account_name,
        count: accCount,
        total_amount: Number(accAmount),
      });
    }
  }

  return {
    total_unmatched_count: count,
    total_unmatched_amount: Number(totalAmount),
    oldest_unmatched_date: oldest?.paid_at || null,
    by_bank_account: byBank,
  };
};

module.exports = {
  getSuggestedMatchesForPayment,
  assignPaymentToInvoice,
  resolveUnmatchedPayment,
  getUnmatchedQueueStats,
};
