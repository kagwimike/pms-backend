const { Op } = require('sequelize');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const User = require('../models/User');
const { getIo } = require('../services/communication/socket');

/**
 * Controller for Communication API
 */
class CommunicationController {
  
  /**
   * Fetch all chat sessions for the logged-in user.
   * Tenants see their own sessions. Admins/Owners see all.
   */
  static async getSessions(req, res) {
    try {
      const { role, id: userId } = req.user;
      
      const whereClause = {};
      if (role === 'TENANT') {
        whereClause.tenant_id = userId;
      }
      // Assuming owners only see sessions related to their properties, but for simplicity we'll allow all for now.
      
      const includeOptions = [
        { model: User, as: 'tenant', attributes: ['id', 'first_name', 'last_name', 'email', 'profile_picture'] }
      ];

      if (role === 'VENDOR') {
        const Vendor = require('../models/Vendor');
        const MaintenanceRequest = require('../models/MaintenanceRequest');
        const vendor = await Vendor.findOne({ where: { user_id: userId } });
        if (vendor) {
          includeOptions.push({
            model: MaintenanceRequest,
            as: 'maintenance',
            where: { assigned_vendor_id: vendor.id },
            required: true
          });
        }
      }

      const sessions = await ChatSession.findAll({
        where: whereClause,
        include: includeOptions,
        order: [['updated_at', 'DESC']]
      });

      res.status(200).json(sessions);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch chat sessions', error: error.message });
    }
  }

  /**
   * Start a new chat session (e.g. Tenant opening a ticket or Manager contacting tenant)
   */
  static async createSession(req, res) {
    try {
      const { tenant_id, subject, property_id, unit_id, maintenance_id } = req.body;
      const { role, id: userId } = req.user;

      // Ensure tenant can only create for themselves
      const actualTenantId = role === 'TENANT' ? userId : tenant_id;

      const session = await ChatSession.create({
        tenant_id: actualTenantId,
        subject,
        property_id,
        unit_id,
        maintenance_id,
        status: 'OPEN'
      });

      res.status(201).json(session);
    } catch (error) {
      res.status(500).json({ message: 'Failed to create chat session', error: error.message });
    }
  }

  /**
   * Fetch session by maintenance_id
   */
  static async getSessionByMaintenance(req, res) {
    try {
      const { maintenanceId } = req.params;
      const { role, id: userId } = req.user;
      
      const session = await ChatSession.findOne({
        where: { maintenance_id: maintenanceId }
      });
      
      if (!session) return res.status(404).json({ message: 'Session not found' });
      
      // Basic security
      if (role === 'TENANT' && session.tenant_id !== userId) return res.status(403).json({ message: 'Forbidden' });
      if (role === 'VENDOR') {
        const Vendor = require('../models/Vendor');
        const MaintenanceRequest = require('../models/MaintenanceRequest');
        const vendor = await Vendor.findOne({ where: { user_id: userId } });
        if (!vendor) return res.status(403).json({ message: 'Forbidden' });
        const reqMatch = await MaintenanceRequest.findOne({ where: { id: maintenanceId, assigned_vendor_id: vendor.id }});
        if (!reqMatch) return res.status(403).json({ message: 'Forbidden' });
      }

      res.status(200).json(session);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch session', error: error.message });
    }
  }

  /**
   * Fetch messages for a specific session
   */
  static async getMessages(req, res) {
    try {
      const { sessionId } = req.params;

      const session = await ChatSession.findByPk(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Chat session not found' });
      }

      // Security Check: Tenant can only view their own sessions
      if (req.user.role === 'TENANT' && session.tenant_id !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      if (req.user.role === 'VENDOR') {
        const Vendor = require('../models/Vendor');
        const MaintenanceRequest = require('../models/MaintenanceRequest');
        const vendor = await Vendor.findOne({ where: { user_id: req.user.id } });
        if (!vendor) return res.status(403).json({ message: 'Forbidden' });
        
        if (session.maintenance_id) {
          const reqMatch = await MaintenanceRequest.findOne({ where: { id: session.maintenance_id, assigned_vendor_id: vendor.id }});
          if (!reqMatch) return res.status(403).json({ message: 'Forbidden' });
        } else {
          return res.status(403).json({ message: 'Forbidden' });
        }
      }

      const messages = await ChatMessage.findAll({
        where: { session_id: sessionId },
        include: [
          { model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name', 'role', 'profile_picture'] }
        ],
        order: [['created_at', 'ASC']]
      });

      res.status(200).json(messages);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch messages', error: error.message });
    }
  }

  /**
   * Send a message via REST API (also broadcasts via Socket.IO)
   * This is useful for file attachments or clients that don't emit via socket
   */
  static async sendMessage(req, res) {
    try {
      const { sessionId } = req.params;
      const { message, message_type } = req.body;
      const sender_id = req.user.id;

      const session = await ChatSession.findByPk(sessionId);
      if (!session) {
        return res.status(404).json({ message: 'Chat session not found' });
      }

      // Security Check: Tenant can only view their own sessions
      if (req.user.role === 'TENANT' && session.tenant_id !== req.user.id) {
        return res.status(403).json({ message: 'Forbidden' });
      }
      if (req.user.role === 'VENDOR') {
        const Vendor = require('../models/Vendor');
        const MaintenanceRequest = require('../models/MaintenanceRequest');
        const vendor = await Vendor.findOne({ where: { user_id: req.user.id } });
        if (!vendor) return res.status(403).json({ message: 'Forbidden' });
        
        if (session.maintenance_id) {
          const reqMatch = await MaintenanceRequest.findOne({ where: { id: session.maintenance_id, assigned_vendor_id: vendor.id }});
          if (!reqMatch) return res.status(403).json({ message: 'Forbidden' });
        } else {
          return res.status(403).json({ message: 'Forbidden' });
        }
      }

      const chatMessage = await ChatMessage.create({
        session_id: sessionId,
        sender_id,
        message,
        message_type: message_type || 'TEXT'
      });

      // Update the session's updated_at timestamp to bubble it up in lists
      await session.update({ updated_at: new Date() });

      // Fetch message with sender info to emit
      const fullMessage = await ChatMessage.findByPk(chatMessage.id, {
        include: [{ model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name', 'role', 'profile_picture'] }]
      });

      // Broadcast via Socket.IO
      try {
        const io = getIo();
        io.to(`session_${sessionId}`).emit('receive_message', fullMessage);
      } catch (err) {
         // socket might not be initialized yet during testing
      }

      res.status(201).json(fullMessage);
    } catch (error) {
      res.status(500).json({ message: 'Failed to send message', error: error.message });
    }
  }
}

module.exports = CommunicationController;
