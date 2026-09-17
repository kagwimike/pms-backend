const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const Unit = require('./Unit');

const Lease = sequelize.define('Lease', {
  id: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    autoIncrement: true,
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
    type: DataTypes.ENUM('PENDING', 'ACTIVE', 'TERMINATED'),
    defaultValue: 'PENDING',
  },
  rent_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  deposit_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'leases_lease',
  timestamps: false, // Wait, django had no created_at here? Let's assume false to match exact django
});

Lease.belongsTo(Unit, { foreignKey: 'unit_id', as: 'unit' });
Unit.hasMany(Lease, { foreignKey: 'unit_id', as: 'leases' });

Lease.belongsTo(User, { foreignKey: 'tenant_id', as: 'tenant' });
User.hasMany(Lease, { foreignKey: 'tenant_id', as: 'leases' });

module.exports = Lease;
