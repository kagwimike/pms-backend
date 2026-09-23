const express = require('express');
const inspectionController = require('../controllers/inspection.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

// General Inspection Routes
router
  .route('/')
  .post(auth, inspectionController.createInspection)
  .get(auth, inspectionController.getInspections);

// Standalone Damage creation route (optional fallback)
router
  .route('/damages')
  .post(auth, inspectionController.createDamage);

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

module.exports = router;