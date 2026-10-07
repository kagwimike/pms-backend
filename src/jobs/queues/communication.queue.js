const { Queue } = require('bullmq');
const { redisConfig } = require('../../config/redis');

const communicationQueue = new Queue('communication-queue', {
  connection: redisConfig,
});

module.exports = communicationQueue;
