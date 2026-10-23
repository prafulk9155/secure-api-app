import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  ShieldCheck,
  ShoppingBag,
  BookOpen,
  Terminal,
  Package,
  User,
  LogOut,
  ArrowRight,
  Lock,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ExternalLink
} from 'lucide-react';
import { secureFetch } from './api/secureFetch';
import AttackLab from './AttackLab';

export default function App() {
  const [products, setProducts] = useState([]);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('lab'); // default to 'lab' for showcase impact!
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [orders, setOrders] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [lastSignature, setLastSignature] = useState(null);

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(() => {});

    fetch('/api/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setUser(data.user))
      .catch(() => {});
  }, []);

  const loadBlogs = async () => {
    setMessage('');
    try {
      const { res, data } = await secureFetch('/api/blogs');
      if (res.ok) {
        setBlogs(data);
        setSelectedBlog(null);
        setView('blogs');
      } else {
        setMessage(`Security Block: ${data?.reason || data?.error} (HTTP ${res.status})`);
      }
    } catch (err) {
      setMessage(`Network error: ${err.message}`);
    }
  };

  const openBlog = async (id) => {
    try {
      const { res, data } = await secureFetch(`/api/blogs/${id}`);
      if (res.ok) {
        setSelectedBlog(data);
        setView('blogDetail');
      } else {
        setMessage(`Security Block: ${data?.reason || data?.error} (HTTP ${res.status})`);
      }
    } catch (err) {
      setMessage(`Network error: ${err.message}`);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
      credentials: 'include'
    });
    if (res.ok) {
      const data = await res.json();
      setUser(data.user);
      setMessage(`Welcome back, ${data.user.username}`);
      setView('products');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    setMessage('Session terminated');
    setView('products');
  };

  const handleOrder = async (product) => {
    if (!user) {
      setMessage('Login required: Please authenticate to place an order.');
      setView('login');
      return;
    }
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productName: product.name, price: product.price }),
      credentials: 'include'
    });
    const data = await res.json();
    if (res.ok) {
      setMessage(`Order confirmed for ${product.name} ($${product.price})`);
    } else {
      setMessage(data.error || 'Order placement failed');
    }
  };

  const loadOrders = async () => {
    const res = await fetch('/api/orders', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setOrders(data);
      setView('orders');
    } else {
      setMessage('Login required to view order history');
      setView('login');
    }
  };

  const navItems = [
    { id: 'lab', label: 'Attack Lab', icon: Terminal, highlight: true },
    { id: 'blogs', label: 'Protected Blogs', icon: BookOpen, action: loadBlogs },
    { id: 'products', label: 'Product Catalog', icon: ShoppingBag },
    { id: 'orders', label: 'My Orders', icon: Package, action: loadOrders }
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Security Banner */}
      <div style={{ background: 'rgba(15, 23, 42, 0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '6px 20px', fontSize: 12 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#94a3b8' }}>
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 8px #10b981' }}></span>
            <span>API Security Active:</span>
            <span style={{ color: '#e2e8f0', fontWeight: 600 }}>HMAC-SHA256 • One-Time Nonces • IP/UA Binding</span>
          </div>
          <div style={{ display: 'flex', gap: 16, color: '#64748b' }}>
            <span>Partner Bypass: <code style={{ color: '#38bdf8' }}>secretCode: ALLOWED</code></span>
            <span>Token TTL: <b style={{ color: '#cbd5e1' }}>10m</b></span>
          </div>
        </div>
      </div>

      {/* Main Showcase Navigation */}
      <header className="glass-panel" style={{ margin: '16px auto 0', maxWidth: 1100, width: 'calc(100% - 32px)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div
          onClick={() => setView('lab')}
          style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
        >
          <div style={{ width: 38, height: 38, borderRadius: 10, background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 14px rgba(79,70,229,0.4)' }}>
            <Shield size={20} color="#fff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: 18, fontFamily: 'Outfit, sans-serif', fontWeight: 700, letterSpacing: '-0.02em' }}>
                AegisGuard
              </h1>
              <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', fontWeight: 700 }}>
                SHOWCASE
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 11, color: '#94a3b8' }}>API Request Signing & Anti-Scraping Defense</p>
          </div>
        </div>

        {/* Tab Switcher with animated pill */}
        <nav style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'rgba(15,23,42,0.6)', padding: 4, borderRadius: 10, border: '1px solid rgba(255,255,255,0.06)' }}>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = view === item.id || (item.id === 'blogs' && view === 'blogDetail');
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.action) item.action();
                  else setView(item.id);
                }}
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 14px',
                  borderRadius: 7,
                  border: 'none',
                  background: 'transparent',
                  color: isActive ? '#fff' : '#94a3b8',
                  fontSize: 13,
                  fontWeight: isActive ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'color 0.2s ease'
                }}
              >
                {isActive && (
                  <motion.div
                    layoutId="activePill"
                    style={{
                      position: 'absolute',
                      inset: 0,
                      background: item.highlight ? 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)' : 'rgba(255,255,255,0.1)',
                      borderRadius: 7,
                      zIndex: 0
                    }}
                    transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                  />
                )}
                <span style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Icon size={15} color={isActive ? (item.highlight ? '#fff' : '#38bdf8') : '#64748b'} />
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* User Auth Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <span style={{ color: '#cbd5e1' }}>Hi, <b style={{ color: '#38bdf8' }}>{user.username}</b></span>
              <button
                onClick={handleLogout}
                style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 6, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', cursor: 'pointer', fontSize: 12 }}
              >
                <LogOut size={13} /> Logout
              </button>
            </div>
          ) : (
            <button
              onClick={() => setView('login')}
              style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#e2e8f0', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}
            >
              <User size={14} /> Sign In
            </button>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main style={{ maxWidth: 1100, width: 'calc(100% - 32px)', margin: '20px auto 40px', flex: 1 }}>
        <AnimatePresence mode="wait">
          {message && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                borderRadius: 10,
                marginBottom: 20,
                fontSize: 13,
                background: message.includes('Block') ? 'rgba(239,68,68,0.12)' : 'rgba(16,185,129,0.12)',
                border: message.includes('Block') ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(16,185,129,0.3)',
                color: message.includes('Block') ? '#fca5a5' : '#6ee7b7'
              }}
            >
              {message.includes('Block') ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
              <span>{message}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* View: Attack Lab */}
        {view === 'lab' && <AttackLab />}

        {/* View: Protected Blogs */}
        {view === 'blogs' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 22, fontFamily: 'Outfit, sans-serif' }}>Protected Articles</h3>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
                  Publicly readable by visitors, but automatically signed by this web app using one-time HMAC tokens to stop automated scrapers.
                </p>
              </div>
              <button
                onClick={loadBlogs}
                style={{ padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', cursor: 'pointer', fontSize: 13 }}
              >
                Refresh Articles
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {blogs.map((b, i) => (
                <motion.div
                  key={b._id}
                  whileHover={{ y: -3, borderColor: 'rgba(99,102,241,0.4)' }}
                  onClick={() => openBlog(b._id)}
                  className="glass-panel"
                  style={{ padding: 20, cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', transition: 'border-color 0.2s' }}
                >
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(56,189,248,0.15)', color: '#38bdf8', fontWeight: 600 }}>
                        SECURE ARTICLE
                      </span>
                      <small style={{ color: '#64748b' }}>{new Date(b.createdAt).toLocaleDateString()}</small>
                    </div>
                    <h4 style={{ margin: '0 0 8px', fontSize: 17, color: '#f8fafc', fontWeight: 600 }}>{b.title}</h4>
                    <p style={{ margin: '0 0 16px', color: '#94a3b8', fontSize: 13, lineHeight: 1.5 }}>
                      {b.content.slice(0, 110)}...
                    </p>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontSize: 12, color: '#64748b' }}>By {b.author}</span>
                    <span style={{ fontSize: 12, color: '#818cf8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                      Read Story <ArrowRight size={13} />
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* View: Blog Detail */}
        {view === 'blogDetail' && selectedBlog && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="glass-panel"
            style={{ padding: 32 }}
          >
            <button
              onClick={() => setView('blogs')}
              style={{ marginBottom: 20, padding: '8px 14px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#cbd5e1', cursor: 'pointer', fontSize: 13 }}
            >
              ← Back to Blogs
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: 'rgba(16,185,129,0.15)', color: '#34d399', fontWeight: 600 }}>
                VERIFIED AUTHENTIC
              </span>
              <span style={{ color: '#64748b', fontSize: 13 }}>By {selectedBlog.author} • {new Date(selectedBlog.createdAt).toLocaleDateString()}</span>
            </div>
            <h1 style={{ margin: '10px 0 20px', fontSize: 28, fontFamily: 'Outfit, sans-serif' }}>{selectedBlog.title}</h1>
            <div style={{ lineHeight: 1.8, fontSize: 16, color: '#cbd5e1', whiteSpace: 'pre-line' }}>
              {selectedBlog.content}
            </div>

            <div style={{ marginTop: 32, padding: 16, borderRadius: 10, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 12, color: '#94a3b8' }}>
              🛡️ <b>Security Proof:</b> Fetched via single-use HMAC-SHA256 signature calculated on client WebCrypto API and verified against server secret.
            </div>
          </motion.div>
        )}

        {/* View: Products */}
        {view === 'products' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.3 }}
          >
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 22, fontFamily: 'Outfit, sans-serif' }}>Product Catalog ({products.length} Items)</h3>
              <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
                MongoDB seeded hardware items. Orders require authentication to demonstrate protected transactional routes.
              </p>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
              {products.map((p) => (
                <motion.div
                  key={p._id}
                  whileHover={{ y: -3 }}
                  className="glass-panel"
                  style={{ padding: 18, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}
                >
                  <div>
                    <h4 style={{ margin: '0 0 6px', fontSize: 16, color: '#f8fafc' }}>{p.name}</h4>
                    <p style={{ color: '#94a3b8', fontSize: 13, margin: '0 0 14px', lineHeight: 1.4 }}>{p.description}</p>
                  </div>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <span style={{ fontSize: 12, color: '#64748b' }}>Price</span>
                      <span style={{ fontWeight: 700, fontSize: 20, color: '#38bdf8', fontFamily: 'JetBrains Mono' }}>${p.price}</span>
                    </div>
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleOrder(p)}
                      className="glow-btn"
                      style={{ width: '100%', padding: '10px 0', fontSize: 13 }}
                    >
                      Order Now
                    </motion.button>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* View: Orders */}
        {view === 'orders' && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            className="glass-panel"
            style={{ padding: 24 }}
          >
            <h3 style={{ margin: '0 0 16px', fontSize: 20, fontFamily: 'Outfit, sans-serif' }}>My Order History ({orders.length})</h3>
            {orders.length === 0 ? (
              <p style={{ color: '#94a3b8' }}>No orders placed yet. Select an item in the Product Catalog to place an order.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {orders.map((o) => (
                  <div key={o._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderRadius: 8, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{o.productName}</div>
                      <small style={{ color: '#64748b' }}>Placed: {new Date(o.createdAt).toLocaleString()}</small>
                    </div>
                    <div style={{ fontWeight: 700, color: '#34d399', fontFamily: 'JetBrains Mono' }}>
                      ${o.price}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* View: Login Modal */}
        {view === 'login' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="glass-panel"
            style={{ maxWidth: 380, margin: '40px auto', padding: 28 }}
          >
            <div style={{ textAlign: 'center', marginBottom: 20 }}>
              <div style={{ width: 44, height: 44, margin: '0 auto 12px', borderRadius: 12, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Lock size={22} color="#818cf8" />
              </div>
              <h3 style={{ margin: 0, fontSize: 20, fontFamily: 'Outfit, sans-serif' }}>Authenticate Session</h3>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: '#94a3b8' }}>Login to access protected order creation routes</p>
            </div>

            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, color: '#cbd5e1' }}>Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. praful"
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 8, background: 'rgba(15,23,42,0.8)', border: '1px solid rgba(255,255,255,0.12)', color: '#fff', fontSize: 14 }}
                  required
                />
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                className="glow-btn"
                style={{ width: '100%', padding: '12px 0', fontSize: 14, marginBottom: 12 }}
              >
                Sign In
              </motion.button>

              <button
                type="button"
                onClick={() => setUsername('praful')}
                style={{ width: '100%', padding: '8px 0', borderRadius: 6, background: 'transparent', border: '1px dashed rgba(255,255,255,0.15)', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}
              >
                Auto-fill "praful"
              </button>
            </form>
          </motion.div>
        )}
      </main>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '20px', textAlign: 'center', fontSize: 12, color: '#64748b' }}>
        AegisGuard Showcase • Cryptographic Request Integrity • Production HMAC-SHA256 Implementation
      </footer>
    </div>
  );
}
