const logger = require('../../../utils/logger');
// const env = require('../../../config/env');
// const AfricasTalking = require('africastalking');

/**
 * Dispatcher for SMS messages using Africa's Talking.
 */
class SmsDispatcher {
  static async send({ recipientPhone, message, logId }) {
    if (!recipientPhone) {
      throw new Error('Missing recipient phone number for SMS');
    }

    logger.info(`[SMS Dispatcher] Sending SMS to ${recipientPhone}: ${message} (LogID: ${logId})`);

    // --- Africa's Talking Integration Stub ---
    // const credentials = {
    //     apiKey: env.smsApiKey,
    //     username: env.smsUsername,
    // };
    // const africastalking = AfricasTalking(credentials);
    // const sms = africastalking.SMS;
    //
    // const result = await sms.send({
    //     to: [recipientPhone],
    //     message: message,
    //     from: env.smsSenderId
    // });
    // return { providerId: result.SMSMessageData.Recipients[0].messageId, provider: 'africas_talking' };
    
    // For now, simulate a successful network request
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          providerId: `AT-SIM-${Date.now()}`,
          provider: 'africas_talking_mock'
        });
      }, 500);
    });
  }
}

module.exports = SmsDispatcher;
