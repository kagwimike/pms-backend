const { Op } = require('sequelize');
const OutboxEvent = require('../../models/OutboxEvent');
const CommunicationDispatcher = require('../../services/communication/dispatcher.service');
const TemplateEngine = require('../../services/communication/template.service');
const logger = require('../../utils/logger');
const User = require('../../models/User');

class OutboxProcessor {
  /**
   * Polls the outbox table for PENDING events and processes them.
   */
  static async processPendingEvents() {
    try {
      // Fetch batch of pending events to prevent memory overflow
      const events = await OutboxEvent.findAll({
        where: { status: 'PENDING' },
        limit: 100,
        order: [['created_at', 'ASC']]
      });

      if (events.length === 0) return;

      logger.info(`OutboxProcessor: Processing ${events.length} events...`);

      for (const event of events) {
        try {
          const payload = event.payload;

          if (event.event_type === 'SEND_COMMUNICATION') {
            // Render template
            const rendered = await TemplateEngine.render(
              payload.template_event_type, 
              payload.channel, 
              payload.context
            );

            if (rendered) {
              await CommunicationDispatcher.dispatch({
                recipient_id: payload.recipient_id,
                channel: payload.channel,
                event_type: payload.template_event_type,
                content: rendered.content,
                subject: rendered.subject,
                template_id: rendered.template_id,
                entity_type: payload.entity_type,
                entity_id: payload.entity_id,
                phone: payload.phone,
                email: payload.email
              });
            } else {
              logger.warn(`No template rendered for OutboxEvent ${event.id}`);
            }
          }

          // Mark as processed
          await event.update({ status: 'PROCESSED', processed_at: new Date() });
        } catch (err) {
          logger.error(`Error processing OutboxEvent ${event.id}:`, err);
          await event.update({ status: 'FAILED', error_message: err.message });
        }
      }

    } catch (error) {
      logger.error('OutboxProcessor global error:', error);
    }
  }
}

module.exports = OutboxProcessor;
