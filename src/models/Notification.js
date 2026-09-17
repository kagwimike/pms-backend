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
}, {
  tableName: 'notifications_notification',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

Notification.belongsTo(User, { foreignKey: 'recipient_id', as: 'recipient' });
User.hasMany(Notification, { foreignKey: 'recipient_id', as: 'notifications' });

module.exports = Notification;
