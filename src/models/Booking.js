const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/db');
const User = require('./User');
const Property = require('./Property');

// Since the bookings model was empty in Django, 
// we will scaffold a basic booking structure here.
const Booking = sequelize.define('Booking', {
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
    type: DataTypes.ENUM('PENDING', 'CONFIRMED', 'CANCELLED'),
    defaultValue: 'PENDING',
  },
  total_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
}, {
  tableName: 'bookings_booking',
  timestamps: true,
});

Booking.belongsTo(User, { foreignKey: 'guest_id', as: 'guest' });
Booking.belongsTo(Property, { foreignKey: 'property_id', as: 'property' });

module.exports = Booking;
