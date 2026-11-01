const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const SubscriptionPlan = require('./SubscriptionPlan');

const WorkspaceSubscription = sequelize.define('WorkspaceSubscription', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  owner_id: {
    type: DataTypes.BIGINT,
    allowNull: false,
    unique: true,
    references: {
      model: 'accounts_user',
      key: 'id',
    },
    comment: 'The user account (OWNER or AGENT) who owns this workspace',
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
    type: DataTypes.ENUM('STARTER', 'PRO', 'ENTERPRISE'),
    allowNull: false,
    defaultValue: 'PRO',
  },
  status: {
    type: DataTypes.ENUM('TRIALING', 'ACTIVE', 'GRACE_PERIOD', 'EXPIRED', 'CANCELLED'),
    allowNull: false,
    defaultValue: 'TRIALING',
  },
  billing_cycle: {
    type: DataTypes.ENUM('MONTHLY', 'ANNUAL'),
    defaultValue: 'MONTHLY',
  },
  trial_ends_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  current_period_start: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  current_period_end: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  auto_renew: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  last_payment_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  mpesa_phone: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  sms_balance: {
    type: DataTypes.INTEGER,
    defaultValue: 500,
  },
  last_notification_sent_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  last_notification_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
}, {
  tableName: 'workspace_subscriptions',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

// Associations
WorkspaceSubscription.belongsTo(User, { foreignKey: 'owner_id', as: 'owner' });
User.hasOne(WorkspaceSubscription, { foreignKey: 'owner_id', as: 'subscription' });

WorkspaceSubscription.belongsTo(SubscriptionPlan, { foreignKey: 'plan_id', as: 'plan' });
SubscriptionPlan.hasMany(WorkspaceSubscription, { foreignKey: 'plan_id', as: 'subscriptions' });

module.exports = WorkspaceSubscription;
