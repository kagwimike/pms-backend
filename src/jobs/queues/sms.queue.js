const { Queue } = require('bullmq');
const { redisConfig } = require('../../config/redis');

const smsQueue = new Queue('sms-queue', {
  connection: redisConfig,
});

module.exports = smsQueue;
