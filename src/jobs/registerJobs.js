const logger = require('../utils/logger');

// Queues
const emailQueue = require('./queues/email.queue');
const notificationQueue = require('./queues/notification.queue');
const cleanupQueue = require('./queues/cleanup.queue');
const communicationQueue = require('./queues/communication.queue');
const smsQueue = require('./queues/sms.queue');
const pushQueue = require('./queues/push.queue');
const outboxQueue = require('./queues/outbox.queue');

// Workers (Require them to initialize)
require('./workers/email.worker');
require('./workers/notification.worker');
require('./workers/cleanup.worker');
require('./workers/communication.worker');
require('./workers/sms.worker');
require('./workers/outbox.worker');

logger.info('Background Jobs system initialized with BullMQ and Redis');

module.exports = {
  emailQueue,
  notificationQueue,
  cleanupQueue,
  communicationQueue,
  smsQueue,
  pushQueue,
  outboxQueue,
};
