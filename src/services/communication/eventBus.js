const communicationQueue = require('../../jobs/queues/communication.queue');
const logger = require('../../utils/logger');

class EventBus {
  /**
   * Publish a communication event to the background queue.
   * This decoupled method ensures business transactions do not wait for delivery.
   * 
   * @param {string} eventType e.g., 'PAYMENT_RECEIVED', 'INVOICE_CREATED'
   * @param {Object} payload 
   * @param {number} payload.recipientId
   * @param {string} payload.entityType
   * @param {number} payload.entityId
   * @param {Object} payload.data Additional data for templating
   */
  static async publishCommunicationEvent(eventType, payload) {
    try {
      // Adding a unique job ID helps with idempotency
      const jobId = `${eventType}:${payload.entityType}:${payload.entityId}:${Date.now()}`;
      
      await communicationQueue.add(
        eventType,
        {
          eventType,
          ...payload
        },
        {
          jobId, // Prevent duplicate identical events if fired simultaneously
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 5000, // 5s, 25s, 125s
          },
          removeOnComplete: true,
          removeOnFail: false,
        }
      );
      
      logger.info(`Published communication event ${eventType} for recipient ${payload.recipientId}`);
    } catch (error) {
      logger.error(`Failed to publish communication event ${eventType}: ${error.message}`);
    }
  }
}

module.exports = EventBus;
