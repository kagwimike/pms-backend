const smsQueue = require('../../jobs/queues/sms.queue');
const emailQueue = require('../../jobs/queues/email.queue');
const pushQueue = require('../../jobs/queues/push.queue');
const notificationQueue = require('../../jobs/queues/notification.queue');
const logger = require('../../utils/logger');
const MessageLog = require('../../models/MessageLog');

class CommunicationDispatcher {
  
  /**
   * Route an outgoing message to the correct provider queue.
   * @param {Object} payload 
   * {
   *   recipient_id: number,
   *   channel: 'SMS' | 'EMAIL' | 'PUSH' | 'IN_APP',
   *   event_type: string,
   *   content: string,
   *   subject: string,
   *   entity_type: string,
   *   entity_id: number,
   *   phone: string, // for sms
   *   email: string, // for email
   *   template_id: number
   * }
   */
  static async dispatch(payload) {
    try {
      // 1. Create a MessageLog entry in PENDING state
      const log = await MessageLog.create({
        recipient_id: payload.recipient_id,
        channel: payload.channel,
        event_type: payload.event_type,
        content: payload.content,
        subject: payload.subject,
        entity_type: payload.entity_type,
        entity_id: payload.entity_id,
        template_id: payload.template_id,
        status: 'PENDING'
      });

      const jobData = { ...payload, log_id: log.id };

      // 2. Push to respective BullMQ queue
      switch (payload.channel) {
        case 'SMS':
          await smsQueue.add('send_sms', jobData, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } });
          break;
        case 'EMAIL':
          await emailQueue.add('send_email', jobData, { attempts: 3 });
          break;
        case 'PUSH':
          await pushQueue.add('send_push', jobData, { attempts: 3 });
          break;
        case 'IN_APP':
          await notificationQueue.add('send_in_app', jobData, { attempts: 2 });
          break;
        default:
          logger.warn(`Unknown channel type: ${payload.channel}`);
          await log.update({ status: 'FAILED', error_message: 'Unknown channel' });
          return;
      }

      await log.update({ status: 'QUEUED' });
      logger.info(`Dispatched ${payload.channel} message (Log ID: ${log.id})`);

    } catch (error) {
      logger.error('Dispatcher error:', error);
    }
  }
}

module.exports = CommunicationDispatcher;
