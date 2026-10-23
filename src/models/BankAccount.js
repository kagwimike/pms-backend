const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Property = require('./Property');
const User = require('./User');

const BANK_NAMES = [
  'EQUITY',
  'COOP',
  'KCB',
  'NCBA',
  'STANBIC',
  'ABSA',
  'DTB',
  'IM_BANK',
  'STANDARD_CHARTERED',
  'FAMILY_BANK',
  'OTHER',
];

const BankAccount = sequelize.define('BankAccount', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  property_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: {
      model: 'properties_property',
      key: 'id',
    },
    comment: 'Optional link if the account is dedicated to a specific property/estate',
  },
  bank_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'EQUITY',
    validate: {
      notEmpty: true,
    },
  },
  account_name: {
    type: DataTypes.STRING(150),
    allowNull: false,
    comment: 'Official bank account title, e.g., Apex Realtors Client Collection Account',
  },
  account_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    comment: 'Account number',
  },
  bank_code: {
    type: DataTypes.STRING(20),
    allowNull: true,
    comment: 'Clearing/Bank Code (e.g. 68 for Equity, 11 for Co-op, 01 for KCB)',
  },
  branch_code: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  branch_name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  paybill_number: {
    type: DataTypes.STRING(30),
    allowNull: true,
    comment: 'Associated Bank Paybill or Till Number (e.g. 247247 for Equity, 400200 for Co-op)',
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'KES',
  },
  is_primary: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    comment: 'Default collection account for general rent deposits',
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  webhook_secret: {
    type: DataTypes.STRING(255),
    allowNull: true,
    comment: 'HMAC signature secret for bank Instant Payment Notifications (IPN)',
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  created_by: {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: {
      model: 'accounts_user',
      key: 'id',
    },
  },
}, {
  tableName: 'payments_bankaccount',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// Relationships
BankAccount.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });
Property.hasMany(BankAccount, { foreignKey: 'property_id', as: 'bank_accounts' });

BankAccount.belongsTo(User, { foreignKey: 'created_by', as: 'creator' });

BankAccount.BANK_NAMES = BANK_NAMES;

module.exports = BankAccount;
