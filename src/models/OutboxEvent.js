const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const OutboxEvent = sequelize.define('OutboxEvent', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  event_type: {
    type: DataTypes.STRING(100),
    allowNull: false, // e.g., 'NOTIFICATION_SEND', 'WEBHOOK_PROCESS'
  },
  payload: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PROCESSED', 'FAILED'),
    defaultValue: 'PENDING',
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  processed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  tableName: 'communication_outbox_events',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = OutboxEvent;
