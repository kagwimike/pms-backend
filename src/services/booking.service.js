const Booking = require('../models/Booking');
const ApiError = require('../utils/ApiError');

const createBooking = async (bookingBody, guestId) => {
  return Booking.create({ ...bookingBody, guest_id: guestId });
};

const getBookings = async (propertyId, limit, cursorWhere, order) => {
  const filter = { ...cursorWhere };
  if (propertyId) filter.property_id = propertyId;
  return Booking.findAll({ where: filter, limit, order });
};

const updateBookingStatus = async (id, status) => {
  const booking = await Booking.findByPk(id);
  if (!booking) {
    throw new ApiError(404, 'Booking not found');
  }
  booking.status = status;
  await booking.save();
  return booking;
};

module.exports = {
  createBooking,
  getBookings,
  updateBookingStatus,
};
