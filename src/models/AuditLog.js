const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');

const AuditLog = sequelize.define('AuditLog', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  action: {
    // e.g., 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE'
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  entity_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  entity_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
}, {
  tableName: 'core_auditlog',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'audit_logs' });

module.exports = AuditLog;
