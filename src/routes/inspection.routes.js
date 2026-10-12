const express = require('express');
const inspectionController = require('../controllers/inspection.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

// Pricing catalog & checklist defaults
router.get('/catalog', auth, inspectionController.getPricingCatalog);

// General Inspection Routes
router
  .route('/')
  .post(auth, inspectionController.createInspection)
  .get(auth, inspectionController.getInspections);

// Damage standalone routes
router
  .route('/damages')
  .post(auth, inspectionController.createDamage);

router
  .route('/damages/:damageId')
  .delete(auth, inspectionController.deleteDamage);

// Single Inspection Routes
router
  .route('/:inspectionId')
  .get(auth, inspectionController.getInspection)
  .put(auth, inspectionController.updateInspection)
  .patch(auth, inspectionController.updateInspection)
  .delete(auth, inspectionController.deleteInspection);

// Nested Damage Routes for a Specific Inspection
router
  .route('/:inspectionId/damages')
  .post(auth, inspectionController.createDamage)
  .get(auth, inspectionController.getDamagesByInspection);

// Deposit Deductions Calculation & Reconciliation Finalization
router
  .route('/:inspectionId/deposit-reconciliation')
  .get(auth, inspectionController.calculateDepositDeductions);

router
  .route('/:inspectionId/finalize-refund')
  .post(auth, inspectionController.finalizeDepositRefund);

module.exports = router;