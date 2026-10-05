const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
require('express-async-errors'); // Handles async errors automatically

const env = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const { errorConverter, errorHandler } = require('./middleware/error.middleware');
const notFoundHandler = require('./middleware/notFound.middleware');

const app = express();

const currentEnv = env.env || env.nodeEnv || process.env.NODE_ENV;

if (currentEnv !== 'test') {
  app.use(morgan(currentEnv === 'development' ? 'dev' : 'combined'));
}

// Set security HTTP headers
// crossOriginResourcePolicy is relaxed so the Flutter web client (served from a
// different origin/port) can load uploaded property images from /media.
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));

// Parse JSON request body (rawBody kept for webhook signature verification)
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  },
}));

// Parse URL-encoded request body
app.use(express.urlencoded({ extended: true }));

// Enable CORS
app.use(cors());
app.options('*', cors());

const path = require('path');

// Serve media and static uploads
const mediaDir = path.join(__dirname, '../../media');
app.use('/media', express.static(mediaDir));
app.use('/property_images', express.static(path.join(mediaDir, 'property_images')));

// API v1 routes
app.use('/api', routes);

// 404 handler for unknown routes
app.use(notFoundHandler);

// Convert error to ApiError if needed
app.use(errorConverter);

// Global error handler
app.use(errorHandler);

module.exports = app;