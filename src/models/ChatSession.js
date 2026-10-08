const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const Property = require('./Property');
const Unit = require('./Unit');
const Lease = require('./Lease');
const MaintenanceRequest = require('./MaintenanceRequest');

const ChatSession = sequelize.define('ChatSession', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  status: {
    type: DataTypes.ENUM('OPEN', 'CLOSED', 'ARCHIVED'),
    defaultValue: 'OPEN',
  },
  subject: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  tenant_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  property_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  unit_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  lease_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  maintenance_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  inspection_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  invoice_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  entity_type: {
    type: DataTypes.STRING(50),
    allowNull: true, // e.g. 'MAINTENANCE', 'INVOICE', 'LEASE'
  },
  entity_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  closed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'communication_chat_sessions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

ChatSession.belongsTo(User, { foreignKey: 'tenant_id', as: 'tenant' });
ChatSession.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });
ChatSession.belongsTo(Unit, { foreignKey: 'unit_id', as: 'unit' });
ChatSession.belongsTo(Lease, { foreignKey: 'lease_id', as: 'lease' });
ChatSession.belongsTo(MaintenanceRequest, { foreignKey: 'maintenance_id', as: 'maintenance' });

module.exports = ChatSession;
