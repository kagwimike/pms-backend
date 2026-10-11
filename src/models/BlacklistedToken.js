const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const BlacklistedToken = sequelize.define('BlacklistedToken', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  token: {
    type: DataTypes.STRING(1000), // Tokens can be long
    allowNull: false,
    unique: true,
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: false,
  },
}, {
  tableName: 'auth_blacklisted_tokens',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = BlacklistedToken;
