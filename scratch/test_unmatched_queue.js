const unmatchedService = require('../src/services/payments/unmatchedQueue.service');
const unmatchedController = require('../src/controllers/unmatchedQueue.controller');

console.log('Testing Unmatched Queue Service & Controller Exports:');
console.log('Available service methods:', Object.keys(unmatchedService));
console.log('Available controller methods:', Object.keys(unmatchedController));

if (
  typeof unmatchedService.getSuggestedMatchesForPayment !== 'function' ||
  typeof unmatchedService.assignPaymentToInvoice !== 'function' ||
  typeof unmatchedService.resolveUnmatchedPayment !== 'function' ||
  typeof unmatchedService.getUnmatchedQueueStats !== 'function'
) {
  console.error('Missing expected functions on unmatchedQueue.service');
  process.exit(1);
}

if (
  typeof unmatchedController.getUnmatchedQueue !== 'function' ||
  typeof unmatchedController.getQueueStats !== 'function' ||
  typeof unmatchedController.assignPayment !== 'function' ||
  typeof unmatchedController.resolvePayment !== 'function' ||
  typeof unmatchedController.getPaymentCandidates !== 'function'
) {
  console.error('Missing expected controller actions on unmatchedQueue.controller');
  process.exit(1);
}

console.log('--- TEST PASSED: Phase 3 Unmatched Queue Modules Loaded Correctly ---');
process.exit(0);
