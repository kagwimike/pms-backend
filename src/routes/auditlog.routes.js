const express = require('express');
const auditlogController = require('../controllers/auditlog.controller');
const { auth, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router
  .route('/')
  .get(auth, authorize('ADMIN', 'OWNER'), auditlogController.getAuditLogs);

module.exports = router;
