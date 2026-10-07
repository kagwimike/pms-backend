const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const Property = require('./Property');

const Incident = sequelize.define('Incident', {
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
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'),
    defaultValue: 'OPEN',
  },
  severity: {
    type: DataTypes.ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
    defaultValue: 'MEDIUM',
  },
  property_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: Property,
      key: 'id',
    },
  },
  reported_by: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: User,
      key: 'id',
    },
  },
  resolved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'incidents',
  timestamps: true,
  paranoid: true, // soft delete support
});

Incident.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });
Property.hasMany(Incident, { foreignKey: 'property_id', as: 'incidents' });

Incident.belongsTo(User, { foreignKey: 'reported_by', as: 'reporter' });
User.hasMany(Incident, { foreignKey: 'reported_by', as: 'reported_incidents' });

module.exports = Incident;
