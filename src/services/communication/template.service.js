const Handlebars = require('handlebars');
const NotificationTemplate = require('../../models/NotificationTemplate');
const logger = require('../../utils/logger');

class TemplateEngine {
  
  /**
   * Fetch a template from the database and compile it with variables.
   * @param {string} event_type e.g. 'INVOICE_CREATED'
   * @param {string} channel e.g. 'EMAIL', 'SMS'
   * @param {Object} context Variables to inject (e.g. { tenantName: 'John', amount: 500 })
   * @returns {Promise<{content: string, subject: string, template_id: number}>}
   */
  static async render(event_type, channel, context) {
    try {
      const template = await NotificationTemplate.findOne({
        where: { event_type, channel, is_active: true }
      });

      if (!template) {
        // Fallback or generic message
        logger.warn(`No active template found for ${event_type} on ${channel}`);
        return null;
      }

      const compiledBody = Handlebars.compile(template.body_template);
      const content = compiledBody(context);

      let subject = null;
      if (template.subject_template) {
        const compiledSubject = Handlebars.compile(template.subject_template);
        subject = compiledSubject(context);
      }

      return {
        content,
        subject,
        template_id: template.id
      };
    } catch (error) {
      logger.error(`TemplateEngine render error: ${error.message}`);
      return null;
    }
  }
}

module.exports = TemplateEngine;
