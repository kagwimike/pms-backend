const express = require('express');
const bookingController = require('../controllers/booking.controller');
const { auth } = require('../middleware/auth.middleware');

const router = express.Router();

router
  .route('/')
  .post(auth, bookingController.createBooking)
  .get(auth, bookingController.getBookings);

module.exports = router;
