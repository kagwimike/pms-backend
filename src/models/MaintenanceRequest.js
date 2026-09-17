const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const Property = require('./Property');
const Unit = require('./Unit');
const Vendor = require('./Vendor');

const MaintenanceRequest = sequelize.define('MaintenanceRequest', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  damage_photo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'IN_PROGRESS', 'COMPLETED', 'VERIFIED', 'CANCELLED'),
    defaultValue: 'PENDING',
  },
  priority: {
    type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT'),
    defaultValue: 'MEDIUM',
  },
  vendor_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  vendor_completed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'maintenance_maintenancerequest',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

MaintenanceRequest.belongsTo(User, { foreignKey: 'tenant_id', as: 'tenant' });
User.hasMany(MaintenanceRequest, { foreignKey: 'tenant_id', as: 'maintenance_requests' });

MaintenanceRequest.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });
Property.hasMany(MaintenanceRequest, { foreignKey: 'property_id', as: 'maintenance_requests' });

MaintenanceRequest.belongsTo(Unit, { foreignKey: 'unit_id', as: 'unit' });
Unit.hasMany(MaintenanceRequest, { foreignKey: 'unit_id', as: 'maintenance_requests' });

MaintenanceRequest.belongsTo(Vendor, { foreignKey: 'assigned_vendor_id', as: 'assigned_vendor' });
Vendor.hasMany(MaintenanceRequest, { foreignKey: 'assigned_vendor_id', as: 'assigned_requests' });

module.exports = MaintenanceRequest;
