const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');

const Document = sequelize.define('Document', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  file_path: {
    type: DataTypes.STRING(500),
    allowNull: false,
  },
  entity_type: {
    // e.g., 'PROPERTY', 'UNIT', 'LEASE', 'TENANT', 'MAINTENANCE'
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  entity_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  document_type: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
}, {
  tableName: 'core_document',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

Document.belongsTo(User, { foreignKey: 'uploaded_by_id', as: 'uploaded_by' });
User.hasMany(Document, { foreignKey: 'uploaded_by_id', as: 'uploaded_documents' });

module.exports = Document;
