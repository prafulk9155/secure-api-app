import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ShieldAlert,
  ShieldCheck,
  Play,
  RotateCcw,
  Key,
  Flame,
  Terminal,
  Activity,
  CheckCircle2,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { secureFetch, signRequest, getLastRequest } from './api/secureFetch';

async function raw(path, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(path, { method, headers, body, credentials: 'include' });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

const json = { 'Content-Type': 'application/json' };

const ATTACKS = [
  {
    id: 'normal',
    label: 'Normal Signed Call',
    desc: 'Authorized call with fresh HMAC signature, nonce & bound 10m token',
    expect: '200',
    run: async () => {
      const { res, data } = await secureFetch('/api/blogs');
      return { status: res.status, data: Array.isArray(data) ? `${data.length} blogs loaded` : data };
    }
  },
  {
    id: 'replay',
    label: 'Replay Attack (Identical cURL)',
    desc: 'Attacker captures request from DevTools and replays with same nonce',
    expect: '401 nonce_reused',
    run: async () => {
      const last = getLastRequest();
      if (!last) return { status: '-', data: 'Execute a normal call first' };
      return raw(last.path, { method: last.method, headers: last.headers, body: last.body || undefined });
    }
  },
  {
    id: 'newNonce',
    label: 'Forged Nonce with Old Signature',
    desc: 'Attacker generates new nonce but cannot forge signature without secret',
    expect: '401 bad_signature',
    run: async () => {
      const last = getLastRequest();
      if (!last) return { status: '-', data: 'Execute a normal call first' };
      const headers = { ...last.headers, 'x-nonce': `forged${Date.now()}abcdefgh` };
      return raw(last.path, { method: last.method, headers, body: last.body || undefined });
    }
  },
  {
    id: 'tamperUrl',
    label: 'Tampered Query Parameters',
    desc: 'Signature computed for /api/blogs but request sent to /api/blogs?limit=10000',
    expect: '401 bad_signature',
    run: async () => {
      const headers = await signRequest('GET', '/api/blogs');
      return raw('/api/blogs?limit=10000', { headers });
    }
  },
  {
    id: 'tamperBody',
    label: 'Tampered POST Payload',
    desc: 'Signature signed for me@example.com but payload changed to attacker@example.com',
    expect: '401 bad_signature',
    run: async () => {
      const signedBody = JSON.stringify({ email: 'me@example.com' });
      const headers = await signRequest('POST', '/api/subscribe', signedBody);
      return raw('/api/subscribe', {
        method: 'POST',
        headers: { ...headers, ...json },
        body: JSON.stringify({ email: 'attacker@example.com' })
      });
    }
  },
  {
    id: 'oldTs',
    label: 'Expired Timestamp (5m Replay)',
    desc: 'Signature computed with timestamp offset by -300 seconds',
    expect: '401 stale_timestamp',
    run: async () => raw('/api/blogs', { headers: await signRequest('GET', '/api/blogs', '', { tsOffsetSec: -300 }) })
  },
  {
    id: 'noToken',
    label: 'Direct Hit Without Token',
    desc: 'External bot or Postman hitting endpoint directly without web token',
    expect: '401 missing_token',
    run: () => raw('/api/blogs')
  },
  {
    id: 'subscribe',
    label: 'Signed POST /api/subscribe',
    desc: 'Secure form submission signed with payload hash & verified on backend',
    expect: '200 channel web',
    run: async () => {
      const { res, data } = await secureFetch('/api/subscribe', { method: 'POST', body: { email: 'me@example.com' } });
      return { status: res.status, data };
    }
  }
];

export default function AttackLab() {
  const [results, setResults] = useState({});
  const [isRunningAll, setIsRunningAll] = useState(false);
  const [code, setCode] = useState('');
  const [partner, setPartner] = useState(null);
  const [logs, setLogs] = useState(null);

  const run = async (attack) => {
    setResults((r) => ({ ...r, [attack.id]: { status: '...' } }));
    try {
      const out = await attack.run();
      setResults((r) => ({ ...r, [attack.id]: out }));
    } catch (err) {
      setResults((r) => ({ ...r, [attack.id]: { status: 'error', data: err.message } }));
    }
  };

  const runAll = async () => {
    setIsRunningAll(true);
    for (const attack of ATTACKS) {
      await run(attack);
      await new Promise(r => setTimeout(r, 200));
    }
    setIsRunningAll(false);
  };

  const callAsPartner = async () => {
    const statuses = [];
    for (let i = 0; i < 7; i++) {
      const { status, data } = await raw('/api/blogs', { headers: { 'x-secret-code': code } });
      statuses.push(status === 200 ? '200 OK' : `${status} ${data?.reason || ''}`.trim());
    }
    setPartner(statuses);
  };

  const loadLogs = async () => setLogs(await raw('/api/admin/logs'));

  const describe = (out) => {
    if (!out || out.data === undefined) return '';
    if (typeof out.data === 'string') return out.data;
    return out.data?.reason || JSON.stringify(out.data);
  };

  const passedCount = Object.keys(results).filter(k => {
    const atk = ATTACKS.find(a => a.id === k);
    const expectedPrefix = atk?.expect.split(' ')[0];
    return String(results[k]?.status) === expectedPrefix;
  }).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.35 }}
      style={{ display: 'flex', flexDirection: 'column', gap: 24 }}
    >
      {/* Header Banner */}
      <div className="glass-panel" style={{ padding: '24px', background: 'linear-gradient(135deg, rgba(30,27,75,0.7) 0%, rgba(15,23,42,0.8) 100%)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <Terminal size={24} color="#818cf8" />
              <h2 style={{ margin: 0, fontSize: 22, fontFamily: 'Outfit, sans-serif' }}>Interactive Security Attack Lab</h2>
              <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 12, background: 'rgba(99,102,241,0.2)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)', fontWeight: 600 }}>
                Live Exploits Test
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: '#94a3b8', maxWidth: 620, lineHeight: 1.5 }}>
              Test common API bypasses: captured cURL replay, forged nonces, parameter injection, expired timestamps, and unauthenticated scrapers. Every request is verified server-side via HMAC-SHA256.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            {Object.keys(results).length > 0 && (
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 12, color: '#94a3b8' }}>Scorecard</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: passedCount === ATTACKS.length ? '#34d399' : '#f59e0b' }}>
                  {passedCount} / {ATTACKS.length} Defended
                </div>
              </div>
            )}
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={runAll}
              disabled={isRunningAll}
              className="glow-btn"
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 20px', fontSize: 14 }}
            >
              <Play size={16} fill="#fff" />
              {isRunningAll ? 'Simulating Attacks...' : 'Run All Scenarios'}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Scenarios Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 14 }}>
        {ATTACKS.map((a, index) => {
          const out = results[a.id];
          const expectedStatus = a.expect.split(' ')[0];
          const isPassed = out && String(out.status) === expectedStatus;
          const isRunning = out && out.status === '...';

          return (
            <motion.div
              key={a.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.04 }}
              className="glass-panel"
              style={{
                padding: '16px 18px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                borderLeft: isPassed ? '3px solid #10b981' : out ? '3px solid #ef4444' : '3px solid rgba(255,255,255,0.1)'
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 8 }}>
                  <h4 style={{ margin: 0, fontSize: 15, color: '#f8fafc', fontWeight: 600 }}>{a.label}</h4>
                  <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono', padding: '2px 6px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: '#cbd5e1' }}>
                    Expect {a.expect}
                  </span>
                </div>
                <p style={{ margin: '0 0 14px', fontSize: 12, color: '#94a3b8', lineHeight: 1.4 }}>{a.desc}</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isRunning ? (
                    <span style={{ color: '#818cf8', fontWeight: 600 }}>Testing...</span>
                  ) : out ? (
                    <>
                      {isPassed ? <CheckCircle2 size={16} color="#10b981" /> : <AlertTriangle size={16} color="#ef4444" />}
                      <span style={{ color: isPassed ? '#34d399' : '#f87171', fontWeight: 600 }}>
                        {out.status} {describe(out)}
                      </span>
                    </>
                  ) : (
                    <span style={{ color: '#64748b' }}>Idle</span>
                  )}
                </div>

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => run(a)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: 'rgba(99, 102, 241, 0.15)',
                    border: '1px solid rgba(99, 102, 241, 0.3)',
                    color: '#c7d2fe',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600
                  }}
                >
                  Simulate
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Partner Access & Rate Limiting Section */}
      <div className="glass-panel" style={{ padding: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Key size={18} color="#38bdf8" />
          <h3 style={{ margin: 0, fontSize: 17, fontFamily: 'Outfit, sans-serif' }}>Partner Access & Token Quota Verification</h3>
        </div>
        <p style={{ fontSize: 13, color: '#94a3b8', margin: '0 0 14px' }}>
          Simulate authorized partner access using a designated <code>secretCode</code>. Tests per-client rate limit quotas (fires a rapid burst of 7 requests to verify 429 throttling).
        </p>
        <div style={{ display: 'flex', gap: 10, maxWidth: 540 }}>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter secret code (or type ALLOWED)"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 8,
              background: 'rgba(15,23,42,0.8)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#fff',
              fontSize: 13,
              fontFamily: 'JetBrains Mono'
            }}
          />
          <button
            onClick={() => setCode('ALLOWED')}
            style={{ padding: '8px 12px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}
          >
            Use "ALLOWED"
          </button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={callAsPartner}
            disabled={!code}
            className="glow-btn"
            style={{ padding: '10px 16px', fontSize: 13 }}
          >
            Burst 7 Calls
          </motion.button>
        </div>

        {partner && (
          <div style={{ marginTop: 14, padding: 12, borderRadius: 8, background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(255,255,255,0.06)', fontSize: 13 }}>
            <strong>Burst Results:</strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {partner.map((st, i) => (
                <span
                  key={i}
                  style={{
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 12,
                    fontFamily: 'JetBrains Mono',
                    background: st.includes('200') ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                    color: st.includes('200') ? '#34d399' : '#f87171',
                    border: st.includes('200') ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)'
                  }}
                >
                  #{i + 1}: {st}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Security Audit Log */}
      <div className="glass-panel" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} color="#a855f7" />
            <h3 style={{ margin: 0, fontSize: 17, fontFamily: 'Outfit, sans-serif' }}>Server Security Rejection & Audit Log</h3>
          </div>
          <button
            onClick={loadLogs}
            style={{ padding: '6px 14px', borderRadius: 6, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)', color: '#cbd5e1', cursor: 'pointer', fontSize: 12 }}
          >
            Fetch Recent Logs
          </button>
        </div>

        {logs && logs.status === 200 && (
          <div>
            <div style={{ fontSize: 13, color: '#94a3b8', marginBottom: 10 }}>
              Active Guard Mode: <b style={{ color: '#38bdf8' }}>{logs.data.guardMode}</b>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'rgba(255,255,255,0.04)', textAlign: 'left', color: '#94a3b8' }}>
                    <th style={{ padding: '8px 12px' }}>Channel</th>
                    <th style={{ padding: '8px 12px' }}>Reason / Status</th>
                    <th style={{ padding: '8px 12px' }}>Client</th>
                    <th style={{ padding: '8px 12px' }}>Count</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.data.summary.map((s, i) => (
                    <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                      <td style={{ padding: '8px 12px' }}><code>{s.channel}</code></td>
                      <td style={{ padding: '8px 12px', color: s.reason === 'ok' ? '#34d399' : '#f87171' }}>{s.reason}</td>
                      <td style={{ padding: '8px 12px' }}>{s.client || '-'}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
