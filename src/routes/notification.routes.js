const express = require('express');
const notificationController = require('../controllers/notification.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

router
  .route('/')
  .post(auth, notificationController.createNotification)
  .get(auth, notificationController.getNotifications);

router
  .route('/:notificationId/read')
  .patch(auth, notificationController.markAsRead);

module.exports = router;
