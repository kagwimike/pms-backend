const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const xlsx = require('xlsx');
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
const { recalcInvoice, findInvoiceByReference, confirmPayment } = require('./reconciliation.service');
const { normalizePhone } = require('./mpesa.service');
const logger = require('../../utils/logger');

/**
 * Standardize bank statement column names
 */
const cleanKey = (key) =>
  String(key || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const pickField = (row, possibleKeys) => {
  const rowKeys = Object.keys(row);
  for (const target of possibleKeys) {
    const cleanTarget = cleanKey(target);
    // 1. Exact match
    let foundKey = rowKeys.find((k) => cleanKey(k) === cleanTarget);
    // 2. Substring match for compound headers (e.g. Transaction Remarks -> remarks)
    if (!foundKey) {
      foundKey = rowKeys.find((k) => cleanKey(k).includes(cleanTarget));
    }
    if (foundKey && row[foundKey] !== undefined && row[foundKey] !== null && String(row[foundKey]).trim() !== '') {
      return String(row[foundKey]).trim();
    }
  }
  return null;
};

/**
 * Parse an amount string, stripping commas, currency symbols, etc.
 */
const parseAmount = (val) => {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const cleaned = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : Math.abs(num);
};

/**
 * Extract structured transaction records from CSV or Excel file buffer
 */
const extractRowsFromBuffer = (buffer, filename) => {
  const ext = path.extname(filename || '').toLowerCase();

  let rawObjects = [];

  if (ext === '.xlsx' || ext === '.xls') {
    const workbook = xlsx.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    rawObjects = xlsx.utils.sheet_to_json(worksheet, { defval: '', raw: false });
  } else {
    // Treat as CSV or text
    const textContent = buffer.toString('utf8');
    rawObjects = parse(textContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
  }

  const normalizedTransactions = [];

  for (const row of rawObjects) {
    // Extract reference
    const reference = pickField(row, [
      'reference',
      'ref',
      'refno',
      'referenceno',
      'referencenumber',
      'docref',
      'docreference',
      'documentref',
      'documentreference',
      'transactionreference',
      'tranref',
      'chequeno',
      'chqno',
      'receiptno',
      'bankreference',
    ]);

    // Extract Credit / Paid In (Money In)
    const creditRaw = pickField(row, [
      'credit',
      'creditamount',
      'paidin',
      'deposit',
      'deposits',
      'amount',
      'transamount',
      'cr',
    ]);

    // Extract Debit / Paid Out (Money Out)
    const debitRaw = pickField(row, [
      'debit',
      'debitamount',
      'paidout',
      'withdrawal',
      'withdrawals',
      'dr',
    ]);

    // Narration / Details
    const narration = pickField(row, [
      'narration',
      'description',
      'transactiondetails',
      'particulars',
      'details',
      'remarks',
      'memo',
      'statementdetails',
      'paymentdetails',
    ]) || '';

    // Date
    const transactionDate = pickField(row, [
      'date',
      'txndate',
      'transactiondate',
      'valuedate',
      'postingdate',
      'transdate',
    ]);

    // Payer / Customer Name
    const payerName = pickField(row, [
      'payer',
      'payername',
      'customername',
      'partyname',
      'name',
      'source',
      'originator',
    ]);

    const creditAmount = parseAmount(creditRaw);
    const debitAmount = parseAmount(debitRaw);

    // Only process deposit (credit) rows that have either a positive amount or positive credit
    // Skip rows that are pure debit/charges, or header/summary rows with 0 amount
    if (creditAmount > 0 && debitAmount === 0) {
      normalizedTransactions.push({
        reference: reference || null,
        amount: creditAmount,
        narration,
        transactionDate: transactionDate || new Date().toISOString(),
        payerName: payerName || null,
        raw: row,
      });
    } else if (creditAmount === 0 && !debitRaw && parseAmount(reference) > 0) {
      // Edge case: single column 'amount'
      const singleAmount = parseAmount(pickField(row, ['amount']));
      if (singleAmount > 0) {
        normalizedTransactions.push({
          reference: reference || null,
          amount: singleAmount,
          narration,
          transactionDate: transactionDate || new Date().toISOString(),
          payerName: payerName || null,
          raw: row,
        });
      }
    }
  }

  return normalizedTransactions;
};

/**
 * Intelligent Multi-Tier Matching Engine
 */
const matchTransactionToInvoice = async (txn, propertyId = null) => {
  const narration = String(txn.narration || '');

  // ─── TIER 1: Direct Invoice Reference (e.g. INV-102, #102, 102) ───
  const directInvoice = await findInvoiceByReference(narration);
  if (directInvoice && directInvoice.status !== 'CANCELLED') {
    return {
      invoice: directInvoice,
      matchType: 'EXACT_INVOICE_REF',
      confidence: 1.0,
      reason: `Matched via direct invoice reference in narration: ${narration}`,
    };
  }

  // ─── TIER 2: Unit / Apartment Matching (e.g., "A4", "Unit 12", "Apt 3B", "House 6") ───
  // Find all units in the system (or filtered by property if bank account is property-specific)
  const unitWhere = propertyId ? { property_id: propertyId } : {};
  const units = await Unit.findAll({
    where: unitWhere,
    attributes: ['id', 'unit_number', 'property_id'],
  });

  for (const unit of units) {
    const unitNo = unit.unit_number.trim();
    // Match unit with word boundary or common prefixes: e.g. "A4", "A-4", "Unit A4", "House A4"
    const regex = new RegExp(`(?:unit|apt|house|flat|rm)?\\s*[-#]?\\s*${unitNo}(?:\\b|[^a-zA-Z0-9])`, 'i');
    if (regex.test(narration)) {
      // Find active lease for this unit
      const lease = await Lease.findOne({
        where: { unit_id: unit.id, status: { [Op.in]: ['ACTIVE', 'EXPIRING'] } },
      });

      if (lease) {
        // Find unpaid invoice for this lease
        const unpaidInvoice = await Invoice.findOne({
          where: {
            lease_id: lease.id,
            status: { [Op.in]: ['PENDING', 'PARTIAL', 'OVERDUE'] },
          },
          order: [['due_date', 'ASC']],
        });

        if (unpaidInvoice) {
          return {
            invoice: unpaidInvoice,
            matchType: 'UNIT_CODE_MATCH',
            confidence: 0.9,
            reason: `Matched unit number [${unitNo}] with active lease for tenant #${lease.tenant_id}`,
          };
        }
      }
    }
  }

  // ─── TIER 3: Tenant Phone or National ID Matching ───
  // Check for Kenyan phone numbers in narration or payerName (07..., 01..., 254...)
  const phoneRegex = /(?:254|\+254|0)?([17]\d{8})\b/g;
  const matches = [...narration.matchAll(phoneRegex)];
  for (const m of matches) {
    const rawNumber = m[0];
    const normalized = normalizePhone(rawNumber);
    if (normalized) {
      const localFormat = '0' + normalized.slice(3);
      const tenant = await User.findOne({
        where: {
          role: 'TENANT',
          phone: { [Op.in]: [normalized, `+${normalized}`, localFormat] },
        },
      });

      if (tenant) {
        const unpaidInvoice = await Invoice.findOne({
          where: {
            tenant_id: tenant.id,
            status: { [Op.in]: ['PENDING', 'PARTIAL', 'OVERDUE'] },
          },
          order: [['due_date', 'ASC']],
        });

        if (unpaidInvoice) {
          return {
            invoice: unpaidInvoice,
            matchType: 'TENANT_PHONE_MATCH',
            confidence: 0.85,
            reason: `Matched tenant phone number [${rawNumber}] to tenant ${tenant.username}`,
          };
        }
      }
    }
  }

  // ─── TIER 4: National ID / Passport match ───
  const idRegex = /\b(\d{7,8})\b/g;
  const idMatches = [...narration.matchAll(idRegex)];
  for (const idMatch of idMatches) {
    const potentialId = idMatch[1];
    const tenantById = await User.findOne({
      where: {
        role: 'TENANT',
        tenant_id_passport: potentialId,
      },
    });

    if (tenantById) {
      const unpaidInvoice = await Invoice.findOne({
        where: {
          tenant_id: tenantById.id,
          status: { [Op.in]: ['PENDING', 'PARTIAL', 'OVERDUE'] },
        },
        order: [['due_date', 'ASC']],
      });

      if (unpaidInvoice) {
        return {
          invoice: unpaidInvoice,
          matchType: 'TENANT_ID_MATCH',
          confidence: 0.85,
          reason: `Matched National ID [${potentialId}] to tenant ${tenantById.username}`,
        };
      }
    }
  }

  return null;
};

/**
 * Main Statement Ingestion & Reconciliation Runner
 */
const processBankStatement = async ({
  fileBuffer,
  fileName,
  bankAccountId,
  uploadedByUserId,
}) => {
  // 1. Fetch bank account details
  let bankAccount = null;
  if (bankAccountId) {
    bankAccount = await BankAccount.findByPk(bankAccountId);
  }

  const ext = path.extname(fileName || '').toLowerCase();
  const fileType = ext === '.xlsx' ? 'XLSX' : ext === '.xls' ? 'XLS' : 'CSV';

  // 2. Create the BankStatementUpload record in PENDING state
  const uploadRecord = await BankStatementUpload.create({
    bank_account_id: bankAccountId || null,
    file_name: fileName,
    file_type: fileType,
    uploaded_by: uploadedByUserId,
    status: 'PROCESSING',
  });

  try {
    // 3. Extract normalized rows from file buffer
    const transactions = extractRowsFromBuffer(fileBuffer, fileName);

    let totalAmount = 0;
    let matchedCount = 0;
    let unmatchedCount = 0;
    let duplicateCount = 0;
    const processedResults = [];

    for (let i = 0; i < transactions.length; i++) {
      const txn = transactions[i];
      totalAmount += txn.amount;

      // Deduplication: Check if reference already exists
      const cleanRef = txn.reference || `BANK-${uploadRecord.id}-${i + 1}`;
      const existingPayment = await Payment.findOne({
        where: { transaction_reference: cleanRef },
      });

      if (existingPayment) {
        duplicateCount++;
        processedResults.push({
          reference: cleanRef,
          amount: txn.amount,
          narration: txn.narration,
          status: 'DUPLICATE',
          payment_id: existingPayment.id,
          reason: 'Transaction reference already recorded',
        });
        continue;
      }

      // Reconcile transaction
      const match = await matchTransactionToInvoice(txn, bankAccount?.property_id);

      if (match && match.invoice) {
        const invoice = match.invoice;
        const tenantId = invoice.tenant_id;

        const payment = await Payment.create({
          amount: txn.amount,
          payment_method: 'BANK_TRANSFER',
          transaction_reference: cleanRef,
          account_reference: txn.narration,
          phone_number: txn.raw?.phone || null,
          payer_name: txn.payerName || null,
          gateway_response: txn.raw,
          invoice_id: invoice.id,
          tenant_id: tenantId,
          bank_account_id: bankAccountId || null,
          statement_upload_id: uploadRecord.id,
          status: 'PENDING',
          notes: `Auto-reconciled via Bank Statement: ${match.reason}`,
        });

        await confirmPayment(payment, {
          receipt: cleanRef,
          raw: txn.raw,
        });

        matchedCount++;
        processedResults.push({
          reference: cleanRef,
          amount: txn.amount,
          narration: txn.narration,
          status: 'MATCHED',
          match_type: match.matchType,
          invoice_id: invoice.id,
          tenant_id: tenantId,
          payment_id: payment.id,
          reason: match.reason,
        });
      } else {
        // Unmatched: Create payment with UNMATCHED status for manual review
        const payment = await Payment.create({
          amount: txn.amount,
          payment_method: 'BANK_TRANSFER',
          transaction_reference: cleanRef,
          account_reference: txn.narration,
          payer_name: txn.payerName || null,
          gateway_response: txn.raw,
          invoice_id: null,
          tenant_id: null,
          bank_account_id: bankAccountId || null,
          statement_upload_id: uploadRecord.id,
          status: 'UNMATCHED',
          is_confirmed: false,
          notes: 'Unmatched deposit from statement upload. Requires manual unit assignment.',
        });

        // Notify staff of unmatched transaction
        try {
          const staffAdmins = await User.findAll({
            where: { role: { [Op.in]: ['ADMIN', 'OWNER'] } },
            attributes: ['id'],
          });
          for (const staff of staffAdmins) {
            await NotificationService.notifyPaymentUnmatchedStaff(
              staff.id,
              txn.amount,
              cleanRef,
              payment.id
            );
          }
        } catch (_) {}

        unmatchedCount++;
        processedResults.push({
          reference: cleanRef,
          amount: txn.amount,
          narration: txn.narration,
          status: 'UNMATCHED',
          payment_id: payment.id,
          reason: 'No matching invoice, unit, or tenant found in narration',
        });
      }
    }

    // 4. Update the BankStatementUpload audit record
    uploadRecord.total_rows = transactions.length;
    uploadRecord.total_amount = totalAmount.toFixed(2);
    uploadRecord.matched_count = matchedCount;
    uploadRecord.unmatched_count = unmatchedCount;
    uploadRecord.duplicate_count = duplicateCount;
    uploadRecord.status = 'COMPLETED';
    uploadRecord.summary_metadata = {
      transactions_summary: processedResults,
      bank_name: bankAccount?.bank_name || 'Generic Bank',
      account_number: bankAccount?.account_number || 'N/A',
    };
    await uploadRecord.save();

    return {
      uploadId: uploadRecord.id,
      fileName,
      totalRows: transactions.length,
      totalAmount,
      matchedCount,
      unmatchedCount,
      duplicateCount,
      results: processedResults,
    };
  } catch (error) {
    logger.error('Error in processBankStatement:', error);
    uploadRecord.status = 'FAILED';
    uploadRecord.error_message = error.message;
    await uploadRecord.save();
    throw error;
  }
};

module.exports = {
  extractRowsFromBuffer,
  matchTransactionToInvoice,
  processBankStatement,
};
