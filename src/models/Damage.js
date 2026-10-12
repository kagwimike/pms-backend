const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Inspection = require('./Inspection');

const Damage = sequelize.define('Damage', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  item_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  condition: {
    type: DataTypes.ENUM('GOOD', 'FAIR', 'POOR', 'BROKEN', 'MISSING'),
    defaultValue: 'BROKEN',
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  unit_price: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  photo: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  cost: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
  },
  charge_target: {
    type: DataTypes.ENUM('TENANT_DEPOSIT', 'LANDLORD_ACC', 'DIRECT_BILL'),
    defaultValue: 'TENANT_DEPOSIT',
  },
  resolved: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'inspections_damage',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

Damage.belongsTo(Inspection, { foreignKey: 'inspection_id', as: 'inspection' });
Inspection.hasMany(Damage, { foreignKey: 'inspection_id', as: 'damages' });

module.exports = Damage;
