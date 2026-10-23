require('dotenv').config();
const express = require('express');
const cors = require('cors');
const session = require('express-session');
const connectDB = require('./api/db');
const { Product, Order, Blog } = require('./models');
const { secureBlogAccess } = require('./security/securityService');

const app = express();
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json({ verify: (req, res, buf) => { req.rawBody = buf; } }));
app.use(session({
  secret: 'simple-secret-12345',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, secure: false, maxAge: 24 * 60 * 60 * 1000 }
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

app.get('/api/blogs', secureBlogAccess, async (req, res) => {
  const blogs = await Blog.find().sort({ createdAt: -1 });
  res.json(blogs);
});

app.get('/api/blogs/:id', secureBlogAccess, async (req, res) => {
  try {
    const blog = await Blog.findById(req.params.id);
    if (!blog) return res.status(404).json({ error: 'Blog not found' });
    res.json(blog);
  } catch {
    res.status(400).json({ error: 'Invalid ID' });
  }
});

connectDB().then(() => {
  seedData();
  app.listen(5000, () => console.log('Backend running on http://localhost:5000'));
});

module.exports = app;
