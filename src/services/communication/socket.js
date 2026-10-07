const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const env = require('../../config/env');
const logger = require('../../utils/logger');

let io;

const initializeSocket = (server) => {
  io = new Server(server, {
    cors: {
      origin: '*', // Adjust this for production
      methods: ['GET', 'POST']
    }
  });

  // Authentication Middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    
    if (!token) {
      return next(new Error('Authentication error: Token missing'));
    }

    try {
      const decoded = jwt.verify(token, env.jwtSecret);
      socket.user = { ...decoded, id: decoded.sub };
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`User connected via socket: ${socket.user.id}`);

    // Join a room specifically for this user
    socket.join(`user_${socket.user.id}`);

    // Event: join a specific chat session
    socket.on('join_session', (sessionId) => {
      socket.join(`session_${sessionId}`);
      logger.info(`User ${socket.user.id} joined session_${sessionId}`);
    });

    // Event: leave a specific chat session
    socket.on('leave_session', (sessionId) => {
      socket.leave(`session_${sessionId}`);
    });

    // Event: typing indicator
    socket.on('typing', (data) => {
      // data should contain { sessionId }
      socket.to(`session_${data.sessionId}`).emit('user_typing', { userId: socket.user.id });
    });

    // Event: handle incoming message directly via socket
    socket.on('send_message', async (data) => {
      try {
        const { sessionId, message, message_type } = data;
        const ChatMessage = require('../../models/ChatMessage');
        const ChatSession = require('../../models/ChatSession');
        const User = require('../../models/User');

        const session = await ChatSession.findByPk(sessionId);
        if (!session) return;

        // Verify Access
        if (socket.user.role === 'TENANT' && session.tenant_id !== socket.user.id) return;
        if (socket.user.role === 'VENDOR') {
          const Vendor = require('../../models/Vendor');
          const MaintenanceRequest = require('../../models/MaintenanceRequest');
          const vendor = await Vendor.findOne({ where: { user_id: socket.user.id } });
          if (!vendor || !session.maintenance_id) return;
          const reqMatch = await MaintenanceRequest.findOne({ where: { id: session.maintenance_id, assigned_vendor_id: vendor.id }});
          if (!reqMatch) return;
        }

        // Save to DB
        const chatMessage = await ChatMessage.create({
          session_id: sessionId,
          sender_id: socket.user.id,
          message,
          message_type: message_type || 'TEXT'
        });

        await session.update({ updated_at: new Date() });

        // Fetch full message with sender
        const fullMessage = await ChatMessage.findByPk(chatMessage.id, {
          include: [{ model: User, as: 'sender', attributes: ['id', 'first_name', 'last_name', 'role', 'profile_picture'] }]
        });

        // Broadcast to everyone in the room (including sender, or client can handle locally)
        io.to(`session_${sessionId}`).emit('receive_message', fullMessage);
      } catch (err) {
        console.error('Socket send_message error:', err);
      }
    });

    socket.on('disconnect', () => {
      logger.info(`User disconnected via socket: ${socket.user.id}`);
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
