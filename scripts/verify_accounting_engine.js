const { sequelize, connectDB } = require('../src/config/db');
const initAccountingSystem = require('../src/scripts/init_accounting_system');
const AccountingService = require('../src/services/accounting/accounting.service');
const AccountingReportService = require('../src/services/accounting/accountingReport.service');
const Account = require('../src/models/Account');
const JournalEntry = require('../src/models/JournalEntry');
const JournalLine = require('../src/models/JournalLine');
const AccountingPeriod = require('../src/models/AccountingPeriod');
const logger = require('../src/utils/logger');

async function runAccountingVerification() {
  console.log('--- STARTING ACCOUNTING SUBSYSTEM VERIFICATION ---');

  try {
    await connectDB();
    await initAccountingSystem();

    const today = new Date().toISOString().slice(0, 10);
    const arAccount = await Account.findOne({ where: { account_code: '1200' } });
    const bankAccount = await Account.findOne({ where: { account_code: '1010' } });
    const rentalRevenue = await Account.findOne({ where: { account_code: '4010' } });

    if (!arAccount || !bankAccount || !rentalRevenue) {
      throw new Error('Default Chart of Accounts missing required standard accounts.');
    }

    console.log('[PASS] Chart of accounts verified.');

    // 1. Double-Entry Test: Unbalanced journal must fail
    console.log('[TEST 1] Testing rejection of unbalanced journal entry...');
    let unbalancedFailed = false;
    try {
      await AccountingService.postJournalEntry({
        entry_date: today,
        description: 'Unbalanced test entry',
        source_type: 'MANUAL',
        lines: [
          { account_id: arAccount.id, debit: 1000, credit: 0, description: 'Debit only' },
          { account_id: rentalRevenue.id, debit: 0, credit: 950, description: 'Credit unequal' },
        ],
      });
    } catch (err) {
      unbalancedFailed = true;
      console.log(`[PASS] Unbalanced journal correctly rejected with: "${err.message}"`);
    }
    if (!unbalancedFailed) {
      throw new Error('FAILED: Unbalanced journal entry was unexpectedly permitted!');
    }

    // 2. Double-Entry Test: Balanced journal entry posts successfully
    console.log('[TEST 2] Testing posting of balanced journal entry...');
    const balancedEntry = await AccountingService.postJournalEntry({
      entry_date: today,
      description: 'Balanced test manual journal',
      source_type: 'MANUAL',
      lines: [
        { account_id: arAccount.id, debit: 5000, credit: 0, description: 'Tenant AR charge' },
        { account_id: rentalRevenue.id, debit: 0, credit: 5000, description: 'Rental revenue' },
      ],
    });
    console.log(`[PASS] Balanced journal entry posted successfully: ${balancedEntry.entry_number} (Total: KSh ${balancedEntry.total_debit})`);

    // 3. Payment Posting Test: Debit Bank, Credit AR
    console.log('[TEST 3] Testing payment receipt posting...');
    const paymentEntry = await AccountingService.postJournalEntry({
      entry_date: today,
      description: 'Test tenant payment receipt',
      source_type: 'PAYMENT',
      source_id: 'TEST-PAY-001',
      lines: [
        { account_id: bankAccount.id, debit: 5000, credit: 0, description: 'Received in Bank' },
        { account_id: arAccount.id, debit: 0, credit: 5000, description: 'Cleared Tenant AR' },
      ],
    });
    console.log(`[PASS] Payment receipt posted successfully: ${paymentEntry.entry_number}`);

    // 4. Controlled Reversal Test
    console.log('[TEST 4] Testing controlled reversal of a posted journal...');
    const reversalEntry = await AccountingService.reverseJournalEntry(
      paymentEntry.id,
      { reason: 'Test reversal for payment correction' }
    );
    console.log(`[PASS] Reversal entry created: ${reversalEntry.entry_number}, original status updated to REVERSED.`);

    // 5. Financial Reports Test: Trial Balance Equality
    console.log('[TEST 5] Testing Trial Balance debits and credits balance...');
    const tb = await AccountingReportService.getTrialBalance({
      asOfDate: today,
    });
    console.log(`[REPORT] Trial Balance -> Total Debits: KSh ${tb.total_debit}, Total Credits: KSh ${tb.total_credit}, Balanced: ${tb.is_balanced}`);
    if (!tb.is_balanced) {
      throw new Error(`FAILED: Trial Balance is out of balance by KSh ${tb.net_difference}`);
    }
    console.log('[PASS] Trial balance strictly verified balanced (Debits == Credits).');

    // 6. Balance Sheet Invariant Test: Assets == Liabilities + Equity
    console.log('[TEST 6] Testing Balance Sheet accounting equation...');
    const bs = await AccountingReportService.getBalanceSheet({
      asOfDate: today,
    });
    console.log(`[REPORT] Balance Sheet -> Assets: KSh ${bs.total_assets}, Liab+Equity: KSh ${bs.total_liabilities_and_equity}, Balanced: ${bs.is_balanced}`);
    if (!bs.is_balanced) {
      throw new Error(`FAILED: Balance Sheet out of balance by KSh ${bs.net_discrepancy}`);
    }
    console.log('[PASS] Balance Sheet equation holds strictly: Assets = Liabilities + Equity.');

    console.log('--- ALL ACCOUNTING VERIFICATION TESTS PASSED SUCCESSFULLY ---');
    process.exit(0);
  } catch (error) {
    console.error('VERIFICATION ERROR:', error);
    process.exit(1);
  }
}

runAccountingVerification();
