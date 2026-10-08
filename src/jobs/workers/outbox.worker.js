const { Worker } = require('bullmq');
const { redisConfig } = require('../../config/redis');
const logger = require('../../utils/logger');
const OutboxProcessor = require('../processors/outbox.processor');

const outboxWorker = new Worker('outbox-queue', async (job) => {
  if (job.name === 'process_outbox') {
    await OutboxProcessor.processPendingEvents();
  }
}, { connection: redisConfig });

outboxWorker.on('failed', (job, err) => {
  logger.error(`Outbox Job ${job.id} has failed with ${err.message}`);
});

module.exports = outboxWorker;
