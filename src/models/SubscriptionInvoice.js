const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const SubscriptionPlan = require('./SubscriptionPlan');

const SubscriptionInvoice = sequelize.define('SubscriptionInvoice', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  invoice_number: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  owner_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    references: {
      model: 'accounts_user',
      key: 'id',
    },
  },
  plan_id: {
    type: DataTypes.BIGINT,
    allowNull: true,
    references: {
      model: 'subscription_plans',
      key: 'id',
    },
  },
  plan_code: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  billing_cycle: {
    type: DataTypes.ENUM('MONTHLY', 'ANNUAL'),
    defaultValue: 'MONTHLY',
  },
  amount_kes: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
  },
  payment_method: {
    type: DataTypes.ENUM('MPESA', 'BANK_TRANSFER', 'CARD', 'OFFLINE'),
    defaultValue: 'MPESA',
  },
  transaction_reference: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'M-Pesa receipt code e.g. QKJ3XXXXXX',
  },
  checkout_request_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Daraja STK push CheckoutRequestID',
  },
  merchant_request_id: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PAID', 'FAILED', 'CANCELLED'),
    defaultValue: 'PENDING',
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'subscription_invoices',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

SubscriptionInvoice.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });
SubscriptionInvoice.belongsTo(SubscriptionPlan, { foreignKey: 'plan_id', as: 'plan' });

module.exports = SubscriptionInvoice;
