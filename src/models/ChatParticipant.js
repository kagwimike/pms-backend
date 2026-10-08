const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const ChatSession = require('./ChatSession');

const ChatParticipant = sequelize.define('ChatParticipant', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  session_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  joined_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  left_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  last_read_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  }
}, {
  tableName: 'communication_chat_participants',
  timestamps: false,
});

ChatParticipant.belongsTo(ChatSession, { foreignKey: 'session_id', as: 'session' });
ChatSession.hasMany(ChatParticipant, { foreignKey: 'session_id', as: 'participants' });

ChatParticipant.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = ChatParticipant;
