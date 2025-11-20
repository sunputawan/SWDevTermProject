const fs = require('fs');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Load env based on NODE_ENV (defaults to test for this script)
const envName = process.env.NODE_ENV || 'test';
const envPath = `./config/config.${envName}.env`;
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config({ path: './config/config.env' });
}

const connectOpts = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 30000,
};

async function clearDb() {
  try {
    // Safety checks: only allow running against test env and a URI that contains 'test'
    if (envName !== 'test') {
      console.error('Refusing to clear DB: NODE_ENV is not "test"');
      process.exit(1);
    }
    if (!process.env.MONGO_URI || !process.env.MONGO_URI.includes('test')) {
      console.error('Refusing to clear DB: MONGO_URI does not look like a test DB:', process.env.MONGO_URI);
      process.exit(1);
    }
    console.log('Connecting to', process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI, connectOpts);
    console.log('Connected to MongoDB, preparing to drop the test database...');

    // Determine the current database name from the connection and ensure it
    // contains 'test' as an extra safety guard before dropping the whole DB.
    const dbName = (mongoose.connection && mongoose.connection.db && mongoose.connection.db.databaseName) || mongoose.connection.name;
    if (!dbName) {
      throw new Error('Unable to determine connected database name');
    }

    if (!dbName.includes('test')) {
      console.error('Refusing to drop database: connected DB name does not include "test":', dbName);
      process.exit(1);
    }

    console.log('Dropping database:', dbName);
    try {
      await mongoose.connection.db.dropDatabase();
      console.log('Dropped database:', dbName);
    } catch (err) {
      console.error('Error dropping database:', err);
      throw err;
    }

    console.log('Clear operation completed');
  } catch (err) {
    console.error('Error clearing DB:', err);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB');
  }
}

clearDb();
