const { Worker } = require('bullmq');
const { redisConfig } = require('../../config/redis');
const communicationProcessor = require('../processors/communication.processor');
const logger = require('../../utils/logger');

const communicationWorker = new Worker('communication-queue', communicationProcessor, {
  connection: redisConfig,
});

communicationWorker.on('completed', (job) => {
  logger.info(`Communication job ${job.id} has completed successfully.`);
});

communicationWorker.on('failed', (job, err) => {
  logger.error(`Communication job ${job.id} has failed with ${err.message}`);
});

module.exports = communicationWorker;
