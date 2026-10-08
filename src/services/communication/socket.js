const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const logger = require('../../utils/logger');
const CommunicationDevice = require('../../models/CommunicationDevice');
const ChatParticipant = require('../../models/ChatParticipant');
const ChatMessage = require('../../models/ChatMessage');
const ChatSession = require('../../models/ChatSession');
const User = require('../../models/User');

let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) return next(new Error('Authentication error: Token missing'));

    try {
      const decoded = jwt.verify(token, env.jwtSecret);
      socket.user = { ...decoded, id: decoded.sub };
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user.id;
    const platform = socket.handshake.query?.platform || 'WEB';
    const deviceId = socket.handshake.query?.deviceId || 'UNKNOWN';

    logger.info(`User ${userId} connected via socket ${socket.id} on ${platform}`);
    socket.join(`user_${userId}`);

    try {
      // Upsert device
      const [device, created] = await CommunicationDevice.findOrCreate({
        where: { user_id: userId, device_id: deviceId, platform },
        defaults: { socket_id: socket.id, is_online: true }
      });
      if (!created) {
        await device.update({ socket_id: socket.id, is_online: true, last_seen_at: new Date() });
      }

      // Automatically join rooms for active chat sessions
      const participants = await ChatParticipant.findAll({ where: { user_id: userId, is_active: true } });
      participants.forEach(p => {
        socket.join(`session_${p.session_id}`);
      });
      
      // Fallback for legacy tenant_id without ChatParticipant
      if (socket.user.role === 'TENANT') {
        const sessions = await ChatSession.findAll({ where: { tenant_id: userId, status: 'OPEN' } });
        sessions.forEach(s => socket.join(`session_${s.id}`));
      }

    } catch (err) {
      logger.error('Socket init error:', err);
    }

    // Join specific session manually (e.g. user opens a specific chat screen)
    socket.on('join_session', (sessionId) => {
      socket.join(`session_${sessionId}`);
    });

    socket.on('leave_session', (sessionId) => {
      socket.leave(`session_${sessionId}`);
    });

    // Typing Indicators
    socket.on('typing', (data) => {
      socket.to(`session_${data.sessionId}`).emit('user_typing', { userId: socket.user.id, sessionId: data.sessionId });
    });

    socket.on('stop_typing', (data) => {
      socket.to(`session_${data.sessionId}`).emit('user_stop_typing', { userId: socket.user.id, sessionId: data.sessionId });
    });

    // Message Status Updates (Delivery / Read Receipts)
    socket.on('message_read', async (data) => {
      try {
        const { messageId, sessionId } = data;
        // Optionally update ChatParticipant.last_read_at
        await ChatParticipant.update(
          { last_read_at: new Date() },
          { where: { session_id: sessionId, user_id: socket.user.id } }
        );
        socket.to(`session_${sessionId}`).emit('message_status_update', { messageId, sessionId, status: 'READ', readBy: socket.user.id });
      } catch (e) {
        logger.error(e);
      }
    });

    socket.on('send_message', async (data) => {
      try {
        const { sessionId, message, message_type, reply_to_message_id } = data;

        const session = await ChatSession.findByPk(sessionId);
        if (!session) return;

        // Security check via participant
        const isParticipant = await ChatParticipant.findOne({ where: { session_id: sessionId, user_id: socket.user.id }});
        
        let authorized = !!isParticipant;
        if (!authorized && socket.user.role === 'TENANT') {
           authorized = (session.tenant_id === socket.user.id);
        }

        if (!authorized) return;

        const chatMessage = await ChatMessage.create({
          session_id: sessionId,
          sender_id: socket.user.id,
          message,
          message_type: message_type || 'TEXT',
          reply_to_message_id
        });

        await session.update({ updated_at: new Date() });

        const fullMessage = await ChatMessage.findByPk(chatMessage.id, {
          include: [{ model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name', 'role', 'profile_picture'] }]
        });

        io.to(`session_${sessionId}`).emit('receive_message', fullMessage);
      } catch (err) {
        logger.error('Socket send_message error:', err);
      }
    });

    socket.on('disconnect', async () => {
      logger.info(`User ${userId} disconnected via socket ${socket.id}`);
      try {
        await CommunicationDevice.update(
          { is_online: false, last_seen_at: new Date() },
          { where: { socket_id: socket.id } }
        );
      } catch (e) {}
    });
  });

  return io;
};

const getIo = () => {
  if (!io) {
    throw new Error('Socket.io has not been initialized');
  }
  return io;
};

module.exports = {
  initializeSocket,
  getIo
};
