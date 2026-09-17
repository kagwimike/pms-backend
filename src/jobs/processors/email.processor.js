const logger = require('../../utils/logger');

const emailProcessor = async (job) => {
  logger.info(`Processing email job ${job.id}`);
  const { to, subject, text } = job.data;
  
  // Here we would integrate with an email service (e.g., Nodemailer, SendGrid)
  logger.info(`Sending email to ${to} with subject: ${subject}`);
  
  // Simulate async work
  return new Promise((resolve) => setTimeout(resolve, 1000));
};

module.exports = emailProcessor;
