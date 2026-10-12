const express = require('express');
const settingsController = require('../controllers/settings.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

// User profile & preferences
router.get('/profile', auth, settingsController.getProfilePreferences);
router.put('/profile', auth, settingsController.updateProfile);
router.put('/preferences', auth, settingsController.updatePreferences);
router.post('/change-password', auth, settingsController.changePassword);

// Scoped System Settings (Org, Rental, Finance, Notifications, Integrations, Security)
router.get('/:category', auth, settingsController.getSettings);
router.put('/:category', auth, settingsController.updateSettings);

module.exports = router;
