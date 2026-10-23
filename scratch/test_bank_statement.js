const { extractRowsFromBuffer } = require('../src/services/payments/bankStatement.service');

// 1. Test CSV Parsing (Sample Kenyan Bank Statement Format - Equity / Co-op)
const sampleCsv = `Date,Reference,Description,Paid In,Paid Out,Balance
2026-10-01,EQ1029384,INV-102 KEVIN MWANGI RENT,45000.00,,45000.00
2026-10-02,CO4938201,RENT APT A4 SKYLINE,30000.00,,75000.00
2026-10-03,KCB928371,0722307799 MARY WANJIKU,25000.00,,100000.00
2026-10-04,CHG001923,MONTHLY LEDGER FEE,,1500.00,98500.00
2026-10-05,EQ9988771,DIRECT DEPOSIT UNASSIGNED,18000.00,,116500.00
`;

const csvBuffer = Buffer.from(sampleCsv, 'utf8');
const rows = extractRowsFromBuffer(csvBuffer, 'equity_statement.csv');

console.log('Successfully extracted deposit rows:');
console.log(JSON.stringify(rows, null, 2));

if (rows.length !== 4) {
  console.error(`Expected 4 deposit rows (skipped 1 ledger fee debit), got ${rows.length}`);
  process.exit(1);
}

console.log('--- TEST PASSED: CSV Statement Parsed Correctly ---');
process.exit(0);
