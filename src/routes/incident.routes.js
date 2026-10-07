const express = require('express');
const router = express.Router();
const incidentController = require('../controllers/incident.controller');
const { auth, authorize } = require('../middleware/auth.middleware');

router.use(auth);

router.post('/', authorize('CARETAKER', 'OWNER', 'ADMIN'), incidentController.createIncident);
router.get('/', authorize('CARETAKER', 'OWNER', 'ADMIN'), incidentController.getIncidents);
router.patch('/:id/status', authorize('CARETAKER', 'OWNER', 'ADMIN'), incidentController.updateIncidentStatus);

module.exports = router;
