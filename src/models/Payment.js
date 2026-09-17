const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Invoice = require('./Invoice');
const User = require('./User');

const Payment = sequelize.define('Payment', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  payment_method: {
    type: DataTypes.ENUM('MPESA', 'CARD', 'BANK_TRANSFER', 'CASH'),
    defaultValue: 'MPESA',
  },
  transaction_reference: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: true,
  },
  gateway_response: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  is_confirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'payments_payment',
  timestamps: true,
  createdAt: 'paid_at',
  updatedAt: false,
});

Payment.belongsTo(Invoice, { foreignKey: 'invoice_id', as: 'invoice' });
Invoice.hasMany(Payment, { foreignKey: 'invoice_id', as: 'payments' });

Payment.belongsTo(User, { foreignKey: 'tenant_id', as: 'tenant' });
User.hasMany(Payment, { foreignKey: 'tenant_id', as: 'payments' });

module.exports = Payment;
