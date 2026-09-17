const express = require('express');
const maintenanceController = require('../controllers/maintenance.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

router
  .route('/requests')
  .post(auth, maintenanceController.createMaintenanceRequest)
  .get(auth, maintenanceController.getMaintenanceRequests);

router
  .route('/requests/:requestId')
  .get(auth, maintenanceController.getMaintenanceRequest)
  .patch(auth, maintenanceController.updateMaintenanceRequest)
  .put(auth, maintenanceController.updateMaintenanceRequest);

router
  .route('/vendors')
  .post(auth, maintenanceController.createVendor)
  .get(auth, maintenanceController.getVendors);

router
  .route('/vendors/:vendorId')
  .put(auth, maintenanceController.updateVendor)
  .patch(auth, maintenanceController.updateVendor)
  .delete(auth, maintenanceController.deleteVendor);

module.exports = router;
