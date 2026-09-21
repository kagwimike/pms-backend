const { Worker } = require('bullmq');
const { redisConfig } = require('../../config/redis');
const { QUEUE_NAMES } = require('../../constants/jobNames');
const cleanupProcessor = require('../processors/cleanup.processor');
const logger = require('../../utils/logger');

const cleanupWorker = new Worker(QUEUE_NAMES.CLEANUP_QUEUE, cleanupProcessor, {
  connection: redisConfig,
});

cleanupWorker.on('completed', (job) => {
  logger.info(`Cleanup job ${job.id} has completed!`);
});

cleanupWorker.on('failed', (job, err) => {
  logger.error(`Cleanup job ${job.id} has failed with ${err.message}`);
});

module.exports = cleanupWorker;
