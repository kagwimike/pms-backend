const logger = require('../../utils/logger');

const cleanupProcessor = async (job) => {
  logger.info(`Processing cleanup job ${job.id}`);
  const { target } = job.data;
  
  logger.info(`Running scheduled cleanup for target: ${target || 'general'}`);
  return true;
};

module.exports = cleanupProcessor;
