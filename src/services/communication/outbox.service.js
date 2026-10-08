const OutboxEvent = require('../../models/OutboxEvent');
const logger = require('../../utils/logger');

class OutboxService {
  /**
   * Queue a communication event via the Outbox pattern.
   * Can be wrapped in a transaction if passed in.
   * 
   * @param {Object} data
   * {
   *   recipient_id: number,
   *   channel: 'SMS' | 'EMAIL' | 'PUSH' | 'IN_APP',
   *   template_event_type: string,
   *   context: Object,
   *   entity_type: string,
   *   entity_id: number,
   *   phone?: string,
   *   email?: string
   * }
   * @param {Object} transaction (Optional) Sequelize transaction
   */
  static async queueCommunication(data, transaction = null) {
    try {
      const event = await OutboxEvent.create({
        event_type: 'SEND_COMMUNICATION',
        payload: data,
        status: 'PENDING'
      }, { transaction });

      logger.debug(`Queued OutboxEvent ${event.id} for ${data.channel}`);
      return event;
    } catch (error) {
      logger.error('Failed to queue OutboxEvent:', error);
      throw error;
    }
  }
}

module.exports = OutboxService;
