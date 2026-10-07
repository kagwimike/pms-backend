const { sequelize } = require('../config/db');
const NotificationTemplate = require('../models/NotificationTemplate');

const seedTemplates = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected...');

    const templates = [
      {
        event_type: 'PAYMENT_RECEIVED',
        channel: 'SMS',
        name: 'Payment Receipt (SMS)',
        body: 'Dear {{tenant_name}}, we have received your payment of {{payment_amount}} for ref {{payment_reference}}. Thank you! - PMS Pro',
        is_active: true,
      },
      {
        event_type: 'PAYMENT_RECEIVED',
        channel: 'EMAIL',
        name: 'Payment Receipt (Email)',
        subject: 'Payment Received - {{payment_reference}}',
        body: '<p>Dear {{tenant_name}},</p><p>We have successfully received your payment of <strong>{{payment_amount}}</strong>.</p><p>Thank you for your prompt payment.</p><p>- PMS Pro Management</p>',
        is_active: true,
      },
      {
        event_type: 'INVOICE_GENERATED',
        channel: 'IN_APP',
        name: 'New Invoice Notification',
        body: 'A new invoice #{{invoice_number}} of {{amount}} is due on {{due_date}}.',
        is_active: true,
      },
      {
        event_type: 'MAINTENANCE_UPDATED',
        channel: 'PUSH',
        name: 'Maintenance Update (Push)',
        subject: 'Maintenance Request Updated',
        body: 'Your request "{{maintenance_title}}" is now {{maintenance_status}}.',
        is_active: true,
      }
    ];

    for (const template of templates) {
      const [record, created] = await NotificationTemplate.findOrCreate({
        where: { event_type: template.event_type, channel: template.channel },
        defaults: template,
      });
      if (created) {
        console.log(`Created template: ${template.name}`);
      } else {
        console.log(`Template already exists: ${template.name}`);
      }
    }

    console.log('Template seeding complete.');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding templates:', error);
    process.exit(1);
  }
};

seedTemplates();
