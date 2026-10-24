const { sequelize } = require('../config/db');
const Account = require('../models/Account');
const AccountingPeriod = require('../models/AccountingPeriod');
const JournalEntry = require('../models/JournalEntry');
const JournalLine = require('../models/JournalLine');
const AccountingSetting = require('../models/AccountingSetting');
const Invoice = require('../models/Invoice');
const Payment = require('../models/Payment');
const DepositRefund = require('../models/DepositRefund');
const Lease = require('../models/Lease');
const Unit = require('../models/Unit');
const Property = require('../models/Property');
const logger = require('../utils/logger');

const DEFAULT_CHART_OF_ACCOUNTS = [
  // ─── ASSETS (1000 - 1999) ───
  {
    account_code: '1010',
    account_name: 'Operating Bank Account',
    account_type: 'ASSET',
    normal_balance: 'DEBIT',
    category: 'CASH_AND_BANK',
    description: 'Primary operating bank checking account for general collections and disbursements',
    is_system: true,
  },
  {
    account_code: '1020',
    account_name: 'Cash on Hand (Petty Cash)',
    account_type: 'ASSET',
    normal_balance: 'DEBIT',
    category: 'CASH_AND_BANK',
    description: 'Cash drawer and petty cash floats for minor estate operational expenses',
    is_system: false,
  },
  {
    account_code: '1030',
    account_name: 'M-Pesa Collection Clearing Account',
    account_type: 'ASSET',
    normal_balance: 'DEBIT',
    category: 'CASH_AND_BANK',
    description: 'Safaricom Daraja Paybill / C2B clearing balance prior to bank settlement',
    is_system: true,
  },
  {
    account_code: '1040',
    account_name: 'Tenant Security Deposits Held (Trust Bank)',
    account_type: 'ASSET',
    normal_balance: 'DEBIT',
    category: 'CASH_AND_BANK',
    description: 'Dedicated client trust bank account for holding refundable tenant security deposits',
    is_system: true,
  },
  {
    account_code: '1200',
    account_name: 'Tenant Accounts Receivable',
    account_type: 'ASSET',
    normal_balance: 'DEBIT',
    category: 'ACCOUNTS_RECEIVABLE',
    description: 'Control account for outstanding rent, utility, and maintenance billings owed by tenants',
    is_system: true,
  },
  {
    account_code: '1210',
    account_name: 'Owner Advances Receivable',
    account_type: 'ASSET',
    normal_balance: 'DEBIT',
    category: 'OTHER_RECEIVABLE',
    description: 'Funds advanced to property landlords prior to rental collection reconciliation',
    is_system: false,
  },
  {
    account_code: '1300',
    account_name: 'Prepaid Expenses',
    account_type: 'ASSET',
    normal_balance: 'DEBIT',
    category: 'CURRENT_ASSET',
    description: 'Prepaid property insurance, annual council rates, and estate vendor retainers',
    is_system: false,
  },
  {
    account_code: '1500',
    account_name: 'Property, Plant & Equipment (Fixed Assets)',
    account_type: 'ASSET',
    normal_balance: 'DEBIT',
    category: 'FIXED_ASSET',
    description: 'Company-owned physical property, equipment, water meters, and fixtures',
    is_system: false,
  },
  {
    account_code: '1590',
    account_name: 'Accumulated Depreciation',
    account_type: 'ASSET',
    normal_balance: 'CREDIT',
    category: 'FIXED_ASSET',
    description: 'Contra-asset account tracking cumulative depreciation on fixed assets',
    is_system: false,
  },

  // ─── LIABILITIES (2000 - 2999) ───
  {
    account_code: '2010',
    account_name: 'Accounts Payable (Vendor Bills)',
    account_type: 'LIABILITY',
    normal_balance: 'CREDIT',
    category: 'ACCOUNTS_PAYABLE',
    description: 'Control account for unpaid maintenance contractors, utilities, and vendor invoices',
    is_system: true,
  },
  {
    account_code: '2100',
    account_name: 'Tenant Security Deposits Liability',
    account_type: 'LIABILITY',
    normal_balance: 'CREDIT',
    category: 'DEPOSIT_LIABILITY',
    description: 'Fiduciary obligation representing refundable security deposits held on behalf of tenants',
    is_system: true,
  },
  {
    account_code: '2200',
    account_name: 'Owner Funds Payable',
    account_type: 'LIABILITY',
    normal_balance: 'CREDIT',
    category: 'OWNER_LIABILITY',
    description: 'Net rental funds collected on behalf of landlords available for distribution/payout',
    is_system: true,
  },
  {
    account_code: '2300',
    account_name: 'Accrued Expenses & Utilities Payable',
    account_type: 'LIABILITY',
    normal_balance: 'CREDIT',
    category: 'CURRENT_LIABILITY',
    description: 'Accrued utility liabilities and unpaid operating expenses incurred in the period',
    is_system: false,
  },
  {
    account_code: '2400',
    account_name: 'Taxes Payable (VAT / WHT)',
    account_type: 'LIABILITY',
    normal_balance: 'CREDIT',
    category: 'CURRENT_LIABILITY',
    description: 'Withholding tax and value added tax liabilities payable to revenue authorities (KRA)',
    is_system: false,
  },

  // ─── EQUITY (3000 - 3999) ───
  {
    account_code: '3010',
    account_name: 'Retained Earnings',
    account_type: 'EQUITY',
    normal_balance: 'CREDIT',
    category: 'EQUITY',
    description: 'Accumulated net earnings carried forward from previous accounting periods',
    is_system: true,
  },
  {
    account_code: '3020',
    account_name: 'Opening Balance Equity',
    account_type: 'EQUITY',
    normal_balance: 'CREDIT',
    category: 'EQUITY',
    description: 'Offsetting equity account used when importing initial historical ledger balances',
    is_system: true,
  },
  {
    account_code: '3030',
    account_name: "Owner's Capital & Equity",
    account_type: 'EQUITY',
    normal_balance: 'CREDIT',
    category: 'EQUITY',
    description: 'Direct equity contributions and owner capital investments in property assets',
    is_system: false,
  },

  // ─── REVENUE (4000 - 4999) ───
  {
    account_code: '4010',
    account_name: 'Rental Income',
    account_type: 'REVENUE',
    normal_balance: 'CREDIT',
    category: 'OPERATING_REVENUE',
    description: 'Earned residential, commercial, and apartment unit rental revenue',
    is_system: true,
  },
  {
    account_code: '4020',
    account_name: 'Utility Surcharge & Recovery Income',
    account_type: 'REVENUE',
    normal_balance: 'CREDIT',
    category: 'OPERATING_REVENUE',
    description: 'Water sub-metering, electricity, and amenity recovery charges billed to tenants',
    is_system: true,
  },
  {
    account_code: '4030',
    account_name: 'Late Payment Penalties & Fees',
    account_type: 'REVENUE',
    normal_balance: 'CREDIT',
    category: 'OTHER_REVENUE',
    description: 'Penalties assessed on overdue rental balances according to lease agreements',
    is_system: true,
  },
  {
    account_code: '4040',
    account_name: 'Parking & Move-In Fee Income',
    account_type: 'REVENUE',
    normal_balance: 'CREDIT',
    category: 'OTHER_REVENUE',
    description: 'Allocated parking fees, gate pass charges, and administrative tenant onboarding fees',
    is_system: false,
  },
  {
    account_code: '4100',
    account_name: 'Property Management Fee Income',
    account_type: 'REVENUE',
    normal_balance: 'CREDIT',
    category: 'OPERATING_REVENUE',
    description: 'Commission and management fees earned by agency on collected rents',
    is_system: true,
  },
  {
    account_code: '4200',
    account_name: 'Other Property & Sundry Revenue',
    account_type: 'REVENUE',
    normal_balance: 'CREDIT',
    category: 'OTHER_REVENUE',
    description: 'Damage recovery reimbursements and miscellaneous estate income',
    is_system: false,
  },

  // ─── EXPENSES (5000 - 5999) ───
  {
    account_code: '5010',
    account_name: 'Maintenance & Repairs Expense',
    account_type: 'EXPENSE',
    normal_balance: 'DEBIT',
    category: 'OPERATING_EXPENSE',
    description: 'Plumbing, electrical, painting, carpentry, and physical unit repair expenses',
    is_system: true,
  },
  {
    account_code: '5020',
    account_name: 'Property Utilities (Water, Power, Waste)',
    account_type: 'EXPENSE',
    normal_balance: 'DEBIT',
    category: 'OPERATING_EXPENSE',
    description: 'Common area lighting, borehole pumping, municipal water, and garbage collection',
    is_system: true,
  },
  {
    account_code: '5030',
    account_name: 'Cleaning & Grounds Care',
    account_type: 'EXPENSE',
    normal_balance: 'DEBIT',
    category: 'OPERATING_EXPENSE',
    description: 'Janitorial, compound landscaping, security sanitation, and pest control',
    is_system: false,
  },
  {
    account_code: '5040',
    account_name: 'Security Services & Guarding',
    account_type: 'EXPENSE',
    normal_balance: 'DEBIT',
    category: 'OPERATING_EXPENSE',
    description: 'Day/night guarding services, electric fence maintenance, and CCTV support',
    is_system: false,
  },
  {
    account_code: '5050',
    account_name: 'Property Insurance Expense',
    account_type: 'EXPENSE',
    normal_balance: 'DEBIT',
    category: 'OPERATING_EXPENSE',
    description: 'Fire, peril, public liability, and building insurance policies',
    is_system: false,
  },
  {
    account_code: '5060',
    account_name: 'Property Land Rates & County Taxes',
    account_type: 'EXPENSE',
    normal_balance: 'DEBIT',
    category: 'OPERATING_EXPENSE',
    description: 'Annual county government land rates, ground rent, and statutory licenses',
    is_system: false,
  },
  {
    account_code: '5070',
    account_name: 'Administrative & Agency Office Expense',
    account_type: 'EXPENSE',
    normal_balance: 'DEBIT',
    category: 'ADMIN_EXPENSE',
    description: 'Printing, telecommunication, legal services, audit fees, and office consumables',
    is_system: false,
  },
  {
    account_code: '5080',
    account_name: 'Bank & Payment Gateway Charges',
    account_type: 'EXPENSE',
    normal_balance: 'DEBIT',
    category: 'ADMIN_EXPENSE',
    description: 'Safaricom M-Pesa tariff deductions, bank statement ledger fees, and transfer costs',
    is_system: true,
  },
  {
    account_code: '5090',
    account_name: 'Depreciation Expense',
    account_type: 'EXPENSE',
    normal_balance: 'DEBIT',
    category: 'ADMIN_EXPENSE',
    description: 'Periodic depreciation amortization on capital property assets',
    is_system: false,
  },
];

const DEFAULT_SETTINGS = [
  { key: 'AR_ACCOUNT_CODE', value: '1200', description: 'Default Tenant Accounts Receivable Control Account' },
  { key: 'AP_ACCOUNT_CODE', value: '2010', description: 'Default Accounts Payable Vendor Bills Account' },
  { key: 'BANK_OPERATING_CODE', value: '1010', description: 'Default Operating Bank Checking Account' },
  { key: 'MPESA_CLEARING_CODE', value: '1030', description: 'M-Pesa Collections Clearing Account' },
  { key: 'DEPOSIT_TRUST_BANK_CODE', value: '1040', description: 'Tenant Deposit Trust Bank Account' },
  { key: 'DEPOSIT_LIABILITY_CODE', value: '2100', description: 'Tenant Security Deposits Liability Account' },
  { key: 'OWNER_PAYABLE_CODE', value: '2200', description: 'Owner Funds Payable Account' },
  { key: 'RETAINED_EARNINGS_CODE', value: '3010', description: 'Retained Earnings Equity Account' },
  { key: 'OPENING_BALANCE_EQUITY_CODE', value: '3020', description: 'Opening Balance Equity Account' },
  { key: 'RENTAL_INCOME_CODE', value: '4010', description: 'Rental Income Account' },
  { key: 'UTILITY_INCOME_CODE', value: '4020', description: 'Utility Surcharge Income Account' },
  { key: 'LATE_FEE_INCOME_CODE', value: '4030', description: 'Late Payment Fee Income Account' },
  { key: 'MANAGEMENT_FEE_INCOME_CODE', value: '4100', description: 'Property Management Fee Income Account' },
  { key: 'MAINTENANCE_EXPENSE_CODE', value: '5010', description: 'Maintenance & Repairs Expense Account' },
  { key: 'UTILITY_EXPENSE_CODE', value: '5020', description: 'Property Utilities Expense Account' },
  { key: 'BANK_CHARGES_CODE', value: '5080', description: 'Bank and Gateway Processing Charges Account' },
  { key: 'FUNCTIONAL_CURRENCY', value: 'KES', description: 'Primary Functional Accounting Currency' },
];

/**
 * Initializes the entire accounting database schema, chart of accounts,
 * default accounting periods, and settings.
 */
const initAccountingSystem = async () => {
  logger.info('Initializing PMS Pro Double-Entry Accounting Subsystem...');

  // 1. Sync Accounting Tables
  await Account.sync({ alter: true });
  await AccountingPeriod.sync({ alter: true });
  await JournalEntry.sync({ alter: true });
  await JournalLine.sync({ alter: true });
  await AccountingSetting.sync({ alter: true });
  logger.info('Accounting tables synchronized successfully.');

  // 2. Seed Default Chart of Accounts
  for (const acc of DEFAULT_CHART_OF_ACCOUNTS) {
    await Account.findOrCreate({
      where: { account_code: acc.account_code },
      defaults: acc,
    });
  }
  logger.info(`Chart of Accounts ready with ${DEFAULT_CHART_OF_ACCOUNTS.length} standard accounts.`);

  // 3. Seed Accounting Periods for Current and Adjacent Years
  const currentYear = new Date().getFullYear();
  for (const year of [currentYear - 1, currentYear, currentYear + 1]) {
    for (let month = 1; month <= 12; month++) {
      const monthStr = month < 10 ? `0${month}` : `${month}`;
      const startDate = `${year}-${monthStr}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${monthStr}-${lastDay}`;
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];

      await AccountingPeriod.findOrCreate({
        where: { fiscal_year: year, period_number: month },
        defaults: {
          period_name: `${monthNames[month - 1]} ${year}`,
          fiscal_year: year,
          period_number: month,
          start_date: startDate,
          end_date: endDate,
          status: 'OPEN',
        },
      });
    }
  }
  logger.info('Accounting Periods initialized for fiscal years.');

  // 4. Seed Accounting Settings
  for (const s of DEFAULT_SETTINGS) {
    await AccountingSetting.findOrCreate({
      where: { key: s.key },
      defaults: s,
    });
  }
  logger.info('Accounting Settings initialized.');

  return { success: true };
};

module.exports = initAccountingSystem;
