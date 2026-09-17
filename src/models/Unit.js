const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Property = require('./Property');

const Unit = sequelize.define('Unit', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  unit_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  floor: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  bedrooms: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  window_panes: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  bulbs: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  rent_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('VACANT', 'OCCUPIED', 'MAINTENANCE', 'RESERVED'),
    defaultValue: 'VACANT',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'units_unit',
  timestamps: true,
  paranoid: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
});

Unit.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });
Property.hasMany(Unit, { foreignKey: 'property_id', as: 'units' });

module.exports = Unit;
