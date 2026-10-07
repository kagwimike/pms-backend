const logger = require('../../../utils/logger');

/**
 * Dispatcher for Email messages using SendGrid/SES.
 */
class EmailDispatcher {
  static async send({ recipientEmail, subject, htmlBody, logId }) {
    if (!recipientEmail) {
      throw new Error('Missing recipient email address');
    }

    logger.info(`[Email Dispatcher] Sending Email to ${recipientEmail}: ${subject} (LogID: ${logId})`);

    // --- Email Integration Stub (SendGrid/Nodemailer) ---
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          providerId: `EMAIL-${Date.now()}`,
          provider: 'sendgrid_mock'
        });
      }, 500);
    });
  }
}

module.exports = EmailDispatcher;
