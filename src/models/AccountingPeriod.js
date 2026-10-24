const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');

const PERIOD_STATUSES = ['OPEN', 'CLOSED', 'LOCKED'];

const AccountingPeriod = sequelize.define('AccountingPeriod', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  period_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  fiscal_year: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  period_number: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  start_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  end_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM(...PERIOD_STATUSES),
    defaultValue: 'OPEN',
  },
  closed_by_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  closed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  close_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'accounting_periods',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['fiscal_year', 'period_number'],
    },
  ],
});

AccountingPeriod.belongsTo(User, { foreignKey: 'closed_by_id', as: 'closed_by' });
AccountingPeriod.PERIOD_STATUSES = PERIOD_STATUSES;

module.exports = AccountingPeriod;
