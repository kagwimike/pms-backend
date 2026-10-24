const { Op, fn, col, literal } = require('sequelize');
const { sequelize } = require('../../config/db');
const Account = require('../../models/Account');
const AccountingPeriod = require('../../models/AccountingPeriod');
const JournalEntry = require('../../models/JournalEntry');
const JournalLine = require('../../models/JournalLine');
const Invoice = require('../../models/Invoice');
const Payment = require('../../models/Payment');
const Property = require('../../models/Property');
const Unit = require('../../models/Unit');
const User = require('../../models/User');
const Lease = require('../../models/Lease');
const Vendor = require('../../models/Vendor');
const BankAccount = require('../../models/BankAccount');

class AccountingReportService {
  /**
   * General Ledger Query: Full transaction history for an account or category
   * with accurate opening balance and running balances.
   */
  static async getGeneralLedger({
    account_id = null,
    account_code = null,
    property_id = null,
    owner_id = null,
    tenant_id = null,
    start_date = null,
    end_date = null,
    page = 1,
    limit = 50,
  }) {
    const whereLine = {};
    const whereEntry = { status: 'POSTED' };

    let targetAccount = null;
    if (account_id) {
      targetAccount = await Account.findByPk(account_id);
      if (targetAccount) whereLine.account_id = targetAccount.id;
    } else if (account_code) {
      targetAccount = await Account.findOne({ where: { account_code } });
      if (targetAccount) whereLine.account_id = targetAccount.id;
    }

    if (property_id) whereLine.property_id = property_id;
    if (owner_id) whereLine.owner_id = owner_id;
    if (tenant_id) whereLine.tenant_id = tenant_id;

    if (start_date && end_date) {
      whereEntry.posting_date = { [Op.between]: [start_date, end_date] };
    } else if (start_date) {
      whereEntry.posting_date = { [Op.gte]: start_date };
    } else if (end_date) {
      whereEntry.posting_date = { [Op.lte]: end_date };
    }

    // 1. Calculate Opening Balance before start_date if start_date is provided
    let openingDebit = 0;
    let openingCredit = 0;
    if (start_date && targetAccount) {
      const priorWhere = {
        status: 'POSTED',
        posting_date: { [Op.lt]: start_date },
      };
      const priorLines = await JournalLine.findAll({
        where: whereLine,
        include: [{ model: JournalEntry, as: 'journal_entry', where: priorWhere, attributes: [] }],
        attributes: [
          [fn('SUM', col('debit')), 'total_debit'],
          [fn('SUM', col('credit')), 'total_credit'],
        ],
        raw: true,
      });

      openingDebit = Number(priorLines[0]?.total_debit || 0);
      openingCredit = Number(priorLines[0]?.total_credit || 0);
    }

    const isNormalDebit = targetAccount ? targetAccount.normal_balance === 'DEBIT' : true;
    let openingBalance = isNormalDebit ? (openingDebit - openingCredit) : (openingCredit - openingDebit);

    // 2. Fetch paginated ledger transactions
    const offset = (Number(page) - 1) * Number(limit);
    const { count, rows } = await JournalLine.findAndCountAll({
      where: whereLine,
      include: [
        {
          model: JournalEntry,
          as: 'journal_entry',
          where: whereEntry,
          attributes: ['id', 'entry_number', 'posting_date', 'entry_date', 'reference', 'source_type', 'source_id', 'description'],
        },
        { model: Account, as: 'account', attributes: ['id', 'account_code', 'account_name', 'account_type', 'normal_balance'] },
        { model: Property, as: 'property', attributes: ['id', 'name'] },
        { model: Unit, as: 'unit', attributes: ['id', 'unit_number'] },
        { model: User, as: 'tenant', attributes: ['id', 'first_name', 'last_name', 'username'] },
        { model: User, as: 'owner', attributes: ['id', 'first_name', 'last_name', 'username'] },
        { model: Vendor, as: 'vendor', attributes: ['id', 'name'] },
      ],
      order: [
        [{ model: JournalEntry, as: 'journal_entry' }, 'posting_date', 'ASC'],
        ['id', 'ASC'],
      ],
      limit: Number(limit),
      offset,
    });

    // 3. Calculate running balance for the paginated slice
    let runningBalance = openingBalance;
    const transactions = rows.map((row) => {
      const line = row.toJSON();
      const debit = Number(line.debit);
      const credit = Number(line.credit);
      const accountNormalDebit = line.account?.normal_balance === 'DEBIT';

      if (accountNormalDebit) {
        runningBalance += (debit - credit);
      } else {
        runningBalance += (credit - debit);
      }

      return {
        ...line,
        running_balance: Math.round(runningBalance * 100) / 100,
      };
    });

    return {
      account: targetAccount,
      opening_balance: Math.round(openingBalance * 100) / 100,
      closing_balance: Math.round(runningBalance * 100) / 100,
      total_count: count,
      page: Number(page),
      limit: Number(limit),
      total_pages: Math.ceil(count / Number(limit)),
      transactions,
    };
  }

  /**
   * Trial Balance: Verifies equality of all posted debits and credits
   * for every account in the Chart of Accounts within a period.
   */
  static async getTrialBalance({ start_date = null, end_date = null, property_id = null }) {
    const whereEntry = { status: 'POSTED' };
    if (start_date && end_date) {
      whereEntry.posting_date = { [Op.between]: [start_date, end_date] };
    } else if (end_date) {
      whereEntry.posting_date = { [Op.lte]: end_date };
    }

    const whereLine = {};
    if (property_id) whereLine.property_id = property_id;

    // Fetch all accounts
    const accounts = await Account.findAll({
      order: [['account_code', 'ASC']],
      raw: true,
    });

    // Query aggregated debits & credits grouped by account_id
    const movements = await JournalLine.findAll({
      where: whereLine,
      include: [{ model: JournalEntry, as: 'journal_entry', where: whereEntry, attributes: [] }],
      attributes: [
        'account_id',
        [fn('SUM', col('debit')), 'period_debit'],
        [fn('SUM', col('credit')), 'period_credit'],
      ],
      group: ['account_id'],
      raw: true,
    });

    const movementMap = new Map();
    for (const m of movements) {
      movementMap.set(String(m.account_id), {
        debit: Number(m.period_debit || 0),
        credit: Number(m.period_credit || 0),
      });
    }

    let grandTotalDebit = 0;
    let grandTotalCredit = 0;

    const reportRows = accounts.map((acc) => {
      const mov = movementMap.get(String(acc.id)) || { debit: 0, credit: 0 };
      const debit = Math.round(mov.debit * 100) / 100;
      const credit = Math.round(mov.credit * 100) / 100;

      grandTotalDebit += debit;
      grandTotalCredit += credit;

      // Net balance in normal balance orientation
      let balanceDebit = 0;
      let balanceCredit = 0;
      if (debit > credit) {
        balanceDebit = Math.round((debit - credit) * 100) / 100;
      } else {
        balanceCredit = Math.round((credit - debit) * 100) / 100;
      }

      return {
        account_id: acc.id,
        account_code: acc.account_code,
        account_name: acc.account_name,
        account_type: acc.account_type,
        normal_balance: acc.normal_balance,
        category: acc.category,
        total_debit: debit,
        total_credit: credit,
        balance_debit: balanceDebit,
        balance_credit: balanceCredit,
      };
    });

    grandTotalDebit = Math.round(grandTotalDebit * 100) / 100;
    grandTotalCredit = Math.round(grandTotalCredit * 100) / 100;
    const difference = Math.round(Math.abs(grandTotalDebit - grandTotalCredit) * 100) / 100;
    const isBalanced = difference < 0.01;

    return {
      period: { start_date, end_date },
      total_debit: grandTotalDebit,
      total_credit: grandTotalCredit,
      difference,
      is_balanced: isBalanced,
      accounts: reportRows,
    };
  }

  /**
   * Profit & Loss Statement (Income Statement):
   * Revenues (4000s) - Operating Expenses (5000s) = Net Operating Income
   */
  static async getProfitAndLoss({ start_date = null, end_date = null, property_id = null, owner_id = null }) {
    const whereEntry = { status: 'POSTED' };
    if (start_date && end_date) {
      whereEntry.posting_date = { [Op.between]: [start_date, end_date] };
    } else if (end_date) {
      whereEntry.posting_date = { [Op.lte]: end_date };
    }

    const whereLine = {};
    if (property_id) whereLine.property_id = property_id;
    if (owner_id) whereLine.owner_id = owner_id;

    // Fetch Revenue and Expense accounts
    const accounts = await Account.findAll({
      where: {
        account_type: { [Op.in]: ['REVENUE', 'EXPENSE'] },
      },
      order: [['account_code', 'ASC']],
      raw: true,
    });

    const movements = await JournalLine.findAll({
      where: whereLine,
      include: [{ model: JournalEntry, as: 'journal_entry', where: whereEntry, attributes: [] }],
      attributes: [
        'account_id',
        [fn('SUM', col('debit')), 'period_debit'],
        [fn('SUM', col('credit')), 'period_credit'],
      ],
      group: ['account_id'],
      raw: true,
    });

    const movementMap = new Map();
    for (const m of movements) {
      movementMap.set(String(m.account_id), {
        debit: Number(m.period_debit || 0),
        credit: Number(m.period_credit || 0),
      });
    }

    const revenueAccounts = [];
    const expenseAccounts = [];
    let totalRevenue = 0;
    let totalExpense = 0;

    for (const acc of accounts) {
      const mov = movementMap.get(String(acc.id)) || { debit: 0, credit: 0 };
      if (acc.account_type === 'REVENUE') {
        // Revenue normal credit: credit - debit
        const net = Math.round((mov.credit - mov.debit) * 100) / 100;
        totalRevenue += net;
        revenueAccounts.push({
          account_id: acc.id,
          account_code: acc.account_code,
          account_name: acc.account_name,
          category: acc.category,
          amount: net,
        });
      } else if (acc.account_type === 'EXPENSE') {
        // Expense normal debit: debit - credit
        const net = Math.round((mov.debit - mov.credit) * 100) / 100;
        totalExpense += net;
        expenseAccounts.push({
          account_id: acc.id,
          account_code: acc.account_code,
          account_name: acc.account_name,
          category: acc.category,
          amount: net,
        });
      }
    }

    totalRevenue = Math.round(totalRevenue * 100) / 100;
    totalExpense = Math.round(totalExpense * 100) / 100;
    const netIncome = Math.round((totalRevenue - totalExpense) * 100) / 100;

    return {
      period: { start_date, end_date },
      total_revenue: totalRevenue,
      total_expense: totalExpense,
      net_operating_income: netIncome,
      revenues: revenueAccounts,
      expenses: expenseAccounts,
    };
  }

  /**
   * Balance Sheet:
   * Assets (1000s) = Liabilities (2000s) + Equity (3000s) + Net Income
   */
  static async getBalanceSheet({ as_of_date = null, property_id = null, owner_id = null }) {
    const targetDate = as_of_date || new Date().toISOString().slice(0, 10);
    const whereEntry = {
      status: 'POSTED',
      posting_date: { [Op.lte]: targetDate },
    };

    const whereLine = {};
    if (property_id) whereLine.property_id = property_id;
    if (owner_id) whereLine.owner_id = owner_id;

    const accounts = await Account.findAll({
      order: [['account_code', 'ASC']],
      raw: true,
    });

    const movements = await JournalLine.findAll({
      where: whereLine,
      include: [{ model: JournalEntry, as: 'journal_entry', where: whereEntry, attributes: [] }],
      attributes: [
        'account_id',
        [fn('SUM', col('debit')), 'period_debit'],
        [fn('SUM', col('credit')), 'period_credit'],
      ],
      group: ['account_id'],
      raw: true,
    });

    const movementMap = new Map();
    for (const m of movements) {
      movementMap.set(String(m.account_id), {
        debit: Number(m.period_debit || 0),
        credit: Number(m.period_credit || 0),
      });
    }

    const assetAccounts = [];
    const liabilityAccounts = [];
    const equityAccounts = [];
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalEquity = 0;
    let cumulativeRevenue = 0;
    let cumulativeExpense = 0;

    for (const acc of accounts) {
      const mov = movementMap.get(String(acc.id)) || { debit: 0, credit: 0 };
      const debit = mov.debit;
      const credit = mov.credit;

      if (acc.account_type === 'ASSET') {
        const net = Math.round((acc.normal_balance === 'DEBIT' ? (debit - credit) : (credit - debit)) * 100) / 100;
        totalAssets += net;
        assetAccounts.push({ ...acc, balance: net });
      } else if (acc.account_type === 'LIABILITY') {
        const net = Math.round((credit - debit) * 100) / 100;
        totalLiabilities += net;
        liabilityAccounts.push({ ...acc, balance: net });
      } else if (acc.account_type === 'EQUITY') {
        const net = Math.round((credit - debit) * 100) / 100;
        totalEquity += net;
        equityAccounts.push({ ...acc, balance: net });
      } else if (acc.account_type === 'REVENUE') {
        cumulativeRevenue += (credit - debit);
      } else if (acc.account_type === 'EXPENSE') {
        cumulativeExpense += (debit - credit);
      }
    }

    // Cumulative net income flows into equity
    const currentPeriodEarnings = Math.round((cumulativeRevenue - cumulativeExpense) * 100) / 100;
    equityAccounts.push({
      id: 999999,
      account_code: '3999',
      account_name: 'Current Period Retained Earnings',
      account_type: 'EQUITY',
      normal_balance: 'CREDIT',
      category: 'EQUITY',
      balance: currentPeriodEarnings,
    });
    totalEquity += currentPeriodEarnings;

    totalAssets = Math.round(totalAssets * 100) / 100;
    totalLiabilities = Math.round(totalLiabilities * 100) / 100;
    totalEquity = Math.round(totalEquity * 100) / 100;

    const totalLiabilitiesAndEquity = Math.round((totalLiabilities + totalEquity) * 100) / 100;
    const discrepancy = Math.round(Math.abs(totalAssets - totalLiabilitiesAndEquity) * 100) / 100;
    const isBalanced = discrepancy < 0.01;

    return {
      as_of_date: targetDate,
      total_assets: totalAssets,
      total_liabilities: totalLiabilities,
      total_equity: totalEquity,
      total_liabilities_and_equity: totalLiabilitiesAndEquity,
      is_balanced: isBalanced,
      discrepancy,
      assets: assetAccounts,
      liabilities: liabilityAccounts,
      equity: equityAccounts,
    };
  }

  /**
   * Cash Flow Statement (Direct method):
   * Summarizes inflows and outflows through all Cash & Bank accounts (1000s)
   */
  static async getCashFlowStatement({ start_date = null, end_date = null, property_id = null }) {
    const whereEntry = { status: 'POSTED' };
    if (start_date && end_date) {
      whereEntry.posting_date = { [Op.between]: [start_date, end_date] };
    } else if (end_date) {
      whereEntry.posting_date = { [Op.lte]: end_date };
    }

    // Identify cash and bank accounts (1010, 1020, 1030, 1040)
    const bankAccounts = await Account.findAll({
      where: { category: 'CASH_AND_BANK' },
      attributes: ['id', 'account_code', 'account_name'],
      raw: true,
    });
    const bankAccountIds = bankAccounts.map((b) => b.id);

    const whereLine = { account_id: { [Op.in]: bankAccountIds } };
    if (property_id) whereLine.property_id = property_id;

    const lines = await JournalLine.findAll({
      where: whereLine,
      include: [
        {
          model: JournalEntry,
          as: 'journal_entry',
          where: whereEntry,
          attributes: ['id', 'entry_number', 'posting_date', 'source_type', 'reference', 'description'],
        },
      ],
      order: [[{ model: JournalEntry, as: 'journal_entry' }, 'posting_date', 'ASC']],
    });

    let operatingInflows = 0;
    let operatingOutflows = 0;
    let financingInflows = 0;
    let financingOutflows = 0;

    const operatingActivities = [];
    const financingActivities = [];

    for (const l of lines) {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      const entry = l.journal_entry;
      const netCash = debit - credit;

      if (['PAYMENT', 'INVOICE', 'EXPENSE', 'MAINTENANCE', 'RECONCILIATION'].includes(entry.source_type)) {
        if (netCash > 0) operatingInflows += netCash;
        else operatingOutflows += Math.abs(netCash);

        operatingActivities.push({
          date: entry.posting_date,
          reference: entry.reference,
          description: l.description || entry.description,
          inflow: debit > 0 ? debit : 0,
          outflow: credit > 0 ? credit : 0,
          net: netCash,
        });
      } else {
        if (netCash > 0) financingInflows += netCash;
        else financingOutflows += Math.abs(netCash);

        financingActivities.push({
          date: entry.posting_date,
          reference: entry.reference,
          description: l.description || entry.description,
          inflow: debit > 0 ? debit : 0,
          outflow: credit > 0 ? credit : 0,
          net: netCash,
        });
      }
    }

    operatingInflows = Math.round(operatingInflows * 100) / 100;
    operatingOutflows = Math.round(operatingOutflows * 100) / 100;
    const netOperating = Math.round((operatingInflows - operatingOutflows) * 100) / 100;

    financingInflows = Math.round(financingInflows * 100) / 100;
    financingOutflows = Math.round(financingOutflows * 100) / 100;
    const netFinancing = Math.round((financingInflows - financingOutflows) * 100) / 100;

    const netCashFlow = Math.round((netOperating + netFinancing) * 100) / 100;

    return {
      period: { start_date, end_date },
      net_operating_cash_flow: netOperating,
      net_financing_cash_flow: netFinancing,
      net_cash_flow: netCashFlow,
      operating_inflows: operatingInflows,
      operating_outflows: operatingOutflows,
      operating_activities: operatingActivities.slice(0, 100),
      financing_activities: financingActivities.slice(0, 100),
    };
  }

  /**
   * Specialized Subledger: Tenant Ledger
   * Reconciles Tenant Invoices (Debits to AR) against confirmed Payments (Credits to AR)
   */
  static async getTenantSubledger(tenantId, { start_date = null, end_date = null }) {
    const arAccount = await Account.findOne({ where: { account_code: '1200' } });
    if (!arAccount) return { transactions: [], balance: 0 };

    const whereLine = {
      account_id: arAccount.id,
      tenant_id: tenantId,
    };

    const whereEntry = { status: 'POSTED' };
    if (start_date && end_date) whereEntry.posting_date = { [Op.between]: [start_date, end_date] };

    const lines = await JournalLine.findAll({
      where: whereLine,
      include: [
        {
          model: JournalEntry,
          as: 'journal_entry',
          where: whereEntry,
          attributes: ['id', 'entry_number', 'posting_date', 'reference', 'source_type', 'description'],
        },
        { model: Unit, as: 'unit', attributes: ['id', 'unit_number'] },
        { model: Property, as: 'property', attributes: ['id', 'name'] },
      ],
      order: [[{ model: JournalEntry, as: 'journal_entry' }, 'posting_date', 'ASC']],
    });

    let runningBalance = 0;
    const items = lines.map((l) => {
      const debit = Number(l.debit);
      const credit = Number(l.credit);
      runningBalance += (debit - credit);

      return {
        id: l.id,
        posting_date: l.journal_entry.posting_date,
        entry_number: l.journal_entry.entry_number,
        reference: l.journal_entry.reference,
        description: l.description || l.journal_entry.description,
        source_type: l.journal_entry.source_type,
        charge: debit,
        payment: credit,
        balance: Math.round(runningBalance * 100) / 100,
        unit: l.unit?.unit_number,
        property: l.property?.name,
      };
    });

    return {
      tenant_id: tenantId,
      control_account: '1200 - Tenant Accounts Receivable',
      outstanding_balance: Math.round(runningBalance * 100) / 100,
      statement: items,
    };
  }

  /**
   * Specialized Subledger: Owner Ledger
   * Reconciles collections on behalf of landlord vs management fees, repairs & payouts
   */
  static async getOwnerSubledger(ownerId, { start_date = null, end_date = null }) {
    const ownerPayableAccount = await Account.findOne({ where: { account_code: '2200' } });
    if (!ownerPayableAccount) return { transactions: [], balance: 0 };

    const whereLine = {
      account_id: ownerPayableAccount.id,
      owner_id: ownerId,
    };

    const whereEntry = { status: 'POSTED' };
    if (start_date && end_date) whereEntry.posting_date = { [Op.between]: [start_date, end_date] };

    const lines = await JournalLine.findAll({
      where: whereLine,
      include: [
        {
          model: JournalEntry,
          as: 'journal_entry',
          where: whereEntry,
          attributes: ['id', 'entry_number', 'posting_date', 'reference', 'source_type', 'description'],
        },
        { model: Property, as: 'property', attributes: ['id', 'name'] },
      ],
      order: [[{ model: JournalEntry, as: 'journal_entry' }, 'posting_date', 'ASC']],
    });

    let runningBalance = 0;
    const items = lines.map((l) => {
      const debit = Number(l.debit); // Deductions/Payouts reducing liability
      const credit = Number(l.credit); // Collections credited to owner
      runningBalance += (credit - debit);

      return {
        id: l.id,
        posting_date: l.journal_entry.posting_date,
        entry_number: l.journal_entry.entry_number,
        reference: l.journal_entry.reference,
        description: l.description || l.journal_entry.description,
        source_type: l.journal_entry.source_type,
        collection_credit: credit,
        deduction_debit: debit,
        balance_payable: Math.round(runningBalance * 100) / 100,
        property: l.property?.name,
      };
    });

    return {
      owner_id: ownerId,
      control_account: '2200 - Owner Funds Payable',
      funds_available_for_payout: Math.round(runningBalance * 100) / 100,
      statement: items,
    };
  }

  /**
   * Accounts Receivable (AR) Aging Report:
   * Bins outstanding invoice balances into Current, 1-30, 31-60, 61-90, 90+ days
   */
  static async getARAging({ as_of_date = null, property_id = null }) {
    const today = as_of_date || new Date().toISOString().slice(0, 10);
    const whereInvoice = {
      status: { [Op.in]: ['PENDING', 'PARTIAL', 'OVERDUE'] },
    };

    const invoices = await Invoice.findAll({
      where: whereInvoice,
      include: [
        { model: User, as: 'tenant', attributes: ['id', 'first_name', 'last_name', 'username', 'phone'] },
        { model: Lease, as: 'lease', include: [{ model: Unit, as: 'unit', include: [{ model: Property, as: 'property' }] }] },
      ],
      order: [['due_date', 'ASC']],
    });

    let totalAR = 0;
    let bucketCurrent = 0;
    let bucket1_30 = 0;
    let bucket31_60 = 0;
    let bucket61_90 = 0;
    let bucket90Plus = 0;

    const filtered = invoices.filter((inv) => {
      if (property_id && inv.lease?.unit?.property_id !== Number(property_id)) return false;
      return true;
    });

    const agingItems = filtered.map((inv) => {
      const total = Number(inv.amount);
      const paid = Number(inv.amount_paid || 0);
      const outstanding = Math.round((total - paid) * 100) / 100;
      totalAR += outstanding;

      const dueDate = new Date(inv.due_date);
      const now = new Date(today);
      const diffDays = Math.floor((now - dueDate) / (1000 * 60 * 60 * 24));

      let bucket = 'CURRENT';
      if (diffDays <= 0) {
        bucketCurrent += outstanding;
        bucket = 'CURRENT';
      } else if (diffDays <= 30) {
        bucket1_30 += outstanding;
        bucket = '1-30 DAYS';
      } else if (diffDays <= 60) {
        bucket31_60 += outstanding;
        bucket = '31-60 DAYS';
      } else if (diffDays <= 90) {
        bucket61_90 += outstanding;
        bucket = '61-90 DAYS';
      } else {
        bucket90Plus += outstanding;
        bucket = '90+ DAYS';
      }

      return {
        invoice_id: inv.id,
        invoice_type: inv.invoice_type,
        due_date: inv.due_date,
        days_overdue: Math.max(0, diffDays),
        bucket,
        total_amount: total,
        amount_paid: paid,
        outstanding_balance: outstanding,
        tenant_name: `${inv.tenant?.first_name || ''} ${inv.tenant?.last_name || inv.tenant?.username || ''}`.trim(),
        unit_number: inv.lease?.unit?.unit_number,
        property_name: inv.lease?.unit?.property?.name,
      };
    });

    return {
      as_of_date: today,
      total_ar: Math.round(totalAR * 100) / 100,
      buckets: {
        current: Math.round(bucketCurrent * 100) / 100,
        days_1_30: Math.round(bucket1_30 * 100) / 100,
        days_31_60: Math.round(bucket31_60 * 100) / 100,
        days_61_90: Math.round(bucket61_90 * 100) / 100,
        days_90_plus: Math.round(bucket90Plus * 100) / 100,
      },
      invoices: agingItems,
    };
  }

  /**
   * Executive Accounting Dashboard KPI Summary
   */
  static async getDashboardSummary({ start_date = null, end_date = null, property_id = null }) {
    const pl = await this.getProfitAndLoss({ start_date, end_date, property_id });
    const bs = await this.getBalanceSheet({ as_of_date: end_date, property_id });
    const ar = await this.getARAging({ as_of_date: end_date, property_id });

    // Calculate Cash & Bank total (1010, 1020, 1030, 1040)
    const cashBankAccounts = bs.assets.filter((a) => a.category === 'CASH_AND_BANK');
    const totalCashBank = cashBankAccounts.reduce((sum, a) => sum + Number(a.balance || 0), 0);

    // Calculate Owner Funds Payable (2200)
    const ownerPayable = bs.liabilities.find((a) => a.account_code === '2200')?.balance || 0;

    // Calculate Vendor Payables (2010)
    const vendorPayable = bs.liabilities.find((a) => a.account_code === '2010')?.balance || 0;

    // Calculate Deposit Liabilities (2100)
    const depositLiability = bs.liabilities.find((a) => a.account_code === '2100')?.balance || 0;

    // Monthly trends (Last 6 months)
    const monthlyTrends = [];
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const mYear = d.getFullYear();
      const mMonth = d.getMonth() + 1;
      const monthStr = mMonth < 10 ? `0${mMonth}` : `${mMonth}`;
      const mStart = `${mYear}-${monthStr}-01`;
      const mEnd = `${mYear}-${monthStr}-${new Date(mYear, mMonth, 0).getDate()}`;
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

      const monthPL = await this.getProfitAndLoss({ start_date: mStart, end_date: mEnd, property_id });
      monthlyTrends.push({
        month: `${monthNames[mMonth - 1]} ${mYear}`,
        revenue: monthPL.total_revenue,
        expense: monthPL.total_expense,
        noi: monthPL.net_operating_income,
      });
    }

    return {
      kpis: {
        total_revenue: pl.total_revenue,
        total_expense: pl.total_expense,
        net_operating_income: pl.net_operating_income,
        cash_and_bank_balance: Math.round(totalCashBank * 100) / 100,
        tenant_receivables_ar: ar.total_ar,
        vendor_payables_ap: vendorPayable,
        owner_funds_payable: ownerPayable,
        tenant_deposit_liability: depositLiability,
        balance_sheet_balanced: bs.is_balanced,
      },
      ar_aging: ar.buckets,
      monthly_trends: monthlyTrends,
    };
  }
}

module.exports = AccountingReportService;
