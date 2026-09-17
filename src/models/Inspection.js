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
  status: {
    type: DataTypes.ENUM('PASSED', 'ISSUES_FOUND', 'RECONCILED'),
    defaultValue: 'PASSED',
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
}, {
  tableName: 'inspections_inspection',
  timestamps: false,
});

Inspection.belongsTo(Lease, { foreignKey: 'lease_id', as: 'lease' });
Lease.hasMany(Inspection, { foreignKey: 'lease_id', as: 'inspections' });

Inspection.belongsTo(User, { foreignKey: 'inspector_id', as: 'inspector' });
User.hasMany(Inspection, { foreignKey: 'inspector_id', as: 'conducted_inspections' });

module.exports = Inspection;
