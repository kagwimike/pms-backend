const Announcement = require('../../models/Announcement');
const User = require('../../models/User');
const Lease = require('../../models/Lease');
const OutboxService = require('./outbox.service');
const logger = require('../../utils/logger');
const { Op } = require('sequelize');

class BroadcastService {
  
  static async sendAnnouncement(announcementId) {
    try {
      const announcement = await Announcement.findByPk(announcementId);
      if (!announcement || announcement.status !== 'QUEUED') return;
      
      await announcement.update({ status: 'SENDING' });

      let usersToNotify = [];

      if (announcement.target_audience === 'ALL') {
        usersToNotify = await User.findAll({ where: { is_active: true } });
      } else if (announcement.target_audience === 'TENANTS') {
        usersToNotify = await User.findAll({ where: { role: 'TENANT', is_active: true } });
      } else if (announcement.target_audience === 'OWNERS') {
        usersToNotify = await User.findAll({ where: { role: 'OWNER', is_active: true } });
      } else if (announcement.target_audience === 'VENDORS') {
        usersToNotify = await User.findAll({ where: { role: 'VENDOR', is_active: true } });
      } else if (announcement.target_audience === 'SPECIFIC_PROPERTY' && announcement.target_property_id) {
        // Find tenants in this property via active leases
        const leases = await Lease.findAll({ 
          where: { property_id: announcement.target_property_id, status: 'ACTIVE' },
          include: [{ model: User, as: 'tenant', required: true }]
        });
        usersToNotify = leases.map(l => l.tenant);
        
        // Ensure unique
        const uniqueIds = new Set();
        usersToNotify = usersToNotify.filter(u => {
          if (uniqueIds.has(u.id)) return false;
          uniqueIds.add(u.id);
          return true;
        });
      }

      logger.info(`Broadcasting announcement ${announcementId} to ${usersToNotify.length} users.`);

      for (const user of usersToNotify) {
        const channels = ['IN_APP'];
        if (announcement.send_via_email) channels.push('EMAIL');
        if (announcement.send_via_sms) channels.push('SMS');

        for (const channel of channels) {
          // Direct Outbox queueing for each channel
          await OutboxService.queueCommunication({
            recipient_id: user.id,
            channel: channel,
            template_event_type: 'ANNOUNCEMENT_CREATED',
            context: {
              title: announcement.title,
              content: announcement.content,
              recipientName: user.first_name || 'User'
            },
            entity_type: 'ANNOUNCEMENT',
            entity_id: announcement.id,
            phone: user.phone,
            email: user.email
          });
        }
      }

      await announcement.update({ status: 'SENT', sent_at: new Date() });

    } catch (error) {
      logger.error('BroadcastService error:', error);
      await Announcement.update({ status: 'DRAFT' }, { where: { id: announcementId } });
    }
  }
}

module.exports = BroadcastService;
