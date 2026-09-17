const { Sequelize } = require('sequelize');
const env = require('./env');
const logger = require('../utils/logger');

const sequelize = new Sequelize(env.dbName, env.dbUser, env.dbPassword, {
  host: env.dbHost,
  port: env.dbPort,
  dialect: 'mysql',
  logging: (msg) => logger.debug(msg),
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

const connectDB = async () => {
  try {
    await sequelize.authenticate();
    logger.info('MySQL Connection has been established successfully.');
  } catch (error) {
    logger.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDB };
