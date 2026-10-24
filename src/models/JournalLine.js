const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const JournalEntry = require('./JournalEntry');
const Account = require('./Account');
const Property = require('./Property');
const Unit = require('./Unit');
const User = require('./User');
const Lease = require('./Lease');
const Vendor = require('./Vendor');
const BankAccount = require('./BankAccount');

const JournalLine = sequelize.define('JournalLine', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  journal_entry_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  account_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  debit: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  credit: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  description: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  property_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  unit_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  tenant_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  lease_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  owner_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  vendor_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  bank_account_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  reconciled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  reconciled_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  tableName: 'accounting_journal_lines',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['journal_entry_id'] },
    { fields: ['account_id'] },
    { fields: ['property_id'] },
    { fields: ['tenant_id'] },
    { fields: ['owner_id'] },
    { fields: ['vendor_id'] },
    { fields: ['bank_account_id'] },
  ],
});

// Relationships
JournalLine.belongsTo(JournalEntry, { foreignKey: 'journal_entry_id', as: 'journal_entry' });
JournalEntry.hasMany(JournalLine, { foreignKey: 'journal_entry_id', as: 'lines' });

JournalLine.belongsTo(Account, { foreignKey: 'account_id', as: 'account' });
Account.hasMany(JournalLine, { foreignKey: 'account_id', as: 'journal_lines' });

JournalLine.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });
JournalLine.belongsTo(Unit, { foreignKey: 'unit_id', as: 'unit' });
JournalLine.belongsTo(User, { foreignKey: 'tenant_id', as: 'tenant' });
JournalLine.belongsTo(Lease, { foreignKey: 'lease_id', as: 'lease' });
JournalLine.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });
JournalLine.belongsTo(Vendor, { foreignKey: 'vendor_id', as: 'vendor' });
JournalLine.belongsTo(BankAccount, { foreignKey: 'bank_account_id', as: 'bank_account' });

module.exports = JournalLine;
