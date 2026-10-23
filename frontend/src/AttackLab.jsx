import React, { useState } from 'react';
import { secureFetch, signRequest, getLastRequest } from './api/secureFetch';

// Each attack rebuilds what someone could do with a request copied from DevTools,
// and shows what the server answers.
async function raw(path, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(path, { method, headers, body, credentials: 'include' });
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

const json = { 'Content-Type': 'application/json' };

const ATTACKS = [
  {
    id: 'normal',
    label: 'Normal signed call',
    expect: '200',
    run: async () => {
      const { res, data } = await secureFetch('/api/blogs');
      return { status: res.status, data: Array.isArray(data) ? `${data.length} blogs` : data };
    }
  },
  {
    id: 'replay',
    label: 'Replay last request exactly (copied cURL)',
    expect: '401 nonce_reused',
    run: async () => {
      const last = getLastRequest();
      if (!last) return { status: '-', data: 'Make a normal call first' };
      return raw(last.path, { method: last.method, headers: last.headers, body: last.body || undefined });
    }
  },
  {
    id: 'newNonce',
    label: 'Replay with a fresh nonce, old signature',
    expect: '401 bad_signature',
    run: async () => {
      const last = getLastRequest();
      if (!last) return { status: '-', data: 'Make a normal call first' };
      const headers = { ...last.headers, 'x-nonce': `forged${Date.now()}abcdefgh` };
      return raw(last.path, { method: last.method, headers, body: last.body || undefined });
    }
  },
  {
    id: 'tamperUrl',
    label: 'Sign /api/blogs, send /api/blogs?limit=10000',
    expect: '401 bad_signature',
    run: async () => {
      const headers = await signRequest('GET', '/api/blogs');
      return raw('/api/blogs?limit=10000', { headers });
    }
  },
  {
    id: 'tamperBody',
    label: 'Sign one subscribe body, send another',
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
    label: 'Validly signed, but timestamp 5 minutes old',
    expect: '401 stale_timestamp',
    run: async () => raw('/api/blogs', { headers: await signRequest('GET', '/api/blogs', '', { tsOffsetSec: -300 }) })
  },
  {
    id: 'noToken',
    label: 'Plain call, no web token (Postman / script)',
    expect: '401 missing_token',
    run: () => raw('/api/blogs')
  },
  {
    id: 'subscribe',
    label: 'Signed POST /api/subscribe',
    expect: '200 channel web',
    run: async () => {
      const { res, data } = await secureFetch('/api/subscribe', { method: 'POST', body: { email: 'me@example.com' } });
      return { status: res.status, data };
    }
  }
];

const cell = { padding: '6px 8px', borderBottom: '1px solid #eee', fontSize: 13, verticalAlign: 'top' };

export default function AttackLab() {
  const [results, setResults] = useState({});
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
    for (const attack of ATTACKS) await run(attack);
  };

  // Fires a burst so the per-partner limit (seedClients default 5/min) shows up as 429s.
  const callAsPartner = async () => {
    const statuses = [];
    for (let i = 0; i < 7; i++) {
      const { status, data } = await raw('/api/blogs', { headers: { 'x-secret-code': code } });
      statuses.push(status === 200 ? 200 : `${status} ${data?.reason || ''}`.trim());
    }
    setPartner(statuses);
  };

  const loadLogs = async () => setLogs(await raw('/api/admin/logs'));

  const describe = (out) => {
    if (!out || out.data === undefined) return '';
    if (typeof out.data === 'string') return out.data;
    return out.data?.reason || JSON.stringify(out.data);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Attack Lab</h3>
        <button onClick={runAll}>Run all in order</button>
      </div>
      <p style={{ fontSize: 13, color: '#555', marginTop: 0 }}>
        Every request to <code>/api/blogs</code> and <code>/api/subscribe</code> must carry a short-lived web token and a
        one-time HMAC signature over method, URL, timestamp, nonce and body. Copying a request from DevTools gives you
        one request that has already been used.
      </p>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', background: '#f5f5f5' }}>
            <th style={cell}>Scenario</th><th style={cell}>Expected</th><th style={cell}>Got</th><th style={cell} />
          </tr>
        </thead>
        <tbody>
          {ATTACKS.map((a) => {
            const out = results[a.id];
            const ok = out && String(out.status) === a.expect.split(' ')[0];
            return (
              <tr key={a.id}>
                <td style={cell}>{a.label}</td>
                <td style={cell}><code>{a.expect}</code></td>
                <td style={{ ...cell, color: !out ? '#999' : ok ? '#2e7d32' : '#c62828' }}>
                  {out ? <><b>{out.status}</b> {describe(out)}</> : '-'}
                </td>
                <td style={cell}><button onClick={() => run(a)}>Run</button></td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <h4 style={{ marginTop: 24 }}>Partner access (secret code)</h4>
      <p style={{ fontSize: 13, color: '#555' }}>
        Create a code with <code>npm run seed:client</code> in <code>backend/</code>. Partner calls are tracked per client and rate limited.
      </p>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="sc_..." style={{ flex: 1, padding: 6 }} />
        <button onClick={callAsPartner} disabled={!code}>Call 7 times</button>
      </div>
      {partner && <div style={{ fontSize: 13, marginTop: 8 }}>Results: {partner.join(' | ')}</div>}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
        <h4 style={{ margin: 0 }}>Usage log (last hour)</h4>
        <button onClick={loadLogs}>Load</button>
      </div>
      {logs && logs.status !== 200 && <p style={{ color: '#c62828' }}>HTTP {logs.status}: {describe(logs)}</p>}
      {logs?.status === 200 && (
        <>
          <p style={{ fontSize: 13 }}>Guard mode: <b>{logs.data.guardMode}</b></p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', background: '#f5f5f5' }}>
                <th style={cell}>Channel</th><th style={cell}>Reason</th><th style={cell}>Client</th><th style={cell}>Count</th>
              </tr>
            </thead>
            <tbody>
              {logs.data.summary.map((s, i) => (
                <tr key={i}>
                  <td style={cell}>{s.channel}</td><td style={cell}>{s.reason}</td>
                  <td style={cell}>{s.client || '-'}</td><td style={cell}>{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
