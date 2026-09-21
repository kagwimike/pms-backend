const { Queue } = require('bullmq');
const { redisConfig } = require('../../config/redis');
const { QUEUE_NAMES } = require('../../constants/jobNames');

const notificationQueue = new Queue(QUEUE_NAMES.NOTIFICATION_QUEUE, {
  connection: redisConfig,
});

module.exports = notificationQueue;
