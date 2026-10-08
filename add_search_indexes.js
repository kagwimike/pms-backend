const { sequelize } = require('./src/config/db');

async function addIndexes() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    // Add indexes for search
    await sequelize.query('CREATE INDEX idx_property_name ON properties(name);').catch(() => console.log('Index idx_property_name already exists'));
    await sequelize.query('CREATE INDEX idx_unit_number ON units(unit_number);').catch(() => console.log('Index idx_unit_number already exists'));
    await sequelize.query('CREATE INDEX idx_user_username ON accounts_user(username);').catch(() => console.log('Index idx_user_username already exists'));
    await sequelize.query('CREATE INDEX idx_user_email ON accounts_user(email);').catch(() => console.log('Index idx_user_email already exists'));
    await sequelize.query('CREATE INDEX idx_user_phone ON accounts_user(phone);').catch(() => console.log('Index idx_user_phone already exists'));
    await sequelize.query('CREATE INDEX idx_maintenance_title ON maintenance_requests(title);').catch(() => console.log('Index idx_maintenance_title already exists'));
    await sequelize.query('CREATE INDEX idx_vendor_name ON vendors(name);').catch(() => console.log('Index idx_vendor_name already exists'));
    await sequelize.query('CREATE INDEX idx_invoice_number ON invoices(invoice_number);').catch(() => console.log('Index idx_invoice_number already exists'));
    await sequelize.query('CREATE INDEX idx_payment_reference ON payments(transaction_reference);').catch(() => console.log('Index idx_payment_reference already exists'));

    console.log('Indexes added successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Error adding indexes:', error);
    process.exit(1);
  }
}

addIndexes();
