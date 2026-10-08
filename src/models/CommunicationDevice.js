const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');

const CommunicationDevice = sequelize.define('CommunicationDevice', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  device_id: {
    type: DataTypes.STRING(255),
    allowNull: true, // e.g. FCM push token or unique hardware ID
  },
  socket_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  platform: {
    type: DataTypes.STRING(50), // 'WEB', 'IOS', 'ANDROID'
    allowNull: true,
  },
  push_token: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  last_seen_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  is_online: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  }
}, {
  tableName: 'communication_devices',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

CommunicationDevice.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(CommunicationDevice, { foreignKey: 'user_id', as: 'devices' });

module.exports = CommunicationDevice;
