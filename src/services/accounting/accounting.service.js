const { Op } = require('sequelize');
const { sequelize } = require('../../config/db');
const Account = require('../../models/Account');
const AccountingPeriod = require('../../models/AccountingPeriod');
const JournalEntry = require('../../models/JournalEntry');
const JournalLine = require('../../models/JournalLine');
const AccountingSetting = require('../../models/AccountingSetting');
const Invoice = require('../../models/Invoice');
const Payment = require('../../models/Payment');
const DepositRefund = require('../../models/DepositRefund');
const Lease = require('../../models/Lease');
const Unit = require('../../models/Unit');
const Property = require('../../models/Property');
const User = require('../../models/User');
const BankAccount = require('../../models/BankAccount');
const ApiError = require('../../utils/ApiError');
const AuditService = require('../audit.service');
const logger = require('../../utils/logger');

class AccountingService {
  /**
   * Helper: Get account by code or ID
   */
  static async getAccount(codeOrId, transaction = null) {
    let account;
    if (typeof codeOrId === 'number' || /^\d+$/.test(String(codeOrId)) && String(codeOrId).length < 4) {
      account = await Account.findByPk(codeOrId, { transaction });
    }
    if (!account) {
      account = await Account.findOne({ where: { account_code: String(codeOrId) }, transaction });
    }
    if (!account) {
      throw new ApiError(404, `Accounting Account not found for reference: ${codeOrId}`);
    }
    return account;
  }

  /**
   * Helper: Resolve open accounting period for a given date
   */
  static async resolvePeriod(dateStr, transaction = null) {
    const targetDate = dateStr || new Date().toISOString().slice(0, 10);
    const period = await AccountingPeriod.findOne({
      where: {
        start_date: { [Op.lte]: targetDate },
        end_date: { [Op.gte]: targetDate },
      },
      transaction,
    });

    if (!period) {
      // Auto-create or resolve by year and month
      const d = new Date(targetDate);
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const [newPeriod] = await AccountingPeriod.findOrCreate({
        where: { fiscal_year: year, period_number: month },
        defaults: {
          period_name: `Period ${month}-${year}`,
          fiscal_year: year,
          period_number: month,
          start_date: `${year}-${month < 10 ? '0' + month : month}-01`,
          end_date: `${year}-${month < 10 ? '0' + month : month}-${new Date(year, month, 0).getDate()}`,
          status: 'OPEN',
        },
        transaction,
      });
      return newPeriod;
    }

    if (period.status !== 'OPEN') {
      throw new ApiError(400, `Accounting Period '${period.period_name}' is ${period.status}. Postings are forbidden.`);
    }

    return period;
  }

  /**
   * Generate sequential unique journal entry number: JE-YYYY-XXXXX
   */
  static async generateEntryNumber(year, transaction = null) {
    const prefix = `JE-${year}-`;
    const count = await JournalEntry.count({
      where: {
        entry_number: { [Op.like]: `${prefix}%` },
      },
      transaction,
    });
    const sequence = String(count + 1).padStart(5, '0');
    return `${prefix}${sequence}`;
  }

  /**
   * Core Double-Entry Posting Engine
   * Validates:
   * 1. Minimum 2 lines
   * 2. Sum(Debits) === Sum(Credits) strictly
   * 3. Target period is OPEN
   * 4. Idempotency on source_type & source_id
   */
  static async postJournalEntry({
    entry_date,
    posting_date,
    source_type = 'MANUAL',
    source_id = null,
    reference = null,
    description,
    lines = [],
    created_by_id = null,
    posted_by_id = null,
    status = 'POSTED',
  }, externalTransaction = null) {
    if (!description || description.trim() === '') {
      throw new ApiError(400, 'Journal entry description is required.');
    }

    if (!lines || lines.length < 2) {
      throw new ApiError(400, 'A valid double-entry journal requires at least two lines (one debit and one credit).');
    }

    const t = externalTransaction || await sequelize.transaction();

    try {
      // Check idempotency for automated source transactions
      if (source_type !== 'MANUAL' && source_id) {
        const existing = await JournalEntry.findOne({
          where: {
            source_type,
            source_id: String(source_id),
            status: 'POSTED',
          },
          include: ['lines'],
          transaction: t,
        });
        if (existing) {
          logger.info(`Idempotent check: Journal ${existing.entry_number} already posted for ${source_type} #${source_id}`);
          if (!externalTransaction) await t.commit();
          return existing;
        }
      }

      const effectiveDate = posting_date || entry_date || new Date().toISOString().slice(0, 10);
      const period = await this.resolvePeriod(effectiveDate, t);

      // Validate lines and sum debits and credits with strict 2-decimal precision
      let totalDebit = 0;
      let totalCredit = 0;
      const validatedLines = [];

      for (const line of lines) {
        const account = await this.getAccount(line.account_id || line.account_code, t);
        const debit = Math.round(Number(line.debit || 0) * 100) / 100;
        const credit = Math.round(Number(line.credit || 0) * 100) / 100;

        if (debit < 0 || credit < 0) {
          throw new ApiError(400, 'Negative debit or credit amounts are not permitted. Use proper debit/credit classification.');
        }
        if (debit === 0 && credit === 0) {
          continue; // skip zero lines
        }
        if (debit > 0 && credit > 0) {
          throw new ApiError(400, 'A journal line cannot have both a debit and a credit amount.');
        }

        totalDebit += debit;
        totalCredit += credit;

        validatedLines.push({
          account_id: account.id,
          debit,
          credit,
          description: line.description || description,
          property_id: line.property_id || null,
          unit_id: line.unit_id || null,
          tenant_id: line.tenant_id || null,
          lease_id: line.lease_id || null,
          owner_id: line.owner_id || null,
          vendor_id: line.vendor_id || null,
          bank_account_id: line.bank_account_id || null,
        });
      }

      totalDebit = Math.round(totalDebit * 100) / 100;
      totalCredit = Math.round(totalCredit * 100) / 100;

      const difference = Math.abs(totalDebit - totalCredit);
      if (difference > 0.01) {
        throw new ApiError(400, `Unbalanced Journal Entry! Total Debits (KSh ${totalDebit.toFixed(2)}) must equal Total Credits (KSh ${totalCredit.toFixed(2)}). Discrepancy: KSh ${difference.toFixed(2)}`);
      }

      const year = new Date(effectiveDate).getFullYear();
      const entry_number = await this.generateEntryNumber(year, t);

      const entry = await JournalEntry.create({
        entry_number,
        entry_date: entry_date || effectiveDate,
        posting_date: effectiveDate,
        period_id: period.id,
        status,
        source_type,
        source_id: source_id ? String(source_id) : null,
        reference: reference || null,
        description,
        total_debit: totalDebit,
        total_credit: totalCredit,
        is_balanced: true,
        created_by_id: created_by_id || null,
        posted_by_id: posted_by_id || created_by_id || null,
        posted_at: status === 'POSTED' ? new Date() : null,
      }, { transaction: t });

      for (const vl of validatedLines) {
        await JournalLine.create({
          journal_entry_id: entry.id,
          ...vl,
        }, { transaction: t });
      }

      if (!externalTransaction) {
        await t.commit();
      }

      logger.info(`Successfully posted double-entry journal ${entry.entry_number} (KSh ${totalDebit.toFixed(2)})`);
      return await JournalEntry.findByPk(entry.id, {
        include: [{ model: JournalLine, as: 'lines', include: ['account'] }, 'period'],
      });
    } catch (err) {
      if (!externalTransaction) await t.rollback();
      throw err;
    }
  }

  /**
   * Reverse an existing posted journal entry
   * Creates an exact mirror opposite entry and marks original as REVERSED
   */
  static async reverseJournalEntry(journalId, { reason, reversed_by_id = null }, externalTransaction = null) {
    if (!reason || reason.trim() === '') {
      throw new ApiError(400, 'A reversal reason must be documented.');
    }

    const t = externalTransaction || await sequelize.transaction();

    try {
      const original = await JournalEntry.findByPk(journalId, {
        include: [{ model: JournalLine, as: 'lines' }],
        transaction: t,
      });

      if (!original) {
        throw new ApiError(404, 'Journal entry not found for reversal.');
      }

      if (original.status !== 'POSTED') {
        throw new ApiError(400, `Cannot reverse a journal with status '${original.status}'. Only POSTED journals can be reversed.`);
      }

      const today = new Date().toISOString().slice(0, 10);
      const period = await this.resolvePeriod(today, t);

      // Create reversing lines (Swap Debit and Credit)
      const reversingLines = original.lines.map((l) => ({
        account_id: l.account_id,
        debit: l.credit,
        credit: l.debit,
        description: `Reversal: ${l.description || original.description}`,
        property_id: l.property_id,
        unit_id: l.unit_id,
        tenant_id: l.tenant_id,
        lease_id: l.lease_id,
        owner_id: l.owner_id,
        vendor_id: l.vendor_id,
        bank_account_id: l.bank_account_id,
      }));

      const year = new Date(today).getFullYear();
      const entry_number = await this.generateEntryNumber(year, t);

      const reversingEntry = await JournalEntry.create({
        entry_number,
        entry_date: today,
        posting_date: today,
        period_id: period.id,
        status: 'POSTED',
        source_type: original.source_type,
        source_id: original.source_id,
        reference: `REV-${original.entry_number}`,
        description: `Reversal of ${original.entry_number}: ${reason}`,
        total_debit: original.total_credit,
        total_credit: original.total_debit,
        is_balanced: true,
        created_by_id: reversed_by_id,
        posted_by_id: reversed_by_id,
        posted_at: new Date(),
      }, { transaction: t });

      for (const rl of reversingLines) {
        await JournalLine.create({
          journal_entry_id: reversingEntry.id,
          ...rl,
        }, { transaction: t });
      }

      // Mark original as reversed
      original.status = 'REVERSED';
      original.reversed_by_id = reversed_by_id;
      original.reversal_entry_id = reversingEntry.id;
      original.reversal_reason = reason;
      await original.save({ transaction: t });

      if (!externalTransaction) await t.commit();

      logger.info(`Reversed journal ${original.entry_number} via new reversing entry ${reversingEntry.entry_number}`);
      return { original, reversingEntry };
    } catch (err) {
      if (!externalTransaction) await t.rollback();
      throw err;
    }
  }

  // ══════════════════════════════════════════════════════════════════════
  // SPECIALIZED EVENT-DRIVEN POSTING TRIGGERS
  // ══════════════════════════════════════════════════════════════════════

  /**
   * Event A: Rent / Utility / Fee Charge Invoiced to Tenant
   * Debit: 1200 Tenant Accounts Receivable
   * Credit: 4010 Rental Income (or 4020 Utility / 4030 Late Fee / 2100 Deposit)
   */
  static async postRentCharge(invoiceId, externalTransaction = null) {
    const inv = await Invoice.findByPk(invoiceId, {
      include: [
        { model: Lease, as: 'lease', include: [{ model: Unit, as: 'unit', include: [{ model: Property, as: 'property' }] }] },
        { model: User, as: 'tenant' },
      ],
    });

    if (!inv) return null;
    const amount = Number(inv.amount);
    if (amount <= 0) return null;

    const property = inv.lease?.unit?.property;
    const ownerId = property?.owner_id || null;
    const propertyId = property?.id || null;
    const unitId = inv.lease?.unit?.id || null;
    const tenantId = inv.tenant_id;
    const leaseId = inv.lease_id;

    // Credit account depends on invoice type
    let creditAccountCode = '4010'; // Rental Income
    let descPrefix = 'Rent Charge';

    if (inv.invoice_type === 'UTILITY') {
      creditAccountCode = '4020';
      descPrefix = 'Utility Surcharge Charge';
    } else if (inv.invoice_type === 'LATE_FEE') {
      creditAccountCode = '4030';
      descPrefix = 'Late Payment Penalty';
    } else if (inv.invoice_type === 'DEPOSIT') {
      creditAccountCode = '2100'; // Deposit liability
      descPrefix = 'Security Deposit Charge';
    } else if (inv.invoice_type === 'MAINTENANCE') {
      creditAccountCode = '4200';
      descPrefix = 'Maintenance Recovery Charge';
    }

    const description = `${descPrefix}: Invoice #${inv.id} for Unit ${inv.lease?.unit?.unit_number || ''} (${property?.name || 'Property'})`;

    return await this.postJournalEntry({
      entry_date: inv.created_at ? inv.created_at.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      posting_date: inv.due_date || new Date().toISOString().slice(0, 10),
      source_type: 'INVOICE',
      source_id: String(inv.id),
      reference: `INV-${inv.id}`,
      description,
      lines: [
        {
          account_code: '1200', // Tenant AR
          debit: amount,
          credit: 0,
          description: `AR: ${inv.tenant?.first_name || 'Tenant'} #${tenantId}`,
          property_id: propertyId,
          unit_id: unitId,
          tenant_id: tenantId,
          lease_id: leaseId,
          owner_id: ownerId,
        },
        {
          account_code: creditAccountCode,
          debit: 0,
          credit: amount,
          description,
          property_id: propertyId,
          unit_id: unitId,
          tenant_id: tenantId,
          lease_id: leaseId,
          owner_id: ownerId,
        },
      ],
    }, externalTransaction);
  }

  /**
   * Event B: Tenant Payment Confirmed
   * Debit: 1010 Operating Bank (or 1030 M-Pesa / 1040 Deposit Trust)
   * Credit: 1200 Tenant Accounts Receivable
   */
  static async postPaymentReceipt(paymentId, externalTransaction = null) {
    const payment = await Payment.findByPk(paymentId, {
      include: [
        {
          model: Invoice,
          as: 'invoice',
          include: [{ model: Lease, as: 'lease', include: [{ model: Unit, as: 'unit', include: [{ model: Property, as: 'property' }] }] }],
        },
        { model: User, as: 'tenant' },
        { model: BankAccount, as: 'bank_account' },
      ],
    });

    if (!payment || payment.status !== 'CONFIRMED') return null;
    const amount = Number(payment.amount);
    if (amount <= 0) return null;

    const inv = payment.invoice;
    const property = inv?.lease?.unit?.property;
    const ownerId = property?.owner_id || null;
    const propertyId = property?.id || null;
    const unitId = inv?.lease?.unit?.id || null;
    const tenantId = payment.tenant_id || inv?.tenant_id || null;
    const leaseId = inv?.lease_id || null;

    // Determine cash/bank debit account
    let debitAccountCode = '1010'; // Operating Bank Account
    if (payment.payment_method === 'MPESA') {
      debitAccountCode = '1030'; // M-Pesa Clearing
    } else if (payment.payment_method === 'CASH') {
      debitAccountCode = '1020'; // Cash on Hand
    }

    // If payment is for a security deposit, debit Deposit Trust and credit Deposit Liability
    const isDeposit = inv?.invoice_type === 'DEPOSIT';
    if (isDeposit) {
      debitAccountCode = '1040'; // Tenant Deposit Trust Bank
    }

    const reference = payment.transaction_reference || `PAY-${payment.id}`;
    const description = `Payment Receipt: ${payment.payment_method} ${reference} - Invoice #${payment.invoice_id || 'N/A'}`;

    return await this.postJournalEntry({
      entry_date: payment.paid_at ? payment.paid_at.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      posting_date: payment.paid_at ? payment.paid_at.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      source_type: 'PAYMENT',
      source_id: String(payment.id),
      reference,
      description,
      lines: [
        {
          account_code: debitAccountCode,
          debit: amount,
          credit: 0,
          description: `Funds Received (${payment.payment_method} - ${reference})`,
          property_id: propertyId,
          unit_id: unitId,
          tenant_id: tenantId,
          lease_id: leaseId,
          owner_id: ownerId,
          bank_account_id: payment.bank_account_id,
        },
        {
          account_code: '1200', // Tenant AR
          debit: 0,
          credit: amount,
          description: `Settle AR: Invoice #${payment.invoice_id || 'Direct'}`,
          property_id: propertyId,
          unit_id: unitId,
          tenant_id: tenantId,
          lease_id: leaseId,
          owner_id: ownerId,
        },
      ],
    }, externalTransaction);
  }

  /**
   * Event C: Deposit Refund & Approved Deductions
   * Debit: 2100 Tenant Security Deposits Liability (Full refundable deposit)
   * Credit: 1040 / 1010 Bank (Amount actually refunded to tenant)
   * Credit: 1200 AR or 4200 Damage Recovery (Deductions retained for repairs/rent)
   */
  static async postDepositRefund(depositRefundId, externalTransaction = null) {
    const refund = await DepositRefund.findByPk(depositRefundId, {
      include: [
        {
          model: Lease,
          as: 'lease',
          include: [{ model: Unit, as: 'unit', include: [{ model: Property, as: 'property' }] }, { model: User, as: 'tenant' }],
        },
      ],
    });

    if (!refund) return null;

    const refunded = Number(refund.amount_refunded || 0);
    const deductions = Number(refund.deductions_retained || 0);
    const totalDepositReduction = refunded + deductions;
    if (totalDepositReduction <= 0) return null;

    const property = refund.lease?.unit?.property;
    const propertyId = property?.id || null;
    const ownerId = property?.owner_id || null;
    const unitId = refund.lease?.unit?.id || null;
    const tenantId = refund.lease?.tenant_id || null;
    const leaseId = refund.lease_id;

    const lines = [
      {
        account_code: '2100', // Tenant Security Deposits Liability
        debit: totalDepositReduction,
        credit: 0,
        description: `Release Deposit Liability: Lease #${leaseId}`,
        property_id: propertyId,
        unit_id: unitId,
        tenant_id: tenantId,
        lease_id: leaseId,
        owner_id: ownerId,
      },
    ];

    if (refunded > 0) {
      lines.push({
        account_code: '1040', // Tenant Deposit Trust Bank Account
        debit: 0,
        credit: refunded,
        description: `Deposit Payout to Tenant: ${refund.transaction_reference || 'REFUND'}`,
        property_id: propertyId,
        unit_id: unitId,
        tenant_id: tenantId,
        lease_id: leaseId,
        owner_id: ownerId,
      });
    }

    if (deductions > 0) {
      lines.push({
        account_code: '4200', // Other Property Revenue / Damage Repair Recovery
        debit: 0,
        credit: deductions,
        description: `Retained Deposit Deductions (Repairs / Arrears)`,
        property_id: propertyId,
        unit_id: unitId,
        tenant_id: tenantId,
        lease_id: leaseId,
        owner_id: ownerId,
      });
    }

    return await this.postJournalEntry({
      entry_date: refund.created_at ? refund.created_at.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      posting_date: refund.created_at ? refund.created_at.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10),
      source_type: 'DEPOSIT_REFUND',
      source_id: String(refund.id),
      reference: refund.transaction_reference || `DEP-REF-${refund.id}`,
      description: `Security Deposit Settlement: Lease #${leaseId} (${refund.lease?.unit?.unit_number || ''})`,
      lines,
    }, externalTransaction);
  }

  /**
   * Event D: Vendor Bill / Property Expense Incurred
   * Debit: 5010 Maintenance & Repairs (or specific expense account)
   * Credit: 2010 Accounts Payable
   */
  static async postVendorExpense({
    expense_id,
    amount,
    date,
    expense_account_code = '5010',
    vendor_id = null,
    property_id = null,
    unit_id = null,
    description,
    reference = null,
    created_by_id = null,
  }, externalTransaction = null) {
    const amt = Number(amount);
    if (amt <= 0) throw new ApiError(400, 'Expense amount must be positive.');

    return await this.postJournalEntry({
      entry_date: date || new Date().toISOString().slice(0, 10),
      posting_date: date || new Date().toISOString().slice(0, 10),
      source_type: 'EXPENSE',
      source_id: String(expense_id),
      reference: reference || `EXP-${expense_id}`,
      description: description || `Vendor Expense Bill #${expense_id}`,
      created_by_id,
      lines: [
        {
          account_code: expense_account_code,
          debit: amt,
          credit: 0,
          description: description || 'Operating Expense Incurred',
          property_id,
          unit_id,
          vendor_id,
        },
        {
          account_code: '2010', // Accounts Payable
          debit: 0,
          credit: amt,
          description: `AP: Vendor #${vendor_id || 'General'}`,
          property_id,
          unit_id,
          vendor_id,
        },
      ],
    }, externalTransaction);
  }

  /**
   * Event E: Vendor Bill Settled / Paid
   * Debit: 2010 Accounts Payable
   * Credit: 1010 Operating Bank Account
   */
  static async postVendorPayment({
    payment_id,
    amount,
    date,
    bank_account_id = null,
    vendor_id = null,
    property_id = null,
    description,
    reference = null,
    created_by_id = null,
  }, externalTransaction = null) {
    const amt = Number(amount);
    if (amt <= 0) throw new ApiError(400, 'Payment amount must be positive.');

    return await this.postJournalEntry({
      entry_date: date || new Date().toISOString().slice(0, 10),
      posting_date: date || new Date().toISOString().slice(0, 10),
      source_type: 'EXPENSE',
      source_id: String(payment_id),
      reference: reference || `VPAY-${payment_id}`,
      description: description || `Vendor Payment: AP Settlement`,
      created_by_id,
      lines: [
        {
          account_code: '2010', // Accounts Payable
          debit: amt,
          credit: 0,
          description: `Clear AP for Vendor #${vendor_id || 'General'}`,
          property_id,
          vendor_id,
        },
        {
          account_code: '1010', // Operating Bank Account
          debit: 0,
          credit: amt,
          description: `Bank Disbursement: ${reference || 'Payment'}`,
          property_id,
          vendor_id,
          bank_account_id,
        },
      ],
    }, externalTransaction);
  }

  /**
   * Event F: Owner Distribution / Landlord Payout
   * Debit: 2200 Owner Funds Payable
   * Credit: 1010 Operating Bank Account
   */
  static async postOwnerPayout({
    payout_id,
    owner_id,
    property_id = null,
    amount,
    date,
    reference = null,
    description,
    bank_account_id = null,
    created_by_id = null,
  }, externalTransaction = null) {
    const amt = Number(amount);
    if (amt <= 0) throw new ApiError(400, 'Owner payout amount must be positive.');

    return await this.postJournalEntry({
      entry_date: date || new Date().toISOString().slice(0, 10),
      posting_date: date || new Date().toISOString().slice(0, 10),
      source_type: 'OWNER_PAYOUT',
      source_id: String(payout_id),
      reference: reference || `PAYOUT-${payout_id}`,
      description: description || `Landlord Distribution: Owner #${owner_id}`,
      created_by_id,
      lines: [
        {
          account_code: '2200', // Owner Funds Payable
          debit: amt,
          credit: 0,
          description: `Reduce Owner Payable Liability (Payout to Landlord)`,
          property_id,
          owner_id,
        },
        {
          account_code: '1010', // Operating Bank
          debit: 0,
          credit: amt,
          description: `Bank Transfer Payout: ${reference || 'Direct'}`,
          property_id,
          owner_id,
          bank_account_id,
        },
      ],
    }, externalTransaction);
  }

  /**
   * Event G: Property Management Fee Earned
   * Debit: 2200 Owner Funds Payable (deducted from owner remittance)
   * Credit: 4100 Property Management Fee Income (agency operating revenue)
   */
  static async postManagementFee({
    fee_id,
    owner_id,
    property_id = null,
    amount,
    date,
    reference = null,
    description,
    created_by_id = null,
  }, externalTransaction = null) {
    const amt = Number(amount);
    if (amt <= 0) throw new ApiError(400, 'Management fee amount must be positive.');

    return await this.postJournalEntry({
      entry_date: date || new Date().toISOString().slice(0, 10),
      posting_date: date || new Date().toISOString().slice(0, 10),
      source_type: 'MANAGEMENT_FEE',
      source_id: String(fee_id),
      reference: reference || `FEE-${fee_id}`,
      description: description || `Property Management Fee earned on Property #${property_id}`,
      created_by_id,
      lines: [
        {
          account_code: '2200', // Owner Funds Payable
          debit: amt,
          credit: 0,
          description: `Deduct Management Fee from Landlord Remittance`,
          property_id,
          owner_id,
        },
        {
          account_code: '4100', // Management Fee Income
          debit: 0,
          credit: amt,
          description: `Agency Management Commission Earned`,
          property_id,
          owner_id,
        },
      ],
    }, externalTransaction);
  }
}

module.exports = AccountingService;
