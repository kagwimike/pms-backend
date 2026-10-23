const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');

const DOCUMENT_ENTITY_TYPES = ['PROPERTY', 'UNIT', 'LEASE', 'TENANT', 'MAINTENANCE', 'INSPECTION', 'FINANCE', 'GENERAL'];
const DOCUMENT_STATUSES = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'FINALIZED', 'ARCHIVED'];
const ACCESS_SCOPES = ['PRIVATE', 'ORGANIZATION', 'TENANT_SHARED', 'VENDOR_SHARED', 'PUBLIC'];

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
  file_size: {
    type: DataTypes.BIGINT,
    allowNull: true,
    defaultValue: 0,
  },
  checksum: {
    type: DataTypes.STRING(64),
    allowNull: true,
  },
  version: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  parent_document_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM(DOCUMENT_STATUSES),
    allowNull: false,
    defaultValue: 'APPROVED',
  },
  is_finalized: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_archived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  access_scope: {
    type: DataTypes.ENUM(ACCESS_SCOPES),
    allowNull: false,
    defaultValue: 'ORGANIZATION',
  },
  entity_type: {
    // e.g., 'PROPERTY', 'UNIT', 'LEASE', 'TENANT', 'MAINTENANCE', 'INSPECTION', 'FINANCE', 'GENERAL'
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'GENERAL',
  },
  entity_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  property_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  document_type: {
    // e.g. 'LEASE_AGREEMENT', 'ID_COPY', 'INSURANCE', 'PERMIT', 'RECEIPT', 'INSPECTION_REPORT', 'WORK_ORDER', 'OTHER'
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
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

Document.belongsTo(Document, { foreignKey: 'parent_document_id', as: 'parent_document' });
Document.hasMany(Document, { foreignKey: 'parent_document_id', as: 'versions' });

Document.ENTITY_TYPES = DOCUMENT_ENTITY_TYPES;
Document.STATUSES = DOCUMENT_STATUSES;
Document.ACCESS_SCOPES = ACCESS_SCOPES;

module.exports = Document;

