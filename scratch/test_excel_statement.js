const xlsx = require('xlsx');
const { extractRowsFromBuffer } = require('../src/services/payments/bankStatement.service');

// Create an in-memory Excel workbook mimicking Co-op Bank or KCB statement
const wb = xlsx.utils.book_new();
const wsData = [
  ['Transaction Date', 'Doc Reference', 'Transaction Remarks', 'Credit Amount', 'Debit Amount', 'Running Balance'],
  ['2026-10-10', 'COOP881923', 'INV-55 RENT PAYMENT', 60000, null, 60000],
  ['2026-10-11', 'COOP881924', 'APT 12 WATER BILL', 3500, null, 63500],
  ['2026-10-12', 'CHG992', 'EXCISE DUTY', null, 250, 63250],
];
const ws = xlsx.utils.aoa_to_sheet(wsData);
xlsx.utils.book_append_sheet(wb, ws, 'AccountStatement');

const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
const rows = extractRowsFromBuffer(excelBuffer, 'statement.xlsx');

console.log('Successfully extracted Excel rows:');
console.log(JSON.stringify(rows, null, 2));

if (rows.length !== 2) {
  console.error(`Expected 2 credit rows, got ${rows.length}`);
  process.exit(1);
}

console.log('--- TEST PASSED: Excel (.xlsx) Statement Parsed Correctly ---');
process.exit(0);
