const { sequelize, connectDB } = require('./src/config/db');

async function fixUnitTable() {
  try {
    await connectDB();
    console.log('Fixing units_unit table...');
    
    try {
      await sequelize.query('ALTER TABLE units_unit ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP;');
      console.log('Added created_at');
    } catch (e) {
      console.log('created_at might already exist:', e.message);
    }

    try {
      await sequelize.query('ALTER TABLE units_unit ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;');
      console.log('Added updated_at');
    } catch (e) {
      console.log('updated_at might already exist:', e.message);
    }

    try {
      await sequelize.query('ALTER TABLE units_unit ADD COLUMN deleted_at DATETIME NULL;');
      console.log('Added deleted_at');
    } catch (e) {
      console.log('deleted_at might already exist:', e.message);
    }

    console.log('Fix complete!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

fixUnitTable();
