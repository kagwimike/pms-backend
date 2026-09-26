const express = require('express');
const unitController = require('../controllers/unit.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

// ==================== UNIT TYPES ROUTES ====================
// Placed above /:unitId to prevent route parameter collision
router
  .route('/unit-types')
  .get(auth, unitController.getUnitTypes)
  .post(auth, unitController.createUnitType);

router
  .route('/unit-types/:typeId')
  .get(auth, unitController.getUnitType)
  .put(auth, unitController.updateUnitType)
  .patch(auth, unitController.updateUnitType)
  .delete(auth, unitController.deleteUnitType);

// ==================== BASE UNITS ROUTES ====================
router
  .route('/')
  .get(auth, unitController.getUnits)
  .post(auth, unitController.createUnit);

router
  .route('/:unitId')
  .get(auth, unitController.getUnit)
  .put(auth, unitController.updateUnit)
  .patch(auth, unitController.updateUnit)
  .delete(auth, unitController.deleteUnit);

module.exports = router;