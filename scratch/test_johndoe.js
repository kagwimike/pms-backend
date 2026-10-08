const { sequelize } = require('../src/config/db');
const User = require('../src/models/User');
const Lease = require('../src/models/Lease');
const Unit = require('../src/models/Unit');
const Property = require('../src/models/Property');

async function test() {
  await sequelize.authenticate();
  
  // Find johndoe
  const john = await User.findOne({ where: { username: 'johndoe' } });
  console.log('John:', john ? john.toJSON() : 'Not found');
  
  if (john) {
    const leases = await Lease.findAll({ where: { tenant_id: john.id } });
    console.log('Leases for John:', leases.map(l => l.toJSON()));
    
    for (let lease of leases) {
      const unit = await Unit.findByPk(lease.unit_id);
      console.log('Unit:', unit ? unit.toJSON() : 'Not found');
      
      if (unit) {
        const prop = await Property.findByPk(unit.property_id);
        console.log('Property:', prop ? prop.toJSON() : 'Not found');
      }
    }
  }
  
  process.exit(0);
}
test();
