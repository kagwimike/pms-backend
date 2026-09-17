const express = require('express');
const authRoutes = require('./auth.routes');
const propertyRoutes = require('./property.routes');
const userRoutes = require('./user.routes');
const bookingRoutes = require('./booking.routes');
const unitRoutes = require('./unit.routes');
const leaseRoutes = require('./lease.routes');
const paymentRoutes = require('./payment.routes');
const maintenanceRoutes = require('./maintenance.routes');
const inspectionRoutes = require('./inspection.routes');
const notificationRoutes = require('./notification.routes');

const documentRoutes = require('./document.routes');
const auditlogRoutes = require('./auditlog.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/properties', propertyRoutes);
router.use('/users', userRoutes);
router.use('/bookings', bookingRoutes);
router.use('/units', unitRoutes);
router.use('/leases', leaseRoutes);
router.use('/finance', paymentRoutes); // Combined payments/invoices under finance
router.use('/maintenance', maintenanceRoutes);
router.use('/inspections', inspectionRoutes);
router.use('/notifications', notificationRoutes);
router.use('/documents', documentRoutes);
router.use('/auditlogs', auditlogRoutes);

module.exports = router;
