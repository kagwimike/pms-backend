const ApiError = require('../utils/ApiError');
const env = require('../config/env');
const logger = require('../utils/logger');
const { Sequelize } = require('sequelize');
const { errorResponse } = require('../utils/formatResponse');

const errorConverter = (err, req, res, next) => {
  let error = err;
  if (!(error instanceof ApiError)) {
    const statusCode = error.statusCode || (error instanceof Sequelize.Error ? 400 : 500);
    let message = error.message || 'Something went wrong';
    
    // Graceful error messages for database constraints
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      message = `Invalid reference: the provided ID does not exist for a related record (e.g. unit, property, or tenant).`;
    } else if (error.name === 'SequelizeUniqueConstraintError') {
      if (error.errors && error.errors.length > 0) {
        message = `Duplicate entry error: ${error.errors[0].message}`;
      } else {
        message = `Duplicate entry: a record with this unique value already exists.`;
      }
    }

    error = new ApiError(statusCode, message, false, err.stack);
  }
  next(error);
};

const errorHandler = (err, req, res, next) => {
  let { statusCode, message } = err;
  if (env.env === 'production' && !err.isOperational) {
    statusCode = 500;
    message = 'Internal Server Error';
  }

  res.locals.errorMessage = err.message;

  if (env.env === 'development') {
    logger.error(err);
  }

  return errorResponse(res, message, statusCode, err);
};

module.exports = {
  errorConverter,
  errorHandler,
};
