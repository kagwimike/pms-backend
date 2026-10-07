const { sequelize } = require('../config/db');
const User = require('../models/User');

const updateModels = async () => {
  try {
    console.log('Syncing User model...');
    await User.sync({ alter: true });
    console.log('User model synchronized successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error syncing User model:', error);
    process.exit(1);
  }
};

updateModels();
