const logger = require('../../utils/logger');
const User = require('../../models/User');
const Property = require('../../models/Property');
const Unit = require('../../models/Unit');
const Invoice = require('../../models/Invoice');
const Payment = require('../../models/Payment');
const MaintenanceRequest = require('../../models/MaintenanceRequest');
const NotificationTemplate = require('../../models/NotificationTemplate');
const MessageLog = require('../../models/MessageLog');
const Notification = require('../../models/Notification');
const TemplateEngine = require('../../services/communication/templateEngine');
const { SmsDispatcher, EmailDispatcher, PushDispatcher } = require('../../services/communication/dispatchers');

const communicationProcessor = async (job) => {
  logger.info(`Processing communication job ${job.id} for event ${job.data.eventType}`);
  
  try {
    const { eventType, recipientId, entityType, entityId, customVars } = job.data;
    
    // 1. Resolve Recipient
    const recipient = await User.findByPk(recipientId);
    if (!recipient) {
      throw new Error(`Recipient ${recipientId} not found`);
    }

    // 2. Fetch Entity Data for Templating
    const entityData = { recipient, customVars };
    if (entityType === 'PROPERTY') entityData.property = await Property.findByPk(entityId);
    if (entityType === 'UNIT') entityData.unit = await Unit.findByPk(entityId);
    if (entityType === 'INVOICE') entityData.invoice = await Invoice.findByPk(entityId);
    if (entityType === 'PAYMENT') entityData.payment = await Payment.findByPk(entityId);
    if (entityType === 'MAINTENANCE') entityData.maintenance = await MaintenanceRequest.findByPk(entityId);

    // 3. Load active templates for eventType
    const templates = await NotificationTemplate.findAll({
      where: { event_type: eventType, is_active: true }
    });

    if (templates.length === 0) {
      logger.warn(`No active templates found for event type: ${eventType}`);
      return;
    }

    const templateVariables = TemplateEngine.buildVariables(entityData);

    // 4. Render and Dispatch for each Channel configured in the active templates
    for (const template of templates) {
      try {
        const renderedSubject = template.subject ? TemplateEngine.render(template.subject, templateVariables) : null;
        const renderedBody = TemplateEngine.render(template.body, templateVariables);

        // Create MessageLog in PENDING state
        const messageLog = await MessageLog.create({
          recipient_id: recipientId,
          channel: template.channel,
          event_type: eventType,
          template_id: template.id,
          content: renderedBody,
          subject: renderedSubject,
          status: 'SENDING',
          entity_type: entityType,
          entity_id: entityId,
        });

        let dispatchResult;

        // Dispatch via Provider
        if (template.channel === 'SMS') {
          dispatchResult = await SmsDispatcher.send({ recipientPhone: recipient.phone, message: renderedBody, logId: messageLog.id });
        } else if (template.channel === 'EMAIL') {
          dispatchResult = await EmailDispatcher.send({ recipientEmail: recipient.email, subject: renderedSubject, htmlBody: renderedBody, logId: messageLog.id });
        } else if (template.channel === 'PUSH') {
          // Fetch FCM token from a hypothetical device table, or user profile
          const fcmToken = recipient.fcm_token || 'mock_token'; 
          dispatchResult = await PushDispatcher.send({ fcmToken, title: renderedSubject || 'PMS Pro Notification', message: renderedBody, logId: messageLog.id });
        } else if (template.channel === 'IN_APP') {
          // Write directly to the Notification table
          await Notification.create({
            recipient_id: recipientId,
            message: renderedBody,
            type: eventType,
            link: entityType && entityId ? `/${entityType.toLowerCase()}s/${entityId}` : null,
          });
          dispatchResult = { providerId: 'internal', provider: 'in_app' };
        }

        // Update MessageLog to SENT
        await messageLog.update({
          status: 'SENT',
          provider: dispatchResult?.provider,
          provider_id: dispatchResult?.providerId,
          sent_at: new Date()
        });

      } catch (dispatchError) {
        logger.error(`Dispatch failed for template ${template.id}: ${dispatchError.message}`);
        // Log the failure in MessageLog if we can
        await MessageLog.create({
          recipient_id: recipientId,
          channel: template.channel,
          event_type: eventType,
          template_id: template.id,
          content: 'Failed to render or dispatch',
          status: 'FAILED',
          error_message: dispatchError.message,
          failed_at: new Date()
        });
      }
    }

    logger.info(`Successfully processed communication job ${job.id}`);
  } catch (error) {
    logger.error(`Error processing communication job ${job.id}: ${error.message}`);
    throw error;
  }
};

module.exports = communicationProcessor;
