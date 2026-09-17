const express = require('express');
const inspectionController = require('../controllers/inspection.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

router
  .route('/')
  .post(auth, inspectionController.createInspection)
  .get(auth, inspectionController.getInspections);

router
  .route('/:inspectionId')
  .get(auth, inspectionController.getInspection)
  .put(auth, inspectionController.updateInspection)
  .patch(auth, inspectionController.updateInspection);

router
  .route('/damages')
  .post(auth, inspectionController.createDamage);

module.exports = router;
