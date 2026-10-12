const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');

const SystemSetting = sequelize.define('SystemSetting', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  scope: {
    type: DataTypes.ENUM('GLOBAL', 'ORGANIZATION', 'PROPERTY', 'USER'),
    allowNull: false,
    defaultValue: 'GLOBAL',
  },
  scope_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  category: {
    type: DataTypes.ENUM(
      'GENERAL',
      'ORGANIZATION',
      'RENTAL',
      'FINANCE',
      'NOTIFICATIONS',
      'INTEGRATIONS',
      'SECURITY',
      'APPEARANCE'
    ),
    allowNull: false,
  },
  settings_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  settings_value: {
    type: DataTypes.JSON,
    allowNull: false,
    defaultValue: {},
  },
  updated_by: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
}, {
  tableName: 'core_settings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['scope', 'scope_id', 'category', 'settings_key'],
    },
  ],
});

SystemSetting.belongsTo(User, { foreignKey: 'updated_by', as: 'updater' });

module.exports = SystemSetting;
