const { Queue } = require('bullmq');
const { redisConfig } = require('../../config/redis');

const pushQueue = new Queue('push-queue', {
  connection: redisConfig,
});

module.exports = pushQueue;
