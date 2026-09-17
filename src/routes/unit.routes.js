const express = require('express');
const unitController = require('../controllers/unit.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

router
  .route('/')
  .post(auth, unitController.createUnit)
  .get(auth, unitController.getUnits);

router
  .route('/:unitId')
  .put(auth, unitController.updateUnit)
  .patch(auth, unitController.updateUnit)
  .delete(auth, unitController.deleteUnit);

module.exports = router;
