const logger = require('../utils/logger');

// Queues
const emailQueue = require('./queues/email.queue');
const notificationQueue = require('./queues/notification.queue');
const cleanupQueue = require('./queues/cleanup.queue');
const communicationQueue = require('./queues/communication.queue');

// Workers (Require them to initialize)
require('./workers/email.worker');
require('./workers/notification.worker');
require('./workers/cleanup.worker');
require('./workers/communication.worker');

logger.info('Background Jobs system initialized with BullMQ and Redis');

module.exports = {
  emailQueue,
  notificationQueue,
  cleanupQueue,
  communicationQueue,
};
