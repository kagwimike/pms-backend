const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const BankAccount = require('./BankAccount');
const User = require('./User');

const BankStatementUpload = sequelize.define('BankStatementUpload', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  bank_account_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: {
      model: 'payments_bankaccount',
      key: 'id',
    },
  },
  file_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  file_path: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  file_type: {
    type: DataTypes.ENUM('CSV', 'XLSX', 'XLS', 'MT940', 'OTHER'),
    defaultValue: 'CSV',
  },
  uploaded_by: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'accounts_user',
      key: 'id',
    },
  },
  total_rows: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  total_amount: {
    type: DataTypes.DECIMAL(14, 2),
    defaultValue: 0.00,
  },
  matched_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  unmatched_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  duplicate_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'),
    defaultValue: 'PENDING',
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  summary_metadata: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'JSON payload storing matched details, unparsed rows, and audit stats',
  },
}, {
  tableName: 'payments_bankstatementupload',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// Relationships
BankStatementUpload.belongsTo(BankAccount, { foreignKey: 'bank_account_id', as: 'bank_account' });
BankAccount.hasMany(BankStatementUpload, { foreignKey: 'bank_account_id', as: 'statement_uploads' });

BankStatementUpload.belongsTo(User, { foreignKey: 'uploaded_by', as: 'uploader' });

module.exports = BankStatementUpload;
