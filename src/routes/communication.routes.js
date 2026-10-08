const express = require('express');
const router = express.Router();
const CommunicationController = require('../controllers/communication.controller');
const { auth } = require('../middleware/auth.middleware');

// Protect all communication routes
router.use(auth);

// Chat Sessions
router.get('/sessions', CommunicationController.getSessions);
router.post('/sessions', CommunicationController.createSession);

// Chat Messages within a session
router.get('/sessions/maintenance/:maintenanceId', CommunicationController.getSessionByMaintenance);
router.get('/sessions/:sessionId/messages', CommunicationController.getMessages);
router.post('/sessions/:sessionId/messages', CommunicationController.sendMessage);

// Announcements (Admin/Owner/Caretaker only handled in controller)
router.post('/announcements', CommunicationController.createAnnouncement);
router.get('/announcements', CommunicationController.getAnnouncements);

module.exports = router;
