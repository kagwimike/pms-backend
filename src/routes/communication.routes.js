const express = require('express');
const router = express.Router();
const CommunicationController = require('../controllers/communication.controller');
const { auth } = require('../middleware/auth.middleware');
const upload = require('../middleware/upload.middleware');

// Protect all communication routes
router.use(auth);

// Contact discovery for new conversations (Vendors, Tenants, Landlords, Caretakers)
router.get('/contacts', CommunicationController.getContacts);

// Chat Sessions
router.get('/sessions', CommunicationController.getSessions);
router.post('/sessions', CommunicationController.createSession);

// Chat Messages within a session
router.get('/sessions/maintenance/:maintenanceId', CommunicationController.getSessionByMaintenance);
router.get('/sessions/:sessionId/messages', CommunicationController.getMessages);
router.post('/sessions/:sessionId/messages', CommunicationController.sendMessage);

// Message Reactions & Media Attachments (Instagram / Messenger style)
router.post('/messages/:messageId/reaction', CommunicationController.reactToMessage);
router.post('/upload', upload.single('file'), CommunicationController.uploadAttachment);

// Announcements
router.post('/announcements', CommunicationController.createAnnouncement);
router.get('/announcements', CommunicationController.getAnnouncements);

module.exports = router;
