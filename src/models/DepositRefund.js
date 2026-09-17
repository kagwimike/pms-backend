const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Lease = require('./Lease');
const User = require('./User');

const DepositRefund = sequelize.define('DepositRefund', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  amount_refunded: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  deductions_retained: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
  },
  payment_method: {
    type: DataTypes.ENUM('MPESA', 'CARD', 'BANK_TRANSFER', 'CASH'),
    defaultValue: 'BANK_TRANSFER',
  },
  transaction_reference: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'payments_depositrefund',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
});

DepositRefund.belongsTo(Lease, { foreignKey: 'lease_id', as: 'lease' });
Lease.hasMany(DepositRefund, { foreignKey: 'lease_id', as: 'deposit_refunds' });

DepositRefund.belongsTo(User, { foreignKey: 'processed_by_id', as: 'processed_by' });
User.hasMany(DepositRefund, { foreignKey: 'processed_by_id', as: 'processed_refunds' });

module.exports = DepositRefund;
