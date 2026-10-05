const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  link: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  type: {
    type: DataTypes.ENUM(
      'PAYMENT_RECEIVED', 'PAYMENT_FAILED', 'PAYMENT_REVERSED', 'PAYMENT_REFUNDED', 'PAYMENT_UNMATCHED',
      'INVOICE_CREATED', 'INVOICE_DUE_SOON', 'INVOICE_OVERDUE',
      'LEASE_CREATED', 'LEASE_EXPIRING', 'LEASE_EXPIRED', 'LEASE_RENEWED', 'LEASE_RENEWAL_REMINDER',
      'MAINTENANCE_CREATED', 'MAINTENANCE_ASSIGNED', 'MAINTENANCE_UPDATED', 'MAINTENANCE_COMPLETED',
      'MAINTENANCE_SLA_WARNING', 'MAINTENANCE_SLA_BREACHED',
      'INSPECTION_SCHEDULED', 'INSPECTION_COMPLETED',
      'DAMAGE_REPORTED',
      'DOCUMENT_EXPIRING',
      'UNIT_VACANT', 'UNIT_OCCUPIED',
      'TENANT_CREATED', 'ANNOUNCEMENT_CREATED', 'SYSTEM'
    ),
    defaultValue: 'SYSTEM',
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'notifications_notification',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

Notification.belongsTo(User, { foreignKey: 'recipient_id', as: 'recipient' });
User.hasMany(Notification, { foreignKey: 'recipient_id', as: 'notifications' });

module.exports = Notification;
