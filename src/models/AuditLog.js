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
    // e.g., 'CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'LOGIN', etc.
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  module: {
    // e.g., 'AUTH', 'LEASES', 'FINANCE', 'DOCUMENTS', 'MAINTENANCE', 'INSPECTIONS', 'PROPERTIES', 'SETTINGS', 'SYSTEM'
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'SYSTEM',
  },
  entity_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  entity_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  summary: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  outcome: {
    type: DataTypes.ENUM('SUCCESS', 'FAILURE', 'DENIED'),
    allowNull: false,
    defaultValue: 'SUCCESS',
  },
  severity: {
    type: DataTypes.ENUM('INFO', 'WARNING', 'CRITICAL'),
    allowNull: false,
    defaultValue: 'INFO',
  },
  actor_role: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  property_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  request_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
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
  updatedAt: false, // Audit records are immutable append-only
});

AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'audit_logs' });

module.exports = AuditLog;

