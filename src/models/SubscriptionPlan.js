const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');

const SubscriptionPlan = sequelize.define('SubscriptionPlan', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  code: {
    type: DataTypes.ENUM('STARTER', 'PRO', 'ENTERPRISE'),
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  tagline: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  price_monthly_kes: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  price_annual_kes: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00,
  },
  max_units: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 25,
  },
  max_staff: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  has_mpesa_auto_reconcile: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  has_kra_tax_reports: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  has_landlord_payout_sheets: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  monthly_sms_quota: {
    type: DataTypes.INTEGER,
    defaultValue: 100,
  },
  features: {
    type: DataTypes.JSON,
    allowNull: true,
    comment: 'Array of feature bullet strings for frontend UI display',
  },
  is_popular: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
}, {
  tableName: 'subscription_plans',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

module.exports = SubscriptionPlan;
