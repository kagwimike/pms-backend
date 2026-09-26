const express = require('express');
const unitController = require('../controllers/unit.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

router
  .route('/')
  .post(auth, unitController.createUnitType)
  .get(auth, unitController.getUnitTypes);

router
  .route('/:typeId')
  .get(auth, unitController.getUnitType)
  .put(auth, unitController.updateUnitType)
  .patch(auth, unitController.updateUnitType)
  .delete(auth, unitController.deleteUnitType);

module.exports = router;