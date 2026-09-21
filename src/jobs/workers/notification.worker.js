const { Worker } = require('bullmq');
const { redisConfig } = require('../../config/redis');
const { QUEUE_NAMES } = require('../../constants/jobNames');
const notificationProcessor = require('../processors/notification.processor');
const logger = require('../../utils/logger');

const notificationWorker = new Worker(QUEUE_NAMES.NOTIFICATION_QUEUE, notificationProcessor, {
  connection: redisConfig,
});

notificationWorker.on('completed', (job) => {
  logger.info(`Notification job ${job.id} has completed!`);
});

notificationWorker.on('failed', (job, err) => {
  logger.error(`Notification job ${job.id} has failed with ${err.message}`);
});

module.exports = notificationWorker;
