const logger = require('../utils/logger');

// Queues
const emailQueue = require('./queues/email.queue');

// Workers (Require them to initialize)
require('./workers/email.worker');

logger.info('Background Jobs system initialized');

module.exports = {
  emailQueue,
};
