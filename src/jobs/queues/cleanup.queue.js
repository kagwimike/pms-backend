const { Queue } = require('bullmq');
const { redisConfig } = require('../../config/redis');
const { QUEUE_NAMES } = require('../../constants/jobNames');

const cleanupQueue = new Queue(QUEUE_NAMES.CLEANUP_QUEUE, {
  connection: redisConfig,
});

module.exports = cleanupQueue;
