const { sequelize } = require('../config/db');

const NotificationTemplate = require('../models/NotificationTemplate');
const MessageLog = require('../models/MessageLog');
const ChatSession = require('../models/ChatSession');
const ChatMessage = require('../models/ChatMessage');

const syncNewModels = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connected...');
    
    await NotificationTemplate.sync({ force: false, alter: true });
    await MessageLog.sync({ force: false, alter: true });
    await ChatSession.sync({ force: false, alter: true });
    await ChatMessage.sync({ force: false, alter: true });
    
    console.log('New communication models synchronized successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error syncing new models:', error);
    process.exit(1);
  }
};

syncNewModels();
