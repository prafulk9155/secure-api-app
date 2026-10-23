require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const connectDB = require('./api/db');
const { Product, Order, Blog, RequestLog } = require('./models');
const config = require('./security/config');
const { getClientIp } = require('./security/clientIp');
const { issueWebSession } = require('./security/webSession');
const { publicRouteGuard } = require('./security/publicRouteGuard');

const app = express();
// req.ip only trusts X-Forwarded-For from these proxies. Set TRUST_PROXY to your load balancer in production.
app.set('trust proxy', process.env.TRUST_PROXY || 'loopback');
app.use(cors({ origin: config.CLIENT_ORIGIN, credentials: true }));
// Keep the exact bytes received so the request signature covers the real body.
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-session-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', maxAge: 24 * 60 * 60 * 1000 }
}));

const seedData = async () => {
  if (await Product.countDocuments() === 0) {
    await Product.insertMany([
      { name: 'Smartphone Pro Max', price: 999, description: 'Flagship OLED phone with 5G' },
      { name: 'Noise-Canceling Headphones', price: 299, description: 'Active noise cancellation & 40h battery' },
      { name: 'Ultrabook Laptop 15"', price: 1299, description: '32GB RAM and 1TB SSD fast processor' },
      { name: 'Mechanical Gaming Keyboard', price: 120, description: 'Tactile switches with RGB backlight' },
      { name: '4K Ultra HD Monitor 27"', price: 399, description: 'IPS panel with HDR 400 support' },
      { name: 'Wireless Ergonomic Mouse', price: 65, description: 'Precision sensor with multi-device Bluetooth' },
      { name: 'Smart Fitness Watch', price: 199, description: 'Heart-rate tracking & GPS built-in' },
      { name: 'Portable Bluetooth Speaker', price: 85, description: 'Waterproof with rich bass audio' },
      { name: 'USB-C Docking Station', price: 110, description: 'Dual HDMI, Ethernet & 100W PD pass' },
      { name: 'High-Speed External SSD 1TB', price: 140, description: 'Up to 1050MB/s USB 3.2 Gen 2' }
    ]);
  }
  if (await Blog.countDocuments() === 0) {
    await Blog.insertMany([
      { title: 'Welcome to Our Store', author: 'Team', content: 'Explore our latest collection of premium hardware, tech gadgets, and audio gear built for creators and professionals.' },
      { title: 'Top 5 Workstation Essentials', author: 'Sarah', content: 'Upgrading your desk setup with an ergonomic mouse, 4K monitor, and noise-canceling audio drastically boosts productivity.' },
      { title: 'High-Speed Storage Guide', author: 'David', content: 'Learn why external NVMe USB-C SSDs give you transfer speeds up to 1050MB/s, ideal for heavy video production and backups.' }
    ]);
  }
};

app.get('/api/products', async (req, res) => {
  const products = await Product.find().limit(10);
  res.json(products);
});

app.post('/api/login', (req, res) => {
  const { username } = req.body;
  if (!username) return res.status(400).json({ error: 'Username required' });
  req.session.user = { username };
  res.json({ success: true, user: req.session.user });
});

app.get('/api/me', (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.post('/api/orders', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Login required to place order' });
  const { productName, price } = req.body;
  const order = await Order.create({ user: req.session.user.username, productName, price });
  res.status(201).json({ success: true, order });
});

app.get('/api/orders', async (req, res) => {
  if (!req.session?.user) return res.status(401).json({ error: 'Login required' });
  const orders = await Order.find({ user: req.session.user.username }).sort({ createdAt: -1 });
  res.json(orders);
});

// --- Public APIs locked to our website (signed web session) or partners (secret code) ---

app.post('/api/web/session', issueWebSession);

app.get('/api/blogs', publicRouteGuard, async (req, res) => {
  const blogs = await Blog.find().sort({ createdAt: -1 });
  res.json(blogs);
});

app.get('/api/blogs/:id', publicRouteGuard, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });
    res.json(blog);
  } catch {
    res.status(400).json({ error: 'Invalid ID' });
  }
});

// Public POST, so the demo can show that the signature also covers the body.
app.post('/api/subscribe', publicRouteGuard, (req, res) => {
  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email required' });
  res.json({ success: true, email, channel: req.apiAccess.channel });
});

// --- Usage view: who called the public APIs and what got rejected ---

function adminOnly(req, res, next) {
  const allowed = config.ADMIN_KEY
    ? req.get('x-admin-key') === config.ADMIN_KEY
    : getClientIp(req) === '127.0.0.1';
  if (!allowed) return res.status(403).json({ error: 'Forbidden' });
  next();
}

app.get('/api/admin/logs', adminOnly, async (req, res) => {
  const since = new Date(Date.now() - 60 * 60 * 1000);
  const summary = await RequestLog.aggregate([
    { $match: { at: { $gte: since } } },
    { $group: { _id: { channel: '$channel', reason: '$reason', client: '$clientName' }, count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  const recent = await RequestLog.find().sort({ at: -1 }).limit(25).lean();
  res.json({
    guardMode: config.GUARD_MODE,
    since,
    summary: summary.map(({ _id, count }) => ({ ..._id, count })),
    recent
  });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = Number(process.env.API_PORT || process.env.PORT) || 5000;

if (require.main === module) {
  connectDB().then(() => {
    seedData();
    app.listen(port, () => console.log(`Backend running on http://localhost:${port} (guard mode: ${config.GUARD_MODE})`));
  });
}

module.exports = app;
