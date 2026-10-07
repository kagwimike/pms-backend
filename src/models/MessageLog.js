const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const NotificationTemplate = require('./NotificationTemplate');

const MessageLog = sequelize.define('MessageLog', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  recipient_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  channel: {
    type: DataTypes.ENUM('SMS', 'EMAIL', 'PUSH', 'IN_APP'),
    allowNull: false,
  },
  event_type: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  template_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  subject: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'FAILED'),
    defaultValue: 'PENDING',
  },
  provider: {
    type: DataTypes.STRING(100), // e.g. 'africas_talking', 'sendgrid', 'fcm'
    allowNull: true,
  },
  provider_id: {
    type: DataTypes.STRING(255), // External message ID for delivery callbacks
    allowNull: true,
  },
  entity_type: {
    type: DataTypes.STRING(100), // e.g. 'INVOICE', 'MAINTENANCE', 'LEASE'
    allowNull: true,
  },
  entity_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  error_code: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  sent_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  delivered_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  failed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'communication_message_logs',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// Relationships
MessageLog.belongsTo(User, { foreignKey: 'recipient_id', as: 'recipient' });
User.hasMany(MessageLog, { foreignKey: 'recipient_id', as: 'messageLogs' });

MessageLog.belongsTo(NotificationTemplate, { foreignKey: 'template_id', as: 'template' });

module.exports = MessageLog;
