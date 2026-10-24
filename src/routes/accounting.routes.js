const express = require('express');
const router = express.Router();
const accountingController = require('../controllers/accounting.controller');
const { auth, authorize } = require('../middleware/auth.middleware');

// All accounting endpoints require authentication
router.use(auth);

// ─── DASHBOARD SUMMARY ───
router.get('/dashboard-summary', accountingController.getDashboardSummary);

// ─── CHART OF ACCOUNTS ───
router.get('/accounts', accountingController.getAccounts);
router.post('/accounts', authorize('ADMIN', 'ACCOUNTANT', 'MANAGER'), accountingController.createAccount);
router.get('/accounts/:id', accountingController.getAccount);
router.put('/accounts/:id', authorize('ADMIN', 'ACCOUNTANT'), accountingController.updateAccount);
router.delete('/accounts/:id', authorize('ADMIN', 'ACCOUNTANT'), accountingController.deleteAccount);

// ─── JOURNAL ENTRIES ───
router.get('/journals', accountingController.getJournalEntries);
router.post('/journals', authorize('ADMIN', 'ACCOUNTANT', 'MANAGER'), accountingController.createManualJournalEntry);
router.get('/journals/:id', accountingController.getJournalEntry);
router.post('/journals/:id/reverse', authorize('ADMIN', 'ACCOUNTANT'), accountingController.reverseJournalEntry);

// ─── GENERAL LEDGER ───
router.get('/general-ledger', accountingController.getGeneralLedger);

// ─── FINANCIAL STATEMENTS & REPORTS ───
router.get('/trial-balance', accountingController.getTrialBalance);
router.get('/profit-and-loss', accountingController.getProfitAndLoss);
router.get('/balance-sheet', accountingController.getBalanceSheet);
router.get('/cash-flow', accountingController.getCashFlow);

// ─── SPECIALIZED SUBLEDGERS ───
router.get('/subledgers/tenant', accountingController.getTenantSubledger);
router.get('/subledgers/owner', accountingController.getOwnerSubledger);
router.get('/aging/ar', accountingController.getARAging);

// ─── ACCOUNTING PERIODS ───
router.get('/periods', accountingController.getPeriods);
router.post('/periods/:id/close', authorize('ADMIN', 'ACCOUNTANT'), accountingController.closePeriod);
router.post('/periods/:id/reopen', authorize('ADMIN', 'ACCOUNTANT'), accountingController.reopenPeriod);

// ─── HISTORICAL RECONCILIATION & BOOTSTRAP ───
router.post('/migrate-historical', authorize('ADMIN'), accountingController.migrateHistoricalPostings);

module.exports = router;
