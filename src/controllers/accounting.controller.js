const { Op } = require('sequelize');
const Account = require('../models/Account');
const AccountingPeriod = require('../models/AccountingPeriod');
const JournalEntry = require('../models/JournalEntry');
const JournalLine = require('../models/JournalLine');
const AccountingService = require('../services/accounting/accounting.service');
const AccountingReportService = require('../services/accounting/accountingReport.service');
const AuditService = require('../services/audit.service');
const ApiError = require('../utils/ApiError');
const { successResponse, errorResponse } = require('../utils/formatResponse');

const fail = (res, error, fallback) => {
  console.error(fallback, error);
  return errorResponse(res, error.message || fallback, error.statusCode || 400, error);
};

// ══════════════════════════════════════════════════════════════════════
// CHART OF ACCOUNTS
// ══════════════════════════════════════════════════════════════════════

const getAccounts = async (req, res) => {
  try {
    const { type, category, active } = req.query;
    const where = {};
    if (type) where.account_type = type;
    if (category) where.category = category;
    if (active !== undefined) where.is_active = active === 'true';

    const accounts = await Account.findAll({
      where,
      include: [{ model: Account, as: 'sub_accounts' }],
      order: [['account_code', 'ASC']],
    });

    return successResponse(res, accounts, 'Chart of Accounts retrieved successfully');
  } catch (err) {
    return fail(res, err, 'Failed to fetch Chart of Accounts');
  }
};

const getAccount = async (req, res) => {
  try {
    const account = await Account.findByPk(req.params.id, {
      include: [{ model: Account, as: 'sub_accounts' }, { model: Account, as: 'parent_account' }],
    });
    if (!account) throw new ApiError(404, 'Account not found');
    return successResponse(res, account, 'Account retrieved successfully');
  } catch (err) {
    return fail(res, err, 'Failed to fetch account');
  }
};

const createAccount = async (req, res) => {
  try {
    const { account_code, account_name, account_type, normal_balance, category, description, parent_id } = req.body;
    if (!account_code || !account_name || !account_type || !normal_balance) {
      throw new ApiError(400, 'account_code, account_name, account_type, and normal_balance are required.');
    }

    const existing = await Account.findOne({ where: { account_code } });
    if (existing) {
      throw new ApiError(400, `Account code '${account_code}' already exists.`);
    }

    const account = await Account.create({
      account_code,
      account_name,
      account_type,
      normal_balance,
      category: category || 'GENERAL',
      description,
      parent_id: parent_id || null,
      is_system: false,
      is_active: true,
    });

    await AuditService.logFinance({
      req,
      action: 'ACCOUNT_CREATE',
      entityType: 'ACCOUNT',
      entityId: account.id,
      summary: `Created Account ${account.account_code} - ${account.account_name} (${account.account_type})`,
    });

    return successResponse(res, account, 'Account created successfully', 201);
  } catch (err) {
    return fail(res, err, 'Failed to create account');
  }
};

const updateAccount = async (req, res) => {
  try {
    const account = await Account.findByPk(req.params.id);
    if (!account) throw new ApiError(404, 'Account not found');

    const { account_name, category, description, is_active, parent_id } = req.body;
    if (account_name) account.account_name = account_name;
    if (category) account.category = category;
    if (description !== undefined) account.description = description;
    if (is_active !== undefined) account.is_active = is_active;
    if (parent_id !== undefined) account.parent_id = parent_id;

    await account.save();

    await AuditService.logFinance({
      req,
      action: 'ACCOUNT_UPDATE',
      entityType: 'ACCOUNT',
      entityId: account.id,
      summary: `Updated Account ${account.account_code} - ${account.account_name}`,
    });

    return successResponse(res, account, 'Account updated successfully');
  } catch (err) {
    return fail(res, err, 'Failed to update account');
  }
};

const deleteAccount = async (req, res) => {
  try {
    const account = await Account.findByPk(req.params.id);
    if (!account) throw new ApiError(404, 'Account not found');
    if (account.is_system) {
      throw new ApiError(400, 'System control accounts cannot be deleted.');
    }

    // Check if account has any posted journal lines
    const lineCount = await JournalLine.count({ where: { account_id: account.id } });
    if (lineCount > 0) {
      throw new ApiError(400, `Cannot delete account '${account.account_code}' as it contains ${lineCount} posted transaction lines. Archive/Deactivate it instead.`);
    }

    await account.destroy();

    await AuditService.logFinance({
      req,
      action: 'ACCOUNT_DELETE',
      entityType: 'ACCOUNT',
      entityId: account.id,
      summary: `Deleted Account ${account.account_code}`,
    });

    return successResponse(res, null, 'Account deleted successfully');
  } catch (err) {
    return fail(res, err, 'Failed to delete account');
  }
};

// ══════════════════════════════════════════════════════════════════════
// JOURNAL ENTRIES
// ══════════════════════════════════════════════════════════════════════

const getJournalEntries = async (req, res) => {
  try {
    const { status, source_type, start_date, end_date, reference, page = 1, limit = 50 } = req.query;
    const where = {};
    if (status) where.status = status;
    if (source_type) where.source_type = source_type;
    if (reference) where.reference = { [Op.like]: `%${reference}%` };

    if (start_date && end_date) {
      where.posting_date = { [Op.between]: [start_date, end_date] };
    } else if (start_date) {
      where.posting_date = { [Op.gte]: start_date };
    } else if (end_date) {
      where.posting_date = { [Op.lte]: end_date };
    }

    const offset = (Number(page) - 1) * Number(limit);
    const { count, rows } = await JournalEntry.findAndCountAll({
      where,
      include: [
        { model: JournalLine, as: 'lines', include: [{ model: Account, as: 'account', attributes: ['account_code', 'account_name', 'account_type'] }] },
        { model: AccountingPeriod, as: 'period', attributes: ['period_name', 'status'] },
      ],
      order: [['posting_date', 'DESC'], ['id', 'DESC']],
      limit: Number(limit),
      offset,
    });

    return successResponse(res, {
      total_count: count,
      page: Number(page),
      limit: Number(limit),
      total_pages: Math.ceil(count / Number(limit)),
      entries: rows,
    }, 'Journal entries retrieved successfully');
  } catch (err) {
    return fail(res, err, 'Failed to fetch journal entries');
  }
};

const getJournalEntry = async (req, res) => {
  try {
    const entry = await JournalEntry.findByPk(req.params.id, {
      include: [
        { model: JournalLine, as: 'lines', include: ['account', 'property', 'unit', 'tenant', 'owner', 'vendor', 'bank_account'] },
        'period',
        'created_by',
        'posted_by',
        'reversed_by',
        'reversal_entry',
      ],
    });
    if (!entry) throw new ApiError(404, 'Journal entry not found');
    return successResponse(res, entry, 'Journal entry retrieved successfully');
  } catch (err) {
    return fail(res, err, 'Failed to fetch journal entry');
  }
};

const createManualJournalEntry = async (req, res) => {
  try {
    const { entry_date, posting_date, reference, description, lines } = req.body;
    const entry = await AccountingService.postJournalEntry({
      entry_date,
      posting_date,
      source_type: 'MANUAL',
      reference,
      description,
      lines,
      created_by_id: req.user?.id || null,
      posted_by_id: req.user?.id || null,
    });

    await AuditService.logFinance({
      req,
      action: 'JOURNAL_POST',
      entityType: 'JOURNAL',
      entityId: entry.id,
      summary: `Posted Manual Journal ${entry.entry_number} for KSh ${entry.total_debit}`,
    });

    return successResponse(res, entry, 'Manual Journal Entry posted successfully', 201);
  } catch (err) {
    return fail(res, err, 'Failed to post manual journal entry');
  }
};

const reverseJournalEntry = async (req, res) => {
  try {
    const { reason } = req.body;
    const result = await AccountingService.reverseJournalEntry(req.params.id, {
      reason,
      reversed_by_id: req.user?.id || null,
    });

    await AuditService.logFinance({
      req,
      action: 'JOURNAL_REVERSAL',
      entityType: 'JOURNAL',
      entityId: result.original.id,
      summary: `Reversed Journal ${result.original.entry_number} via ${result.reversingEntry.entry_number}: ${reason}`,
    });

    return successResponse(res, result, 'Journal entry reversed successfully');
  } catch (err) {
    return fail(res, err, 'Failed to reverse journal entry');
  }
};

// ══════════════════════════════════════════════════════════════════════
// FINANCIAL REPORTS & LEDGERS
// ══════════════════════════════════════════════════════════════════════

const getGeneralLedger = async (req, res) => {
  try {
    const data = await AccountingReportService.getGeneralLedger(req.query);
    return successResponse(res, data, 'General Ledger retrieved successfully');
  } catch (err) {
    return fail(res, err, 'Failed to fetch General Ledger');
  }
};

const getTrialBalance = async (req, res) => {
  try {
    const data = await AccountingReportService.getTrialBalance(req.query);
    return successResponse(res, data, 'Trial Balance generated successfully');
  } catch (err) {
    return fail(res, err, 'Failed to generate Trial Balance');
  }
};

const getProfitAndLoss = async (req, res) => {
  try {
    const data = await AccountingReportService.getProfitAndLoss(req.query);
    return successResponse(res, data, 'Profit & Loss Statement generated successfully');
  } catch (err) {
    return fail(res, err, 'Failed to generate Profit & Loss Statement');
  }
};

const getBalanceSheet = async (req, res) => {
  try {
    const data = await AccountingReportService.getBalanceSheet(req.query);
    return successResponse(res, data, 'Balance Sheet generated successfully');
  } catch (err) {
    return fail(res, err, 'Failed to generate Balance Sheet');
  }
};

const getCashFlow = async (req, res) => {
  try {
    const data = await AccountingReportService.getCashFlowStatement(req.query);
    return successResponse(res, data, 'Cash Flow Statement generated successfully');
  } catch (err) {
    return fail(res, err, 'Failed to generate Cash Flow Statement');
  }
};

const getTenantSubledger = async (req, res) => {
  try {
    const tenantId = req.params.tenantId || req.query.tenantId || req.query.tenant_id;
    const data = await AccountingReportService.getTenantSubledger(tenantId, req.query);
    return successResponse(res, data, 'Tenant Subledger retrieved successfully');
  } catch (err) {
    return fail(res, err, 'Failed to fetch Tenant Subledger');
  }
};

const getOwnerSubledger = async (req, res) => {
  try {
    const ownerId = req.params.ownerId || req.query.ownerId || req.query.owner_id;
    const data = await AccountingReportService.getOwnerSubledger(ownerId, req.query);
    return successResponse(res, data, 'Owner Subledger retrieved successfully');
  } catch (err) {
    return fail(res, err, 'Failed to fetch Owner Subledger');
  }
};

const getARAging = async (req, res) => {
  try {
    const data = await AccountingReportService.getARAging(req.query);
    return successResponse(res, data, 'Accounts Receivable Aging generated successfully');
  } catch (err) {
    return fail(res, err, 'Failed to generate AR Aging');
  }
};

const getDashboardSummary = async (req, res) => {
  try {
    const data = await AccountingReportService.getDashboardSummary(req.query);
    return successResponse(res, data, 'Accounting Dashboard Summary retrieved successfully');
  } catch (err) {
    return fail(res, err, 'Failed to fetch Accounting Dashboard summary');
  }
};

// ══════════════════════════════════════════════════════════════════════
// ACCOUNTING PERIODS
// ══════════════════════════════════════════════════════════════════════

const getPeriods = async (req, res) => {
  try {
    const { year } = req.query;
    const where = {};
    if (year) where.fiscal_year = Number(year);

    const periods = await AccountingPeriod.findAll({
      where,
      include: [{ model: require('../models/User'), as: 'closed_by', attributes: ['id', 'username', 'first_name', 'last_name'] }],
      order: [['fiscal_year', 'DESC'], ['period_number', 'ASC']],
    });

    return successResponse(res, periods, 'Accounting periods retrieved successfully');
  } catch (err) {
    return fail(res, err, 'Failed to fetch accounting periods');
  }
};

const closePeriod = async (req, res) => {
  try {
    const period = await AccountingPeriod.findByPk(req.params.id);
    if (!period) throw new ApiError(404, 'Accounting period not found');
    if (period.status === 'CLOSED') throw new ApiError(400, 'Period is already closed.');

    // Pre-flight check: Verify Trial Balance equality
    const tb = await AccountingReportService.getTrialBalance({
      start_date: period.start_date,
      end_date: period.end_date,
    });

    if (!tb.is_balanced) {
      throw new ApiError(400, `Cannot close period: Trial Balance has an unresolved discrepancy of KSh ${tb.difference}. Resolve unposted or unbalanced items before closing.`);
    }

    period.status = 'CLOSED';
    period.closed_by_id = req.user?.id || null;
    period.closed_at = new Date();
    period.close_notes = req.body.notes || 'Normal monthly period closure';
    await period.save();

    await AuditService.logFinance({
      req,
      action: 'PERIOD_CLOSE',
      entityType: 'PERIOD',
      entityId: period.id,
      summary: `Closed Accounting Period '${period.period_name}' (${period.start_date} to ${period.end_date})`,
    });

    return successResponse(res, period, `Period '${period.period_name}' closed successfully`);
  } catch (err) {
    return fail(res, err, 'Failed to close accounting period');
  }
};

const reopenPeriod = async (req, res) => {
  try {
    const period = await AccountingPeriod.findByPk(req.params.id);
    if (!period) throw new ApiError(404, 'Accounting period not found');
    if (period.status !== 'CLOSED') throw new ApiError(400, 'Period is not currently closed.');

    const reason = req.body.reason;
    if (!reason || reason.trim() === '') {
      throw new ApiError(400, 'A formal authorization reason is required to reopen a closed accounting period.');
    }

    period.status = 'OPEN';
    period.close_notes = `Reopened: ${reason} (by user #${req.user?.id || 'staff'} on ${new Date().toISOString()})`;
    await period.save();

    await AuditService.logFinance({
      req,
      action: 'PERIOD_REOPEN',
      entityType: 'PERIOD',
      entityId: period.id,
      summary: `Reopened Accounting Period '${period.period_name}': ${reason}`,
    });

    return successResponse(res, period, `Period '${period.period_name}' reopened successfully`);
  } catch (err) {
    return fail(res, err, 'Failed to reopen accounting period');
  }
};

// ══════════════════════════════════════════════════════════════════════
// HISTORICAL POSTINGS BOOTSTRAP / MIGRATION
// ══════════════════════════════════════════════════════════════════════

const migrateHistoricalPostings = async (req, res) => {
  try {
    const initAccountingSystem = require('../scripts/init_accounting_system');
    await initAccountingSystem();

    const Invoice = require('../models/Invoice');
    const Payment = require('../models/Payment');
    const DepositRefund = require('../models/DepositRefund');

    let invoiceCount = 0;
    let paymentCount = 0;
    let refundCount = 0;

    // Post all unposted invoices
    const invoices = await Invoice.findAll();
    for (const inv of invoices) {
      const existing = await JournalEntry.findOne({ where: { source_type: 'INVOICE', source_id: String(inv.id), status: 'POSTED' } });
      if (!existing && Number(inv.amount) > 0) {
        await AccountingService.postRentCharge(inv.id);
        invoiceCount++;
      }
    }

    // Post all confirmed unposted payments
    const payments = await Payment.findAll({ where: { status: 'CONFIRMED' } });
    for (const pay of payments) {
      const existing = await JournalEntry.findOne({ where: { source_type: 'PAYMENT', source_id: String(pay.id), status: 'POSTED' } });
      if (!existing && Number(pay.amount) > 0) {
        await AccountingService.postPaymentReceipt(pay.id);
        paymentCount++;
      }
    }

    // Post unposted deposit refunds
    const refunds = await DepositRefund.findAll();
    for (const ref of refunds) {
      const existing = await JournalEntry.findOne({ where: { source_type: 'DEPOSIT_REFUND', source_id: String(ref.id), status: 'POSTED' } });
      if (!existing) {
        await AccountingService.postDepositRefund(ref.id);
        refundCount++;
      }
    }

    return successResponse(res, {
      invoices_posted: invoiceCount,
      payments_posted: paymentCount,
      refunds_posted: refundCount,
    }, 'Historical financial transactions successfully bootstrapped into double-entry accounting records.');
  } catch (err) {
    return fail(res, err, 'Failed to migrate historical postings');
  }
};

module.exports = {
  getAccounts,
  getAccount,
  createAccount,
  updateAccount,
  deleteAccount,
  getJournalEntries,
  getJournalEntry,
  createManualJournalEntry,
  reverseJournalEntry,
  getGeneralLedger,
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  getCashFlow,
  getTenantSubledger,
  getOwnerSubledger,
  getARAging,
  getDashboardSummary,
  getPeriods,
  closePeriod,
  reopenPeriod,
  migrateHistoricalPostings,
};
