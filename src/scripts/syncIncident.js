const { sequelize } = require('../config/db');
require('../models/User');
require('../models/Property');
require('../models/Incident');

async function syncIncident() {
  try {
    const Incident = require('../models/Incident');
    await Incident.sync({ alter: true });
    console.log('Incident table synced.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to sync Incident table:', error);
    process.exit(1);
  }
}

syncIncident();
