const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
require('express-async-errors'); // To handle async errors in express

const env = require('./config/env');
const logger = require('./utils/logger');
const routes = require('./routes');
const { errorConverter, errorHandler } = require('./middleware/error.middleware');
const notFoundHandler = require('./middleware/notFound.middleware');

const app = express();

if (env !== 'test') {
  app.use(morgan(env === 'development' ? 'dev' : 'combined'));
}

// set security HTTP headers
app.use(helmet());

// parse json request body
app.use(express.json());

// parse urlencoded request body
app.use(express.urlencoded({ extended: true }));

// enable cors
app.use(cors());
app.options('*', cors());

// v1 api routes
app.use('/api', routes);

// send back a 404 error for any unknown api request
app.use(notFoundHandler);

// convert error to ApiError, if needed
app.use(errorConverter);

// handle error
app.use(errorHandler);

module.exports = app;
