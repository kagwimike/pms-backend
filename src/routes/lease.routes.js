const express = require('express');
const leaseController = require('../controllers/lease.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

router
  .route('/')
  .post(auth, leaseController.createLease)
  .get(auth, leaseController.getLeases);

router
  .route('/:leaseId')
  .get(auth, leaseController.getLease)
  .patch(auth, leaseController.updateLeaseStatus);

module.exports = router;
