const logger = require('../../../utils/logger');

/**
 * Dispatcher for Push notifications using Firebase Cloud Messaging (FCM).
 */
class PushDispatcher {
  static async send({ fcmToken, title, message, logId }) {
    if (!fcmToken) {
      throw new Error('Missing FCM token for push notification');
    }

    logger.info(`[Push Dispatcher] Sending Push to ${fcmToken}: ${title} (LogID: ${logId})`);

    // --- Firebase Admin SDK Integration Stub ---
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          providerId: `FCM-${Date.now()}`,
          provider: 'firebase_mock'
        });
      }, 500);
    });
  }
}

module.exports = PushDispatcher;
