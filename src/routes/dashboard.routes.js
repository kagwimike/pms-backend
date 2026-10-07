const express = require('express');
const { auth, authorize } = require('../middleware/auth.middleware');
const {
  getCaretakerDashboard,
  getCaretakerReports,
  getVendorDashboard
} = require('../controllers/dashboard.controller');

const router = express.Router();

router.get(
  '/caretaker',
  auth,
  authorize('ADMIN', 'OWNER', 'CARETAKER'),
  getCaretakerDashboard
);

router.get(
  '/caretaker/reports',
  auth,
  authorize('ADMIN', 'OWNER', 'CARETAKER'),
  getCaretakerReports
);

router.get(
  '/vendor',
  auth,
  authorize('VENDOR'),
  getVendorDashboard
);

module.exports = router;
