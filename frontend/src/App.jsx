import React, { useState, useEffect } from 'react';

export default function App() {
  const [products, setProducts] = useState([]);
  const [user, setUser] = useState(null);
  const [view, setView] = useState('products');
  const [username, setUsername] = useState('');
  const [message, setMessage] = useState('');
  const [orders, setOrders] = useState([]);
  const [blogs, setBlogs] = useState([]);
  const [selectedBlog, setSelectedBlog] = useState(null);
  const [testMode, setTestMode] = useState('app'); // 'app' | 'direct' | 'secretCode'

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => setProducts(data))
      .catch(() => setMessage('Error loading products'));

    fetch('/api/me', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setUser(data.user))
      .catch(() => {});
  }, []);

  const getHeaders = () => {
    if (testMode === 'secretCode') {
      return { 'secretCode': 'ALLOWED' };
    }
    if (testMode === 'direct') {
      return {}; // Simulates external request without our app header
    }
    // Default: Authenticated as our web application
    return { 'x-app-source': 'secure-api-app' };
  };

  const loadBlogs = async () => {
    setMessage('');
    try {
      const res = await fetch('/api/blogs', {
        headers: getHeaders(),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setBlogs(data);
        setSelectedBlog(null);
        setView('blogs');
      } else {
        setMessage(`Security Block: ${data.error} (HTTP ${res.status})`);
      }
    } catch (err) {
      setMessage(`Network error: ${err.message}`);
    }
  };

  const openBlog = async (id) => {
    try {
      const res = await fetch(`/api/blogs/${id}`, {
        headers: getHeaders(),
        credentials: 'include'
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedBlog(data);
        setView('blogDetail');
      } else {
        setMessage(`Security Block: ${data.error} (HTTP ${res.status})`);
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
      setMessage(`Logged in as ${data.user.username}`);
      setView('products');
    }
  };

  const handleLogout = async () => {
    await fetch('/api/logout', { method: 'POST', credentials: 'include' });
    setUser(null);
    setMessage('Logged out');
    setView('products');
  };

  const handleOrder = async (product) => {
    if (!user) {
      setMessage('Login required! Please log in to order.');
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
      setMessage(`Success! Order placed for ${product.name} ($${product.price})`);
    } else {
      setMessage(data.error || 'Failed to place order');
    }
  };

  const loadOrders = async () => {
    const res = await fetch('/api/orders', { credentials: 'include' });
    if (res.ok) {
      const data = await res.json();
      setOrders(data);
      setView('orders');
    } else {
      setMessage('Please log in to view orders');
      setView('login');
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 840, margin: '20px auto', padding: '0 16px' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: 12 }}>
        <h2 style={{ margin: 0, cursor: 'pointer' }} onClick={() => setView('products')}>Store & Blog</h2>
        <nav style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button onClick={() => setView('products')}>Products</button>
          <button onClick={loadBlogs}>Blogs</button>
          {user ? (
            <>
              <button onClick={loadOrders}>My Orders</button>
              <span>Hello, <b>{user.username}</b></span>
              <button onClick={handleLogout}>Logout</button>
            </>
          ) : (
            <button onClick={() => setView('login')}>Login</button>
          )}
        </nav>
      </header>

      {/* Security validation bar */}
      <div style={{ background: '#f5f5f5', padding: '10px 14px', borderRadius: 6, margin: '14px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, fontSize: 13 }}>
        <div>
          <strong>Blog Security:</strong> Open for our app only (no user auth needed) • Direct external hits require <code>secretCode: ALLOWED</code>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span>Test Access As:</span>
          <select value={testMode} onChange={(e) => setTestMode(e.target.value)} style={{ padding: '4px 8px' }}>
            <option value="app">Our Web App (Allowed)</option>
            <option value="secretCode">secretCode: ALLOWED Header (Allowed)</option>
            <option value="direct">Direct / External (Blocked - 401)</option>
          </select>
        </div>
      </div>

      {message && <div style={{ background: message.includes('Block') ? '#ffebee' : '#eef', color: message.includes('Block') ? '#c62828' : '#1a237e', padding: 10, margin: '14px 0', borderRadius: 4 }}>{message}</div>}

      {view === 'login' && (
        <div style={{ maxWidth: 360, margin: '40px auto', border: '1px solid #ccc', padding: 24, borderRadius: 8 }}>
          <h3>User Login</h3>
          <form onSubmit={handleLogin}>
            <label style={{ display: 'block', marginBottom: 8 }}>Username:</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your username"
              style={{ width: '100%', padding: 8, boxSizing: 'border-box', marginBottom: 16 }}
              required
            />
            <button type="submit" style={{ width: '100%', padding: 10, background: '#0066cc', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
              Log In
            </button>
          </form>
        </div>
      )}

      {view === 'products' && (
        <div>
          <h3>Product Catalog ({products.length} items from DB)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
            {products.map((p) => (
              <div key={p._id} style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <h4 style={{ margin: '0 0 8px' }}>{p.name}</h4>
                  <p style={{ color: '#666', fontSize: 13, margin: '0 0 12px' }}>{p.description}</p>
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 8 }}>${p.price}</div>
                  <button onClick={() => handleOrder(p)} style={{ width: '100%', padding: 8, background: '#28a745', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                    Order Now
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'orders' && (
        <div>
          <h3>My Orders ({orders.length})</h3>
          {orders.length === 0 ? <p>No orders placed yet.</p> : (
            <ul>
              {orders.map((o) => (
                <li key={o._id} style={{ marginBottom: 8 }}>
                  <strong>{o.productName}</strong> - ${o.price} (Placed: {new Date(o.createdAt).toLocaleString()})
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {view === 'blogs' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3>Protected Blogs ({blogs.length})</h3>
            <button onClick={loadBlogs} style={{ padding: '4px 10px', cursor: 'pointer' }}>Refresh</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {blogs.map((b) => (
              <div
                key={b._id}
                onClick={() => openBlog(b._id)}
                style={{ border: '1px solid #ddd', padding: 16, borderRadius: 8, cursor: 'pointer', background: '#fafafa' }}
              >
                <h4 style={{ margin: '0 0 6px', color: '#0066cc' }}>{b.title}</h4>
                <p style={{ margin: '0 0 6px', color: '#555', fontSize: 14 }}>{b.content.slice(0, 100)}...</p>
                <small style={{ color: '#888' }}>By {b.author} • {new Date(b.createdAt).toLocaleDateString()}</small>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'blogDetail' && selectedBlog && (
        <div style={{ border: '1px solid #ddd', padding: 24, borderRadius: 8, background: '#fff' }}>
          <button onClick={() => setView('blogs')} style={{ marginBottom: 16, padding: '6px 12px', cursor: 'pointer' }}>
            ← Back to Blogs
          </button>
          <h2 style={{ marginTop: 0 }}>{selectedBlog.title}</h2>
          <p style={{ color: '#888', fontSize: 14 }}>By {selectedBlog.author} • {new Date(selectedBlog.createdAt).toLocaleDateString()}</p>
          <div style={{ lineHeight: 1.6, fontSize: 16, marginTop: 16 }}>{selectedBlog.content}</div>
        </div>
      )}
    </div>
  );
}
