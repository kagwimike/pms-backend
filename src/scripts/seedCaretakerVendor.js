const bcrypt = require('bcryptjs');
const { sequelize } = require('../config/db');
const User = require('../models/User');
const Vendor = require('../models/Vendor');

const createTestUsers = async () => {
  try {
    await sequelize.authenticate();
    
    // Create Caretaker
    const caretakerPassword = await bcrypt.hash('password123', 10);
    const caretaker = await User.findOrCreate({
      where: { email: 'caretaker@pmspro.com' },
      defaults: {
        username: 'caretaker_demo',
        password: caretakerPassword,
        role: 'CARETAKER',
        first_name: 'Mike',
        last_name: 'Caretaker',
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    console.log('Caretaker created:', caretaker[0].email);

    // Create Vendor
    const vendorPassword = await bcrypt.hash('password123', 10);
    const vendorUser = await User.findOrCreate({
      where: { email: 'vendor@pmspro.com' },
      defaults: {
        username: 'vendor_demo',
        password: vendorPassword,
        role: 'VENDOR',
        first_name: 'Alice',
        last_name: 'Plumber',
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    console.log('Vendor User created:', vendorUser[0].email);

    // Create Vendor Profile
    await Vendor.findOrCreate({
      where: { email: 'vendor@pmspro.com' },
      defaults: {
        name: 'ABC Plumbing',
        phone: '123-456-7890',
        user_id: vendorUser[0].id,
        created_at: new Date(),
        updated_at: new Date()
      }
    });
    console.log('Vendor Profile created for ABC Plumbing');

    process.exit(0);
  } catch (error) {
    console.error('Error creating test users:', error);
    process.exit(1);
  }
};

createTestUsers();
