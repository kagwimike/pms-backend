const Redis = require('ioredis');
const env = require('./env');
const logger = require('../utils/logger');

const redisConfig = {
  host: env.redisHost,
  port: env.redisPort,
  password: env.redisPassword,
  maxRetriesPerRequest: null,
};

const redis = new Redis(redisConfig);

redis.on('connect', () => logger.info('Redis connection established successfully'));
redis.on('error', (err) => logger.error('Redis connection error:', err));

module.exports = { redis, redisConfig };
