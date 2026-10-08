const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const ChatSession = require('./ChatSession');

const ChatMessage = sequelize.define('ChatMessage', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  session_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  sender_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  message_type: {
    type: DataTypes.ENUM('TEXT', 'IMAGE', 'FILE', 'SYSTEM'),
    defaultValue: 'TEXT',
  },
  reply_to_message_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  edited_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'communication_chat_messages',
  timestamps: true,
  paranoid: true, // adds deleted_at
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
});

ChatMessage.belongsTo(ChatSession, { foreignKey: 'session_id', as: 'session' });
ChatSession.hasMany(ChatMessage, { foreignKey: 'session_id', as: 'messages' });

ChatMessage.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' });

module.exports = ChatMessage;
