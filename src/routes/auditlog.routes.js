const express = require('express');
const auditlogController = require('../controllers/auditlog.controller');
const { auth, authorize } = require('../middleware/auth.middleware');

const router = express.Router();

router
  .route('/')
  .get(auth, authorize('ADMIN', 'OWNER'), auditlogController.getAuditLogs);

router
  .route('/export')
  .get(auth, authorize('ADMIN', 'OWNER'), auditlogController.exportAuditLogs);

router
  .route('/:id')
  .get(auth, authorize('ADMIN', 'OWNER'), auditlogController.getAuditLogById);

module.exports = router;
