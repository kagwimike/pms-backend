const { Op } = require('sequelize');
const bcrypt = require('bcryptjs');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');
const ChatParticipant = require('../models/ChatParticipant');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Property = require('../models/Property');
const Unit = require('../models/Unit');
const MaintenanceRequest = require('../models/MaintenanceRequest');
const { getIo } = require('../services/communication/socket');
const { successResponse, errorResponse } = require('../utils/formatResponse');
const { getCursorPagination, getCursorPagingData } = require('../utils/pagination');

class CommunicationController {
  
  /**
   * Helper to ensure a Vendor has an associated User in accounts_user
   */
  static async ensureVendorUser(vendorId) {
    const vendor = await Vendor.findByPk(vendorId);
    if (!vendor) return null;
    if (vendor.user_id) {
      const user = await User.findByPk(vendor.user_id);
      if (user) return { vendor, user };
    }

    // Try finding by email
    let user = await User.findOne({ where: { email: vendor.email } });
    if (!user) {
      const tempPassword = await bcrypt.hash('vendor123', 10);
      const username = `vendor_${vendor.id}_${Math.floor(1000 + Math.random() * 9000)}`;
      const nameParts = (vendor.name || 'Vendor').trim().split(' ');
      const firstName = nameParts[0] || 'Vendor';
      const lastName = nameParts.slice(1).join(' ') || '';

      user = await User.create({
        username,
        email: vendor.email,
        password: tempPassword,
        role: 'VENDOR',
        first_name: firstName,
        last_name: lastName,
        phone: vendor.phone,
        is_active: true
      });
    }

    vendor.user_id = user.id;
    await vendor.save();
    return { vendor, user };
  }

  /**
   * GET /communication/contacts
   * Returns contacts (Vendors, Tenants, Owners/Staff) that can be messaged.
   */
  static async getContacts(req, res) {
    try {
      const { query: searchQuery, role: filterRole } = req.query;
      const currentUserId = req.user.id;

      // 1. Fetch Vendors
      const vendorWhere = {};
      if (searchQuery) {
        vendorWhere[Op.or] = [
          { name: { [Op.like]: `%${searchQuery}%` } },
          { email: { [Op.like]: `%${searchQuery}%` } },
          { phone: { [Op.like]: `%${searchQuery}%` } }
        ];
      }
      const vendors = await Vendor.findAll({
        where: vendorWhere,
        limit: 50,
        order: [['name', 'ASC']]
      });

      // Ensure vendor user_ids exist for easy chatting
      const vendorContacts = [];
      for (const v of vendors) {
        let uId = v.user_id;
        if (!uId) {
          try {
            const pair = await CommunicationController.ensureVendorUser(v.id);
            if (pair) uId = pair.user.id;
          } catch (e) {}
        }
        if (uId && uId !== currentUserId) {
          vendorContacts.push({
            id: uId,
            vendor_id: v.id,
            name: v.name,
            email: v.email,
            phone: v.phone,
            role: 'VENDOR',
            subtitle: 'Maintenance Vendor',
            profile_picture: null
          });
        }
      }

      // 2. Fetch Users (Tenants, Owners, Caretakers)
      const userWhere = {
        id: { [Op.ne]: currentUserId },
        is_active: true
      };
      if (filterRole) {
        userWhere.role = filterRole;
      }
      if (searchQuery) {
        userWhere[Op.or] = [
          { first_name: { [Op.like]: `%${searchQuery}%` } },
          { last_name: { [Op.like]: `%${searchQuery}%` } },
          { email: { [Op.like]: `%${searchQuery}%` } },
          { username: { [Op.like]: `%${searchQuery}%` } },
          { phone: { [Op.like]: `%${searchQuery}%` } }
        ];
      }

      const users = await User.findAll({
        where: userWhere,
        attributes: ['id', 'first_name', 'last_name', 'username', 'email', 'phone', 'role', 'profile_picture'],
        limit: 50,
        order: [['first_name', 'ASC']]
      });

      const userContacts = users
        .filter(u => !vendorContacts.some(vc => vc.id === u.id)) // Deduplicate if already present as vendor
        .map(u => {
          const fullName = `${u.first_name || ''} ${u.last_name || ''}`.trim() || u.username;
          let subtitle = u.role;
          if (u.role === 'TENANT') subtitle = 'Tenant';
          else if (u.role === 'OWNER') subtitle = 'Landlord / Property Owner';
          else if (u.role === 'CARETAKER') subtitle = 'Property Caretaker';
          else if (u.role === 'VENDOR') subtitle = 'Service Vendor';
          else if (u.role === 'ADMIN') subtitle = 'System Administrator';

          return {
            id: u.id,
            vendor_id: null,
            name: fullName,
            email: u.email,
            phone: u.phone,
            role: u.role,
            subtitle,
            profile_picture: u.profile_picture
          };
        });

      let allContacts = [];
      if (!filterRole || filterRole === 'VENDOR') {
        allContacts = allContacts.concat(vendorContacts);
      }
      allContacts = allContacts.concat(userContacts);

      return successResponse(res, allContacts, 'Contacts retrieved successfully');
    } catch (error) {
      console.error('Error fetching contacts:', error);
      return errorResponse(res, 'Failed to fetch contacts', 500, error);
    }
  }

  /**
   * GET /communication/sessions
   * Retrieves all chat sessions the user is involved in, with rich details for IG/FB Messenger styling.
   */
  static async getSessions(req, res) {
    try {
      const { role, id: userId } = req.user;
      const { limit, cursor } = req.query;

      // 1. Find all session IDs where user is a participant
      const participantRows = await ChatParticipant.findAll({
        where: { user_id: userId, is_active: true },
        attributes: ['session_id', 'last_read_at']
      });
      const sessionIds = participantRows.map(p => p.session_id);
      const lastReadMap = new Map(participantRows.map(p => [p.session_id, p.last_read_at]));

      const pagination = getCursorPagination(cursor, limit || 50);

      // Where condition: participant in session, OR creator, OR tenant
      const whereConditions = [];
      if (sessionIds.length > 0) {
        whereConditions.push({ id: { [Op.in]: sessionIds } });
      }
      whereConditions.push({ created_by: userId });
      if (role === 'TENANT') {
        whereConditions.push({ tenant_id: userId });
      }

      const whereClause = {
        ...pagination.where,
        [Op.or]: whereConditions
      };

      const sessions = await ChatSession.findAll({
        where: whereClause,
        include: [
          {
            model: ChatParticipant,
            as: 'participants',
            include: [{
              model: User,
              as: 'user',
              attributes: ['id', 'first_name', 'last_name', 'username', 'email', 'role', 'profile_picture']
            }]
          },
          { model: User, as: 'tenant', attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'profile_picture'] },
          { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'profile_picture'] },
          { model: Property, as: 'property', attributes: ['id', 'name'] },
          { model: Unit, as: 'unit', attributes: ['id', 'unit_number'] },
          { model: MaintenanceRequest, as: 'maintenance', attributes: ['id', 'title', 'status'] },
          {
            model: ChatMessage,
            as: 'messages',
            limit: 1,
            order: [['id', 'DESC']],
            include: [{ model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name', 'role'] }]
          }
        ],
        order: pagination.order || [['updated_at', 'DESC']],
        limit: pagination.limit
      });

      // Find all vendor profiles for participants who might be vendors
      const participantUserIds = [];
      sessions.forEach(s => {
        (s.participants || []).forEach(p => {
          if (p.user_id && !participantUserIds.includes(p.user_id)) {
            participantUserIds.push(p.user_id);
          }
        });
      });
      const vendorProfiles = await Vendor.findAll({
        where: { user_id: { [Op.in]: participantUserIds } },
        attributes: ['id', 'name', 'user_id', 'phone']
      });
      const vendorUserMap = new Map(vendorProfiles.map(v => [v.user_id, v]));

      const formattedSessions = await Promise.all(sessions.map(session => CommunicationController.formatSingleSession(session, userId, lastReadMap.get(session.id))));

      const paginatedData = getCursorPagingData(formattedSessions, pagination.limit);
      return successResponse(res, paginatedData.rows, "Chat sessions retrieved", 200, paginatedData.meta);
    } catch (error) {
      console.error('Error in getSessions:', error);
      return errorResponse(res, 'Failed to fetch chat sessions', 500, error);
    }
  }

  /**
   * Helper to format a single session consistently with other_participant, last_message, and unread flag
   */
  static async formatSingleSession(sessionInstance, userId, userLastRead) {
    const sessionData = sessionInstance.toJSON ? sessionInstance.toJSON() : sessionInstance;
    const participants = sessionData.participants || [];

    let otherUser = null;
    let otherVendor = null;

    const otherParticipant = participants.find(p => p.user_id !== userId);
    if (otherParticipant && otherParticipant.user) {
      otherUser = otherParticipant.user;
    } else if (sessionData.tenant && sessionData.tenant.id !== userId) {
      otherUser = sessionData.tenant;
    } else if (sessionData.creator && sessionData.creator.id !== userId) {
      otherUser = sessionData.creator;
    }

    if (otherUser) {
      try {
        otherVendor = await Vendor.findOne({ where: { user_id: otherUser.id } });
      } catch (e) {}
    }

    let displayName = 'Conversation';
    let displayRole = 'USER';
    let displaySubtitle = '';
    let displayAvatar = null;

    if (otherVendor) {
      displayName = otherVendor.name;
      displayRole = 'VENDOR';
      displaySubtitle = 'Vendor';
    } else if (otherUser) {
      displayName = `${otherUser.first_name || ''} ${otherUser.last_name || ''}`.trim() || otherUser.username || otherUser.email;
      displayRole = otherUser.role || 'USER';
      displayAvatar = otherUser.profile_picture;
      if (otherUser.role === 'TENANT') displaySubtitle = 'Tenant';
      else if (otherUser.role === 'OWNER') displaySubtitle = 'Landlord';
      else if (otherUser.role === 'CARETAKER') displaySubtitle = 'Caretaker';
      else if (otherUser.role === 'VENDOR') displaySubtitle = 'Vendor';
    } else if (sessionData.subject) {
      displayName = sessionData.subject;
    }

    const lastMsgObj = (sessionData.messages && sessionData.messages.length > 0) ? sessionData.messages[0] : null;
    let lastMessageText = '';
    let lastMessageTime = sessionData.updated_at || sessionData.created_at;
    let lastMessageSenderId = null;

    if (lastMsgObj) {
      lastMessageText = lastMsgObj.message;
      if (lastMsgObj.message_type === 'IMAGE') lastMessageText = '📷 Photo';
      else if (lastMsgObj.message_type === 'FILE') lastMessageText = '📎 Attachment';
      lastMessageTime = lastMsgObj.created_at;
      lastMessageSenderId = lastMsgObj.sender_id;
    }

    const isUnread = lastMsgObj && lastMsgObj.sender_id !== userId && (!userLastRead || new Date(userLastRead) < new Date(lastMsgObj.created_at));

    return {
      id: sessionData.id,
      status: sessionData.status,
      subject: sessionData.subject,
      tenant_id: sessionData.tenant_id,
      created_by: sessionData.created_by,
      created_at: sessionData.created_at,
      updated_at: sessionData.updated_at,
      property_id: sessionData.property_id,
      unit_id: sessionData.unit_id,
      maintenance_id: sessionData.maintenance_id,
      property: sessionData.property,
      unit: sessionData.unit,
      maintenance: sessionData.maintenance,
      tenant: sessionData.tenant,
      other_participant: otherUser ? {
        id: otherUser.id,
        name: displayName,
        role: displayRole,
        subtitle: displaySubtitle,
        avatar: displayAvatar,
        email: otherUser.email,
        phone: otherUser.phone || (otherVendor ? otherVendor.phone : null),
        vendor_id: otherVendor ? otherVendor.id : null
      } : {
        id: null,
        name: displayName,
        role: displayRole,
        subtitle: displaySubtitle,
        avatar: null
      },
      last_message: lastMsgObj ? {
        id: lastMsgObj.id,
        text: lastMessageText,
        time: lastMessageTime,
        sender_id: lastMessageSenderId,
        sender_name: lastMsgObj.sender ? `${lastMsgObj.sender.first_name || ''} ${lastMsgObj.sender.last_name || ''}`.trim() : null
      } : null,
      is_unread: isUnread
    };
  }

  /**
   * Helper to query a session with all standard includes for formatting
   */
  static async getHydratedSession(sessionId, userId) {
    const session = await ChatSession.findByPk(sessionId, {
      include: [
        {
          model: ChatParticipant,
          as: 'participants',
          include: [{
            model: User,
            as: 'user',
            attributes: ['id', 'first_name', 'last_name', 'username', 'email', 'role', 'profile_picture', 'phone']
          }]
        },
        { model: User, as: 'tenant', attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'profile_picture', 'phone'] },
        { model: User, as: 'creator', attributes: ['id', 'first_name', 'last_name', 'email', 'role', 'profile_picture', 'phone'] },
        { model: Property, as: 'property', attributes: ['id', 'name'] },
        { model: Unit, as: 'unit', attributes: ['id', 'unit_number'] },
        { model: MaintenanceRequest, as: 'maintenance', attributes: ['id', 'title', 'status'] },
        {
          model: ChatMessage,
          as: 'messages',
          limit: 1,
          order: [['id', 'DESC']],
          include: [{ model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name', 'role'] }]
        }
      ]
    });
    if (!session) return null;
    return await CommunicationController.formatSingleSession(session, userId);
  }

  /**
   * POST /communication/sessions
   * Create or start a chat session with ANY user (Vendor, Tenant, Landlord, Caretaker).
   * Automatically avoids duplicates for 1-on-1 direct conversations.
   */
  static async createSession(req, res) {
    try {
      const {
        target_user_id,
        vendor_id,
        tenant_id,
        subject,
        initial_message,
        property_id,
        unit_id,
        maintenance_id,
        invoice_id,
        inspection_id,
        entity_type,
        entity_id
      } = req.body;
      const { role, id: userId } = req.user;

      let recipientUserId = target_user_id;

      // If vendor_id provided instead of target_user_id, resolve vendor user
      if (vendor_id && !recipientUserId) {
        const pair = await CommunicationController.ensureVendorUser(vendor_id);
        if (!pair) return errorResponse(res, 'Vendor not found', 404);
        recipientUserId = pair.user.id;
      }

      // Legacy fallback: tenant_id
      if (tenant_id && !recipientUserId) {
        recipientUserId = tenant_id;
      }

      if (!recipientUserId && role === 'TENANT') {
        // If tenant didn't specify recipient, find owner/admin of property or caretaker
        const admins = await User.findAll({ where: { role: { [Op.in]: ['OWNER', 'ADMIN', 'CARETAKER'] } }, limit: 1 });
        if (admins.length > 0) recipientUserId = admins[0].id;
      }

      if (!recipientUserId) {
        return errorResponse(res, 'Recipient user must be specified (target_user_id or vendor_id)', 400);
      }

      // Check if 1-on-1 session already exists between userId and recipientUserId (for direct chat)
      if (!maintenance_id) {
        const userParticipantSessions = await ChatParticipant.findAll({
          where: { user_id: userId, is_active: true },
          attributes: ['session_id']
        });
        const userSessionIds = userParticipantSessions.map(p => p.session_id);

        if (userSessionIds.length > 0) {
          const matchParticipant = await ChatParticipant.findOne({
            where: {
              session_id: { [Op.in]: userSessionIds },
              user_id: recipientUserId,
              is_active: true
            }
          });

          if (matchParticipant) {
            const existingSession = await ChatSession.findOne({
              where: { id: matchParticipant.session_id, maintenance_id: null }
            });

            if (existingSession) {
              // Send initial message if provided
              if (initial_message && initial_message.trim()) {
                const msg = await ChatMessage.create({
                  session_id: existingSession.id,
                  sender_id: userId,
                  message: initial_message.trim(),
                  message_type: 'TEXT'
                });
                await existingSession.update({ updated_at: new Date() });

                try {
                  const io = getIo();
                  const fullMessage = await ChatMessage.findByPk(msg.id, {
                    include: [{ model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name', 'role', 'profile_picture'] }]
                  });
                  io.to(`session_${existingSession.id}`).emit('receive_message', fullMessage);
                  io.to(`user_${recipientUserId}`).emit('receive_message', fullMessage);
                } catch (e) {}
              }

              const hydrated = await CommunicationController.getHydratedSession(existingSession.id, userId);
              return successResponse(res, hydrated || existingSession, "Chat session retrieved", 200);
            }
          }
        }
      }

      // Determine tenant_id column value (nullable in database)
      const recipientUser = await User.findByPk(recipientUserId);
      let sessionTenantId = null;
      if (role === 'TENANT') sessionTenantId = userId;
      else if (recipientUser && recipientUser.role === 'TENANT') sessionTenantId = recipientUserId;

      const session = await ChatSession.create({
        tenant_id: sessionTenantId,
        subject: subject || (recipientUser ? `Chat with ${recipientUser.first_name || recipientUser.username}` : 'Direct Message'),
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

      // Add recipient as participant
      if (recipientUserId !== userId) {
        await ChatParticipant.create({
          session_id: session.id,
          user_id: recipientUserId,
          role: recipientUser ? recipientUser.role : 'USER'
        });
      }

      // Send initial message if provided
      if (initial_message && initial_message.trim()) {
        const msg = await ChatMessage.create({
          session_id: session.id,
          sender_id: userId,
          message: initial_message.trim(),
          message_type: 'TEXT'
        });

        try {
          const io = getIo();
          const fullMessage = await ChatMessage.findByPk(msg.id, {
            include: [{ model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name', 'role', 'profile_picture'] }]
          });
          io.to(`session_${session.id}`).emit('receive_message', fullMessage);
          io.to(`user_${recipientUserId}`).emit('receive_message', fullMessage);
        } catch (e) {}
      }

      const hydrated = await CommunicationController.getHydratedSession(session.id, userId);
      return successResponse(res, hydrated || session, "Chat session created", 201);
    } catch (error) {
      console.error('Error creating chat session:', error);
      return errorResponse(res, 'Failed to create chat session', 500, error);
    }
  }

  /**
   * GET /communication/sessions/maintenance/:maintenanceId
   */
  static async getSessionByMaintenance(req, res) {
    try {
      const { maintenanceId } = req.params;
      const { role, id: userId } = req.user;
      
      let session = await ChatSession.findOne({
        where: { maintenance_id: maintenanceId }
      });
      
      const maintenance = await MaintenanceRequest.findByPk(maintenanceId);
      if (!maintenance) return errorResponse(res, 'Maintenance request not found', 404);

      // If no session exists for this maintenance ticket, auto-create one!
      if (!session) {
        session = await ChatSession.create({
          maintenance_id: maintenanceId,
          property_id: maintenance.property_id || null,
          unit_id: maintenance.unit_id || null,
          tenant_id: maintenance.tenant_id || null,
          subject: `Ticket #${maintenance.id}: ${maintenance.title || 'Maintenance'}`,
          status: 'OPEN',
          created_by: userId
        });

        // Add tenant participant
        if (maintenance.tenant_id) {
          try {
            await ChatParticipant.findOrCreate({
              where: { session_id: session.id, user_id: maintenance.tenant_id },
              defaults: { role: 'TENANT' }
            });
          } catch (pe) {
            console.warn('Could not add tenant participant to ticket chat:', pe.message);
          }
        }
      }

      // Ensure caller is a participant
      try {
        await ChatParticipant.findOrCreate({
          where: { session_id: session.id, user_id: userId },
          defaults: { role: role }
        });
      } catch (pe) {
        console.warn('Could not add caller participant to ticket chat:', pe.message);
      }

      // If assigned vendor exists, ensure vendor user is participant
      if (maintenance.assigned_vendor_id) {
        try {
          const pair = await CommunicationController.ensureVendorUser(maintenance.assigned_vendor_id);
          if (pair && pair.user) {
            await ChatParticipant.findOrCreate({
              where: { session_id: session.id, user_id: pair.user.id },
              defaults: { role: 'VENDOR' }
            });
          }
        } catch (ve) {
          console.warn('Could not add vendor participant to ticket chat:', ve.message);
        }
      }

      let hydrated = null;
      try {
        hydrated = await CommunicationController.getHydratedSession(session.id, userId);
      } catch (he) {
        console.warn('Could not hydrate session details:', he.message);
      }

      return successResponse(res, hydrated || session, "Session retrieved", 200);
    } catch (error) {
      console.error('Error in getSessionByMaintenance:', error);
      return errorResponse(res, `Failed to fetch session: ${error.message}`, 500, error);
    }
  }

  /**
   * GET /communication/sessions/:sessionId/messages
   */
  static async getMessages(req, res) {
    try {
      const { sessionId } = req.params;
      const { limit, cursor } = req.query;
      const userId = req.user.id;
      const userRole = req.user.role;

      const session = await ChatSession.findByPk(sessionId);
      if (!session) return errorResponse(res, 'Chat session not found', 404);

      // Verify participant authorization
      const participant = await ChatParticipant.findOne({
        where: { session_id: sessionId, user_id: userId, is_active: true }
      });

      let isAuthorized = !!participant || userRole === 'ADMIN' || userRole === 'OWNER' || session.created_by === userId || session.tenant_id === userId;

      // If vendor not in participants yet, check if assigned to this maintenance ticket
      if (!isAuthorized && userRole === 'VENDOR' && session.maintenance_id) {
        const vendor = await Vendor.findOne({ where: { user_id: userId } });
        if (vendor) {
          const reqMatch = await MaintenanceRequest.findOne({ where: { id: session.maintenance_id, assigned_vendor_id: vendor.id }});
          if (reqMatch) isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        return errorResponse(res, 'Forbidden', 403);
      }

      // Automatically add/reactivate participant if authorized
      if (!participant) {
        await ChatParticipant.create({ session_id: sessionId, user_id: userId, role: userRole });
      } else {
        // Update read receipt
        await participant.update({ last_read_at: new Date() });
      }

      const pagination = getCursorPagination(cursor, limit || 50);

      const messages = await ChatMessage.findAll({
        where: { session_id: sessionId, ...pagination.where },
        include: [
          { model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name', 'role', 'profile_picture'] }
        ],
        order: [['id', 'DESC']],
        limit: pagination.limit
      });

      const paginatedData = getCursorPagingData(messages, pagination.limit);
      paginatedData.rows = paginatedData.rows.reverse();

      return successResponse(res, paginatedData.rows, "Messages retrieved", 200, paginatedData.meta);
    } catch (error) {
      console.error('Error in getMessages:', error);
      return errorResponse(res, 'Failed to fetch messages', 500, error);
    }
  }

  /**
   * POST /communication/sessions/:sessionId/messages
   */
  static async sendMessage(req, res) {
    try {
      const { sessionId } = req.params;
      const { message, message_type, media_url, reply_to_message_id } = req.body;
      const sender_id = req.user.id;
      const userRole = req.user.role;

      const session = await ChatSession.findByPk(sessionId);
      if (!session) return errorResponse(res, 'Chat session not found', 404);

      // Verify participant authorization
      const participant = await ChatParticipant.findOne({
        where: { session_id: sessionId, user_id: sender_id, is_active: true }
      });

      let isAuthorized = !!participant || userRole === 'ADMIN' || userRole === 'OWNER' || session.created_by === sender_id || session.tenant_id === sender_id;

      if (!isAuthorized && userRole === 'VENDOR' && session.maintenance_id) {
        const vendor = await Vendor.findOne({ where: { user_id: sender_id } });
        if (vendor) {
          const reqMatch = await MaintenanceRequest.findOne({ where: { id: session.maintenance_id, assigned_vendor_id: vendor.id }});
          if (reqMatch) isAuthorized = true;
        }
      }

      if (!isAuthorized) {
        return errorResponse(res, 'Forbidden', 403);
      }

      if (!participant) {
        await ChatParticipant.create({ session_id: sessionId, user_id: sender_id, role: userRole });
      }

      const chatMessage = await ChatMessage.create({
        session_id: sessionId,
        sender_id,
        message: message || '',
        message_type: message_type || 'TEXT',
        media_url: media_url || null,
        reply_to_message_id: reply_to_message_id || null
      });

      await session.update({ updated_at: new Date() });

      const fullMessage = await ChatMessage.findByPk(chatMessage.id, {
        include: [{ model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name', 'role', 'profile_picture'] }]
      });

      // Broadcast via socket to room and all participant user channels
      try {
        const io = getIo();
        io.to(`session_${sessionId}`).emit('receive_message', fullMessage);

        const allParticipants = await ChatParticipant.findAll({ where: { session_id: sessionId } });
        allParticipants.forEach(p => {
          if (p.user_id !== sender_id) {
            io.to(`user_${p.user_id}`).emit('receive_message', fullMessage);
          }
        });
      } catch (err) {}

      return successResponse(res, fullMessage, "Message sent", 201);
    } catch (error) {
      console.error('Error in sendMessage:', error);
      return errorResponse(res, 'Failed to send message', 500, error);
    }
  }

  /**
   * POST /communication/messages/:messageId/reaction
   * Instagram / Facebook style emoji reaction (❤️, 👍, 😂, 🔥, etc.)
   */
  static async reactToMessage(req, res) {
    try {
      const { messageId } = req.params;
      const { reaction } = req.body;
      const userId = req.user.id;

      const message = await ChatMessage.findByPk(messageId);
      if (!message) return errorResponse(res, 'Message not found', 404);

      // Toggle reaction if same emoji sent again
      const newReaction = (message.reaction === reaction) ? null : reaction;
      await message.update({ reaction: newReaction });

      try {
        const io = getIo();
        io.to(`session_${message.session_id}`).emit('message_reaction', {
          messageId: message.id,
          sessionId: message.session_id,
          reaction: newReaction,
          userId
        });
      } catch (e) {}

      return successResponse(res, { id: message.id, reaction: newReaction }, 'Reaction updated');
    } catch (error) {
      console.error('Error reacting to message:', error);
      return errorResponse(res, 'Failed to update reaction', 500, error);
    }
  }

  /**
   * POST /communication/upload
   * Image/media attachment upload for chat
   */
  static async uploadAttachment(req, res) {
    try {
      if (!req.file) {
        return errorResponse(res, 'No file uploaded', 400);
      }
      const fileUrl = `/property_images/${req.file.filename}`;
      return successResponse(res, {
        url: fileUrl,
        filename: req.file.filename,
        mimetype: req.file.mimetype,
        size: req.file.size
      }, 'File uploaded successfully', 201);
    } catch (error) {
      console.error('Error uploading chat attachment:', error);
      return errorResponse(res, 'Failed to upload attachment', 500, error);
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
