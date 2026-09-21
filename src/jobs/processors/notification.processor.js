const logger = require('../../utils/logger');
const Notification = require('../../models/Notification');

const notificationProcessor = async (job) => {
  logger.info(`Processing notification job ${job.id}`);
  const { userId, title, message, type } = job.data;

  try {
    if (userId) {
      await Notification.create({
        user_id: userId,
        title,
        message,
        type: type || 'INFO',
      });
      logger.info(`In-app notification saved for user ${userId}`);
    }
  } catch (err) {
    logger.error(`Error processing notification job ${job.id}: ${err.message}`);
    throw err;
  }
};

module.exports = notificationProcessor;
