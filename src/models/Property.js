const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');

const Property = sequelize.define('Property', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  slug: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  property_type: {
    type: DataTypes.ENUM('APARTMENT', 'HOTEL', 'AIRBNB'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('ACTIVE', 'INACTIVE', 'MAINTENANCE'),
    defaultValue: 'ACTIVE',
  },
  address: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  total_units: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'properties_property',
  timestamps: true,
  paranoid: true, // Soft-deletes
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  deletedAt: 'deleted_at',
});

Property.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });
User.hasMany(Property, { foreignKey: 'owner_id', as: 'properties' });

// We require Amenity locally to avoid circular dependencies if any
const Amenity = require('./Amenity');
Property.belongsToMany(Amenity, { through: 'properties_property_amenities', as: 'amenities', foreignKey: 'property_id', otherKey: 'amenity_id', timestamps: false });
Amenity.belongsToMany(Property, { through: 'properties_property_amenities', as: 'properties', foreignKey: 'amenity_id', otherKey: 'property_id', timestamps: false });

module.exports = Property;
