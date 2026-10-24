const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const ACCOUNT_TYPES = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];
const NORMAL_BALANCES = ['DEBIT', 'CREDIT'];

const Account = sequelize.define('Account', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  account_code: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
  },
  account_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  account_type: {
    type: DataTypes.ENUM(...ACCOUNT_TYPES),
    allowNull: false,
  },
  normal_balance: {
    type: DataTypes.ENUM(...NORMAL_BALANCES),
    allowNull: false,
  },
  category: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'GENERAL',
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  parent_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  is_system: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'KES',
  },
  property_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  owner_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
}, {
  tableName: 'accounting_accounts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// Self-referencing relationship for account hierarchies
Account.belongsTo(Account, { foreignKey: 'parent_id', as: 'parent_account' });
Account.hasMany(Account, { foreignKey: 'parent_id', as: 'sub_accounts' });

Account.ACCOUNT_TYPES = ACCOUNT_TYPES;
Account.NORMAL_BALANCES = NORMAL_BALANCES;

module.exports = Account;
