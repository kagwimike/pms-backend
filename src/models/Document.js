const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');

const DOCUMENT_ENTITY_TYPES = ['PROPERTY', 'UNIT', 'LEASE', 'TENANT', 'MAINTENANCE', 'INSPECTION', 'GENERAL'];

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
  original_name: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  mime_type: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  entity_type: {
    // e.g., 'PROPERTY', 'UNIT', 'LEASE', 'TENANT', 'MAINTENANCE', 'INSPECTION', 'GENERAL'
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'GENERAL',
  },
  entity_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  document_type: {
    // e.g. 'LEASE_AGREEMENT', 'ID_COPY', 'INSURANCE', 'PERMIT', 'RECEIPT', 'OTHER'
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  expiry_date: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  expiry_notified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  uploaded_by_id: {
    type: DataTypes.BIGINT,
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

Document.ENTITY_TYPES = DOCUMENT_ENTITY_TYPES;

module.exports = Document;
