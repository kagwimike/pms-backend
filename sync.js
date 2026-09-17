const { sequelize, connectDB } = require('./src/config/db');
require('./src/models/User');
require('./src/models/Property');
require('./src/models/Unit');
require('./src/models/Booking');
require('./src/models/Amenity');
require('./src/models/Lease');
require('./src/models/Invoice');
require('./src/models/Payment');
require('./src/models/DepositRefund');
require('./src/models/Vendor');
require('./src/models/MaintenanceRequest');
require('./src/models/Inspection');
require('./src/models/Damage');
require('./src/models/Notification');
require('./src/models/Document');
require('./src/models/AuditLog');

async function syncDb() {
  try {
    await connectDB();
    console.log('Syncing models to database...');
    // Use alter: true to automatically update tables without dropping them
    await sequelize.sync({ alter: true });
    console.log('Database sync complete!');
  } catch (error) {
    console.error('Error syncing database:', error);
  } finally {
    process.exit();
  }
}

syncDb();
