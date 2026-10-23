require('dotenv').config();
const mongoose = require('mongoose');

const mongoUri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/hmac_db';

async function connectDB() {
  try {
    await mongoose.connect(mongoUri);
    console.log(`Connected to MongoDB database: ${mongoose.connection.name}`);
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  connectDB().then(() => mongoose.disconnect());
}

module.exports = connectDB;
