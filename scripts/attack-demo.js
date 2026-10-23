// Runs the attacks someone could try against the public APIs and prints what the
// server answers. Start the backend first, then: node scripts/attack-demo.js
// Options: API_BASE=http://localhost:5000  SECRET_CODE=sc_... (from npm run seed:client)
const crypto = require('crypto');

const BASE = process.env.API_BASE || 'http://localhost:5000';
const UA = 'Mozilla/5.0 (attack-demo)';

const sha256hex = (s) => crypto.createHash('sha256').update(s).digest('hex');

async function call(path, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(BASE + path, { method, headers: { 'user-agent': UA, ...headers }, body });
  const data = await res.json().catch(() => null);
  return { status: res.status, reason: data?.reason || (res.ok ? 'ok' : data?.error) };
}

async function newSession(headers = {}) {
  const res = await fetch(`${BASE}/api/web/session`, { method: 'POST', headers: { 'user-agent': UA, ...headers } });
  return { status: res.status, ...(await res.json()) };
}

// Same signing the website does in frontend/src/api/secureFetch.js
function sign(s, method, path, body = '', tsOffsetSec = 0) {
  const ts = String(Math.floor(Date.now() / 1000) + tsOffsetSec);
  const nonce = crypto.randomBytes(18).toString('base64url');
  const canonical = [method, path, ts, nonce, sha256hex(body)].join('\n');
  const sig = crypto.createHmac('sha256', Buffer.from(s.sessionKey, 'base64')).update(canonical).digest('base64');
  return { 'x-web-token': s.token, 'x-ts': ts, 'x-nonce': nonce, 'x-sig': sig };
}

const rows = [];
async function check(label, expected, promise) {
  const { status, reason } = await promise;
  const got = `${status} ${reason}`;
  rows.push({ scenario: label, expected, got, pass: got.startsWith(expected) ? 'yes' : 'NO' });
}

async function main() {
  const s = await newSession();
  if (s.status !== 200) throw new Error(`Could not get a session: ${s.status} ${s.reason}`);

  await check('Postman / curl with no token', '401 missing_token', call('/api/blogs'));
  await check('Made-up token', '401 invalid_token',
    call('/api/blogs', { headers: { ...sign(s, 'GET', '/api/blogs'), 'x-web-token': 'abc.def.ghi' } }));
  await check('Token but no signature', '401 missing_signature',
    call('/api/blogs', { headers: { 'x-web-token': s.token } }));

  const copied = sign(s, 'GET', '/api/blogs');
  await check('Original signed request', '200 ok', call('/api/blogs', { headers: copied }));
  await check('Same request replayed (copied cURL)', '401 nonce_reused', call('/api/blogs', { headers: copied }));
  await check('Copied headers, new nonce', '401 bad_signature',
    call('/api/blogs', { headers: { ...copied, 'x-nonce': crypto.randomBytes(18).toString('base64url') } }));
  await check('Signature reused on another URL', '401 bad_signature',
    call('/api/blogs?limit=10000', { headers: sign(s, 'GET', '/api/blogs') }));

  const body = JSON.stringify({ email: 'me@example.com' });
  await check('Body changed after signing', '401 bad_signature', call('/api/subscribe', {
    method: 'POST',
    headers: { ...sign(s, 'POST', '/api/subscribe', body), 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'attacker@example.com' })
  }));
  await check('Timestamp 5 minutes old', '401 stale_timestamp',
    call('/api/blogs', { headers: sign(s, 'GET', '/api/blogs', '', -300) }));
  // Through the loopback proxy, X-Forwarded-For stands in for "token copied to another machine".
  await check('Token used from another IP', '401 ip_mismatch',
    call('/api/blogs', { headers: { ...sign(s, 'GET', '/api/blogs'), 'x-forwarded-for': '203.0.113.9' } }));
  await check('Token used from another browser', '401 ua_mismatch',
    call('/api/blogs', { headers: { ...sign(s, 'GET', '/api/blogs'), 'user-agent': 'curl/8.0' } }));

  const foreign = await newSession({ origin: 'https://evil.example' });
  rows.push({ scenario: 'Session asked for from another site', expected: '403 bad_origin',
    got: `${foreign.status} ${foreign.reason}`, pass: foreign.status === 403 ? 'yes' : 'NO' });

  await check('Wrong partner secret code', '401 bad_secret_code',
    call('/api/blogs', { headers: { 'x-secret-code': 'sc_guess' } }));
  if (process.env.SECRET_CODE) {
    await check('Valid partner secret code', '200 ok',
      call('/api/blogs', { headers: { 'x-secret-code': process.env.SECRET_CODE } }));
  }

  console.table(rows);
  console.log('Note: a script that calls /api/web/session itself and signs like the website still gets 200.');
  console.log('That is limited by short sessions, IP/UA binding, rate limits and the usage log, not prevented.');
  process.exitCode = rows.every((r) => r.pass === 'yes') ? 0 : 1;
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
