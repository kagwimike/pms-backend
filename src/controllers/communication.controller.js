const { Op } = require('sequelize');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const ChatParticipant = require('../models/ChatParticipant');
const User = require('../models/User');
const { getIo } = require('../services/communication/socket');
const { successResponse, errorResponse } = require('../utils/formatResponse');
const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');

class CommunicationController {
  
  static async getSessions(req, res) {
    try {
      const { role, id: userId } = req.user;
      const { limit, cursor } = req.query;

      // Ensure user is a participant
      const participantSessions = await ChatParticipant.findAll({
        where: { user_id: userId, is_active: true },
        attributes: ['session_id']
      });
      const sessionIds = participantSessions.map(p => p.session_id);

      const pagination = getCursorPagination(cursor, limit || 20);

      // Filter to sessions the user is participating in
      const whereClause = {
        ...pagination.where,
        id: { [Op.in]: sessionIds.length ? sessionIds : [] }
      };

      // Fallback: If tenant, also include sessions where tenant_id = userId
      if (role === 'TENANT') {
        whereClause[Op.or] = [
          { id: { [Op.in]: sessionIds } },
          { tenant_id: userId }
        ];
        delete whereClause.id;
      }

      const includeOptions = [
        { model: User, as: 'tenant', attributes: ['id', 'first_name', 'last_name', 'email', 'profile_picture'] }
      ];

      const sessions = await ChatSession.findAll({
        where: whereClause,
        include: includeOptions,
        order: pagination.order,
        limit: pagination.limit
      });

      const paginatedData = getCursorPagingData(sessions, pagination.limit);
      
      return successResponse(res, paginatedData.rows, "Chat sessions retrieved", 200, paginatedData.meta);
    } catch (error) {
      return errorResponse(res, 'Failed to fetch chat sessions', 500, error);
    }
  }

  static async createSession(req, res) {
    try {
      const { tenant_id, subject, property_id, unit_id, maintenance_id, invoice_id, inspection_id, entity_type, entity_id } = req.body;
      const { role, id: userId } = req.user;

      const actualTenantId = role === 'TENANT' ? userId : tenant_id;

      const session = await ChatSession.create({
        tenant_id: actualTenantId,
        subject,
        property_id,
        unit_id,
        maintenance_id,
        invoice_id,
        inspection_id,
        entity_type,
        entity_id,
        created_by: userId,
        status: 'OPEN'
      });

      // Add creator as participant
      await ChatParticipant.create({
        session_id: session.id,
        user_id: userId,
        role: role
      });

      // If created by manager/vendor for a tenant, add tenant
      if (actualTenantId && actualTenantId !== userId) {
        await ChatParticipant.create({
          session_id: session.id,
          user_id: actualTenantId,
          role: 'TENANT'
        });
      }

      return successResponse(res, session, "Chat session created", 201);
    } catch (error) {
      return errorResponse(res, 'Failed to create chat session', 500, error);
    }
  }

  static async getSessionByMaintenance(req, res) {
    try {
      const { maintenanceId } = req.params;
      const { role, id: userId } = req.user;
      
      const session = await ChatSession.findOne({
        where: { maintenance_id: maintenanceId }
      });
      
      if (!session) return errorResponse(res, 'Session not found', 404);
      
      if (role === 'TENANT' && session.tenant_id !== userId) return errorResponse(res, 'Forbidden', 403);
      if (role === 'VENDOR') {
        const Vendor = require('../models/Vendor');
        const MaintenanceRequest = require('../models/MaintenanceRequest');
        const vendor = await Vendor.findOne({ where: { user_id: userId } });
        if (!vendor) return errorResponse(res, 'Forbidden', 403);
        const reqMatch = await MaintenanceRequest.findOne({ where: { id: maintenanceId, assigned_vendor_id: vendor.id }});
        if (!reqMatch) return errorResponse(res, 'Forbidden', 403);
      }

      return successResponse(res, session, "Session retrieved", 200);
    } catch (error) {
      return errorResponse(res, 'Failed to fetch session', 500, error);
    }
  }

  static async getMessages(req, res) {
    try {
      const { sessionId } = req.params;
      const { limit, cursor } = req.query;

      const session = await ChatSession.findByPk(sessionId);
      if (!session) return errorResponse(res, 'Chat session not found', 404);

      // Simple Auth
      if (req.user.role === 'TENANT' && session.tenant_id !== req.user.id) {
        return errorResponse(res, 'Forbidden', 403);
      }
      if (req.user.role === 'VENDOR') {
        const Vendor = require('../models/Vendor');
        const MaintenanceRequest = require('../models/MaintenanceRequest');
        const vendor = await Vendor.findOne({ where: { user_id: req.user.id } });
        if (!vendor) return errorResponse(res, 'Forbidden', 403);
        
        if (session.maintenance_id) {
          const reqMatch = await MaintenanceRequest.findOne({ where: { id: session.maintenance_id, assigned_vendor_id: vendor.id }});
          if (!reqMatch) return errorResponse(res, 'Forbidden', 403);
        } else {
          return errorResponse(res, 'Forbidden', 403);
        }
      }

      const pagination = getCursorPagination(cursor, limit || 50);
      
      // Override order so newest are returned, but we might want to return them ASC for the chat UI to display properly
      // Actually we'll fetch DESC to get the latest 50 before the cursor, then reverse the rows
      const messages = await ChatMessage.findAll({
        where: { session_id: sessionId, ...pagination.where },
        include: [
          { model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name', 'role', 'profile_picture'] }
        ],
        order: [['id', 'DESC']],
        limit: pagination.limit
      });

      const paginatedData = getCursorPagingData(messages, pagination.limit);
      
      // Reverse so they are in chronological order for UI
      paginatedData.rows = paginatedData.rows.reverse();

      return successResponse(res, paginatedData.rows, "Messages retrieved", 200, paginatedData.meta);
    } catch (error) {
      return errorResponse(res, 'Failed to fetch messages', 500, error);
    }
  }

  static async sendMessage(req, res) {
    try {
      const { sessionId } = req.params;
      const { message, message_type, reply_to_message_id } = req.body;
      const sender_id = req.user.id;

      const session = await ChatSession.findByPk(sessionId);
      if (!session) return errorResponse(res, 'Chat session not found', 404);

      // Auth
      if (req.user.role === 'TENANT' && session.tenant_id !== req.user.id) {
        return errorResponse(res, 'Forbidden', 403);
      }
      if (req.user.role === 'VENDOR') {
        const Vendor = require('../models/Vendor');
        const MaintenanceRequest = require('../models/MaintenanceRequest');
        const vendor = await Vendor.findOne({ where: { user_id: req.user.id } });
        if (!vendor) return errorResponse(res, 'Forbidden', 403);
        
        if (session.maintenance_id) {
          const reqMatch = await MaintenanceRequest.findOne({ where: { id: session.maintenance_id, assigned_vendor_id: vendor.id }});
          if (!reqMatch) return errorResponse(res, 'Forbidden', 403);
        } else {
          return errorResponse(res, 'Forbidden', 403);
        }
      }

      const chatMessage = await ChatMessage.create({
        session_id: sessionId,
        sender_id,
        message,
        message_type: message_type || 'TEXT',
        reply_to_message_id
      });

      await session.update({ updated_at: new Date() });

      const fullMessage = await ChatMessage.findByPk(chatMessage.id, {
        include: [{ model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name', 'role', 'profile_picture'] }]
      });

      try {
        const io = getIo();
        io.to(`session_${sessionId}`).emit('receive_message', fullMessage);
      } catch (err) {}

      return successResponse(res, fullMessage, "Message sent", 201);
    } catch (error) {
      return errorResponse(res, 'Failed to send message', 500, error);
    }
  }

  static async createAnnouncement(req, res) {
    try {
      if (req.user.role !== 'ADMIN' && req.user.role !== 'OWNER' && req.user.role !== 'CARETAKER') {
        return errorResponse(res, 'Forbidden', 403);
      }
      
      const { title, content, target_audience, target_property_id, send_via_email, send_via_sms, send_now } = req.body;
      
      const Announcement = require('../models/Announcement');
      const BroadcastService = require('../services/communication/broadcast.service');

      const announcement = await Announcement.create({
        title,
        content,
        target_audience: target_audience || 'ALL',
        target_property_id,
        created_by: req.user.id,
        send_via_email: !!send_via_email,
        send_via_sms: !!send_via_sms,
        status: send_now ? 'QUEUED' : 'DRAFT'
      });

      if (send_now) {
        // Run in background instead of blocking the request
        BroadcastService.sendAnnouncement(announcement.id).catch(err => console.error(err));
      }

      return successResponse(res, announcement, "Announcement created", 201);
    } catch (error) {
      return errorResponse(res, 'Failed to create announcement', 500, error);
    }
  }

  static async getAnnouncements(req, res) {
    try {
      const Announcement = require('../models/Announcement');
      const { limit, cursor } = req.query;
      const pagination = getCursorPagination(cursor, limit || 20);

      // Simple fetch for admin panel, can be filtered by role later
      const announcements = await Announcement.findAll({
        where: pagination.where,
        order: pagination.order,
        limit: pagination.limit
      });

      const paginatedData = getCursorPagingData(announcements, pagination.limit);
      return successResponse(res, paginatedData.rows, "Announcements retrieved", 200, paginatedData.meta);
    } catch (error) {
      return errorResponse(res, 'Failed to fetch announcements', 500, error);
    }
  }
}

module.exports = CommunicationController;
