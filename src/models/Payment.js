const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Invoice = require('./Invoice');
const User = require('./User');

const PAYMENT_STATUSES = ['PENDING', 'CONFIRMED', 'FAILED', 'REVERSED', 'REFUNDED', 'UNMATCHED', 'CANCELLED'];
const PAYMENT_METHODS = ['MPESA', 'CARD', 'BANK_TRANSFER', 'CASH'];

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
    type: DataTypes.ENUM(...PAYMENT_METHODS),
    defaultValue: 'MPESA',
  },
  // M-Pesa receipt number (e.g. QKJ3XXXXXX) or bank transaction reference
  transaction_reference: {
    type: DataTypes.STRING(100),
    unique: true,
    allowNull: true,
  },
  gateway_response: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM(...PAYMENT_STATUSES),
    defaultValue: 'PENDING',
  },
  is_confirmed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  // --- Gateway fields (M-Pesa Daraja STK / C2B, bank webhooks) ---
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  checkout_request_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  merchant_request_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  // Paybill account number / bank narration used to match an invoice (e.g. INV-12)
  account_reference: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  payer_name: {
    type: DataTypes.STRING(150),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  invoice_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  tenant_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
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

Payment.STATUSES = PAYMENT_STATUSES;
Payment.METHODS = PAYMENT_METHODS;

module.exports = Payment;
