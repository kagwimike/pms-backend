const SmsDispatcher = require('./sms');
const EmailDispatcher = require('./email');
const PushDispatcher = require('./push');

module.exports = {
  SmsDispatcher,
  EmailDispatcher,
  PushDispatcher
};
