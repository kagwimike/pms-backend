const { Worker } = require('bullmq');
const { redisConfig } = require('../../config/redis');
const { QUEUE_NAMES } = require('../../constants/jobNames');
const emailProcessor = require('../processors/email.processor');
const logger = require('../../utils/logger');

const emailWorker = new Worker(QUEUE_NAMES.EMAIL_QUEUE, emailProcessor, {
  connection: redisConfig,
});

emailWorker.on('completed', (job) => {
  logger.info(`Email job ${job.id} has completed!`);
});

emailWorker.on('failed', (job, err) => {
  logger.error(`Email job ${job.id} has failed with ${err.message}`);
});

module.exports = emailWorker;
