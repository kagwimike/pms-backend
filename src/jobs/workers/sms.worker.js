const { Worker } = require('bullmq');
const { redisConfig } = require('../../config/redis');
const logger = require('../../utils/logger');
const env = require('../../config/env');
const MessageLog = require('../../models/MessageLog');

// Initialize Africa's Talking
const africastalking = require('africastalking')({
  apiKey: env.atApiKey || 'mock-api-key',
  username: env.atUsername || 'sandbox'
});
const sms = africastalking.SMS;

const smsWorker = new Worker('sms-queue', async (job) => {
  const payload = job.data;
  logger.info(`Processing SMS for MessageLog ID: ${payload.log_id}`);

  const log = await MessageLog.findByPk(payload.log_id);
  if (!log) throw new Error('MessageLog not found');

  try {
    await log.update({ status: 'SENDING' });

    // In a real scenario, use actual phone. We fallback to sandbox number.
    const to = payload.phone || '+254711XXXYYY';
    
    // Simulate real SMS for sandbox if running in development without credentials
    if (!env.atApiKey) {
      logger.info(`[MOCK SMS] To: ${to} -> ${payload.content}`);
      await log.update({
        status: 'SENT',
        sent_at: new Date(),
        provider: 'mock_africastalking',
        provider_id: `mock_sms_${Date.now()}`
      });
      return;
    }

    const options = {
      to: [to],
      message: payload.content,
      // enqueue: true // Add this if needed
    };

    const response = await sms.send(options);
    logger.info('AT SMS response:', response);

    // Get the AT messageId for the first recipient
    const recipientInfo = response.SMSMessageData.Recipients[0];
    const atMessageId = recipientInfo.messageId;

    await log.update({
      status: 'SENT',
      sent_at: new Date(),
      provider: 'africastalking',
      provider_id: atMessageId
    });

  } catch (error) {
    logger.error('SMS Worker error:', error);
    await log.update({
      status: 'FAILED',
      error_message: error.message || 'Unknown error',
      failed_at: new Date()
    });
    throw error;
  }

}, { connection: redisConfig });

smsWorker.on('completed', (job) => {
  logger.info(`SMS Job ${job.id} has completed!`);
});

smsWorker.on('failed', (job, err) => {
  logger.error(`SMS Job ${job.id} has failed with ${err.message}`);
});

module.exports = smsWorker;
