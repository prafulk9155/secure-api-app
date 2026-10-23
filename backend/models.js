const mongoose = require('mongoose');

const Product = mongoose.model('Product', new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  description: { type: String, default: '' }
}));

const Order = mongoose.model('Order', new mongoose.Schema({
  user: { type: String, required: true },
  productName: { type: String, required: true },
  price: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
}));

const Blog = mongoose.model('Blog', new mongoose.Schema({
  title: { type: String, required: true },
  content: { type: String, required: true },
  author: { type: String, default: 'Admin' },
  createdAt: { type: Date, default: Date.now }
}));

// Partners that call public APIs server-to-server with a secret code.
// Only the sha256 of the code is stored; the plain code is printed once by scripts/seedClients.js.
const ApiClient = mongoose.model('ApiClient', new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  codeHash: { type: String, required: true, index: true },
  plan: { type: String, default: 'basic' },
  limitPerMin: { type: Number, default: 30 },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
}));

// One row per guarded request: the channel it came through, or why it was rejected.
// Rows expire after 7 days via a TTL index.
const RequestLog = mongoose.model('RequestLog', new mongoose.Schema({
  channel: { type: String, enum: ['web', 'secret', 'rejected'], required: true },
  reason: { type: String, default: 'ok' },
  wouldBlock: { type: Boolean, default: false }, // GUARD_MODE=log lets the request through but flags it
  jti: String,
  clientName: String,
  ip: String,
  method: String,
  path: String,
  at: { type: Date, default: Date.now, expires: 7 * 24 * 60 * 60 }
}));

module.exports = { Product, Order, Blog, ApiClient, RequestLog };
