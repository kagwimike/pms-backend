const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const Lease = require('./Lease');
const User = require('./User');

const Invoice = sequelize.define('Invoice', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
  },
  invoice_type: {
    type: DataTypes.ENUM('RENT', 'UTILITY', 'DEPOSIT', 'LATE_FEE', 'MAINTENANCE'),
    defaultValue: 'RENT',
  },
  amount: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
  },
  amount_paid: {
    type: DataTypes.DECIMAL(12, 2),
    defaultValue: 0.00,
  },
  status: {
    type: DataTypes.ENUM('PENDING', 'PARTIAL', 'PAID', 'OVERDUE', 'CANCELLED'),
    defaultValue: 'PENDING',
  },
  due_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
  },
}, {
  tableName: 'payments_invoice',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

Invoice.belongsTo(Lease, { foreignKey: 'lease_id', as: 'lease' });
Lease.hasMany(Invoice, { foreignKey: 'lease_id', as: 'invoices' });

module.exports = Invoice;
