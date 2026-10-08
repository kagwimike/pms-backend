const { Queue } = require('bullmq');
const { redisConfig } = require('../../config/redis');
const logger = require('../../utils/logger');

const outboxQueue = new Queue('outbox-queue', {
  connection: redisConfig,
});

// Setup repeatable job to poll outbox every 10 seconds
outboxQueue.add('process_outbox', {}, {
  repeat: {
    every: 10000 // 10 seconds
  }
}).then(() => logger.info('Outbox Queue: Repeatable job registered.'))
  .catch((err) => logger.error('Outbox Queue setup error:', err));

module.exports = outboxQueue;
