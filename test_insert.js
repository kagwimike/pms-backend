const { connectDB, sequelize } = require('./src/config/db');
const User = require('./src/models/User');

async function testInsert() {
  await connectDB();
  try {
    const user = await User.create({
      username: 'testuser123',
      email: 'testuser123@example.com',
      password: 'password123'
    });
    console.log('Success:', user.toJSON());
  } catch (err) {
    console.error('Error name:', err.name);
    console.error('Error message:', err.message);
    if (err.original) {
      console.error('Original SQL Error:', err.original.sqlMessage);
    }
  } finally {
    process.exit();
  }
}

testInsert();
