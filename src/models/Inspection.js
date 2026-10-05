const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Lease = require('./Lease');
const User = require('./User');

const Inspection = sequelize.define('Inspection', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  inspection_type: {
    type: DataTypes.ENUM('CHECKIN', 'CHECKOUT', 'ROUTINE'),
    defaultValue: 'ROUTINE',
  },
  // Lifecycle: SCHEDULED -> COMPLETED (or CANCELLED).
  // PASSED / ISSUES_FOUND / RECONCILED are kept for legacy rows and outcome tracking.
  status: {
    type: DataTypes.ENUM('SCHEDULED', 'COMPLETED', 'CANCELLED', 'PASSED', 'ISSUES_FOUND', 'RECONCILED'),
    defaultValue: 'SCHEDULED',
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  condition_score: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  lease_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  inspector_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
}, {
  tableName: 'inspections_inspection',
  timestamps: false,
});

Inspection.belongsTo(Lease, { foreignKey: 'lease_id', as: 'lease' });
Lease.hasMany(Inspection, { foreignKey: 'lease_id', as: 'inspections' });

Inspection.belongsTo(User, { foreignKey: 'inspector_id', as: 'inspector' });
User.hasMany(Inspection, { foreignKey: 'inspector_id', as: 'conducted_inspections' });

module.exports = Inspection;
