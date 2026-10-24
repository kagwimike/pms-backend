const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const AccountingPeriod = require('./AccountingPeriod');

const JOURNAL_STATUSES = ['DRAFT', 'POSTED', 'REVERSED'];
const SOURCE_TYPES = [
  'MANUAL',
  'INVOICE',
  'PAYMENT',
  'DEPOSIT',
  'DEPOSIT_REFUND',
  'EXPENSE',
  'MAINTENANCE',
  'OWNER_PAYOUT',
  'MANAGEMENT_FEE',
  'RECONCILIATION',
  'OPENING_BALANCE'
];

const JournalEntry = sequelize.define('JournalEntry', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  entry_number: {
    type: DataTypes.STRING(50),
    unique: true,
    allowNull: false,
  },
  entry_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  posting_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  period_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM(...JOURNAL_STATUSES),
    defaultValue: 'POSTED',
  },
  source_type: {
    type: DataTypes.ENUM(...SOURCE_TYPES),
    defaultValue: 'MANUAL',
  },
  source_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  reference: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'KES',
  },
  total_debit: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  total_credit: {
    type: DataTypes.DECIMAL(14, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  is_balanced: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  created_by_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  posted_by_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  posted_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  reversed_by_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  reversal_entry_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  reversal_reason: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'accounting_journal_entries',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['source_type', 'source_id'] },
    { fields: ['posting_date'] },
    { fields: ['status'] },
    { fields: ['reference'] },
  ],
});

JournalEntry.belongsTo(AccountingPeriod, { foreignKey: 'period_id', as: 'period' });
JournalEntry.belongsTo(User, { foreignKey: 'created_by_id', as: 'created_by' });
JournalEntry.belongsTo(User, { foreignKey: 'posted_by_id', as: 'posted_by' });
JournalEntry.belongsTo(User, { foreignKey: 'reversed_by_id', as: 'reversed_by' });
JournalEntry.belongsTo(JournalEntry, { foreignKey: 'reversal_entry_id', as: 'reversal_entry' });

JournalEntry.STATUSES = JOURNAL_STATUSES;
JournalEntry.SOURCE_TYPES = SOURCE_TYPES;

module.exports = JournalEntry;
