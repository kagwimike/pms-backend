const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const Property = require('./Property');

const Announcement = sequelize.define('Announcement', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  content: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  target_audience: {
    type: DataTypes.ENUM('ALL', 'TENANTS', 'OWNERS', 'VENDORS', 'SPECIFIC_PROPERTY'),
    defaultValue: 'ALL',
  },
  target_property_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  send_via_email: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  send_via_sms: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  status: {
    type: DataTypes.ENUM('DRAFT', 'QUEUED', 'SENDING', 'SENT'),
    defaultValue: 'DRAFT',
  },
  sent_at: {
    type: DataTypes.DATE,
    allowNull: true,
  }
}, {
  tableName: 'communication_announcements',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

Announcement.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });
Announcement.belongsTo(Property, { foreignKey: 'target_property_id', as: 'target_property' });

module.exports = Announcement;
