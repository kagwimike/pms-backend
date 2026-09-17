const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const Amenity = sequelize.define('Amenity', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
}, {
  tableName: 'properties_amenity',
  timestamps: false,
});

module.exports = Amenity;
