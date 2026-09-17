const { Queue } = require('bullmq');
const { redisConfig } = require('../../config/redis');
const { QUEUE_NAMES } = require('../../constants/jobNames');

const emailQueue = new Queue(QUEUE_NAMES.EMAIL_QUEUE, {
  connection: redisConfig,
});

module.exports = emailQueue;
