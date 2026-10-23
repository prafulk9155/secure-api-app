// Creates (or rotates) a partner API client and prints its secret code once.
// Usage: node scripts/seedClients.js [name] [limitPerMin]
const crypto = require('crypto');
const mongoose = require('mongoose');
const connectDB = require('../api/db');
const { ApiClient } = require('../models');
const { sha256 } = require('../security/clientIp');

async function main() {
  const name = process.argv[2] || 'demo-partner';
  const limitPerMin = Number(process.argv[3]) || 5;
  const code = `sc_${crypto.randomBytes(24).toString('base64url')}`;

  await connectDB();
  await ApiClient.findOneAndUpdate(
    { name },
    { name, codeHash: sha256(code), plan: 'basic', limitPerMin, active: true },
    { upsert: true }
  );

  console.log(`\nPartner "${name}" ready (limit ${limitPerMin}/min). Secret code - shown only now:\n\n  ${code}\n`);
  console.log(`Try it:\n  curl -H "x-secret-code: ${code}" http://localhost:5000/api/blogs\n`);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
