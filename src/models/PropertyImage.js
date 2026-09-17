const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Property = require('./Property');

const PropertyImage = sequelize.define('PropertyImage', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  image: {
    type: DataTypes.STRING,
    allowNull: false,
  },
}, {
  tableName: 'properties_propertyimage',
  timestamps: true,
  createdAt: 'uploaded_at',
  updatedAt: false,
});

PropertyImage.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });
Property.hasMany(PropertyImage, { foreignKey: 'property_id', as: 'images' });

module.exports = PropertyImage;
