// Signed fetch for public APIs that only our website may call.
// Protocol (must match backend/security/webGuard.js):
//   canonical = METHOD \n path+query \n ts \n nonce \n sha256hex(body)
//   x-sig     = base64(HMAC-SHA256(sessionKey, canonical))
// The session key is imported as a non-extractable CryptoKey, so page scripts can
// use it to sign but cannot read it back out.

const enc = new TextEncoder();
const RETRY_REASONS = new Set(['expired_token', 'invalid_token', 'ip_mismatch', 'ua_mismatch', 'stale_timestamp']);
const REFRESH_EARLY_MS = 60 * 1000;

let session = null; // { token, key, expiresAt, clockOffsetMs }
let pending = null;
let lastRequest = null;

const toBase64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
const fromBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

function newNonce() {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function fetchSession() {
  const res = await fetch('/api/web/session', { method: 'POST', credentials: 'include' });
  const data = await res.json();
  if (!res.ok) throw new Error(`Session refused: ${data.reason || res.status}`);

  const key = await crypto.subtle.importKey(
    'raw', fromBase64(data.sessionKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return {
    token: data.token,
    key,
    expiresAt: Date.now() + data.expiresIn * 1000,
    clockOffsetMs: data.serverTime - Date.now()
  };
}

// Single-flight: many components calling at once share one session request.
export async function getSession(force = false) {
  if (!force && session && Date.now() < session.expiresAt - REFRESH_EARLY_MS) return session;
  if (!pending) {
    pending = fetchSession()
      .then((s) => (session = s))
      .finally(() => { pending = null; });
  }
  return pending;
}

// Returns the headers for one request. Exported so the Attack Lab can build
// requests and then tamper with them.
export async function signRequest(method, path, bodyStr = '', { tsOffsetSec = 0 } = {}) {
  const s = await getSession();
  const ts = String(Math.floor((Date.now() + s.clockOffsetMs) / 1000) + tsOffsetSec);
  const nonce = newNonce();
  const bodyHash = toHex(await crypto.subtle.digest('SHA-256', enc.encode(bodyStr)));
  const canonical = [method.toUpperCase(), path, ts, nonce, bodyHash].join('\n');
  const sig = toBase64(await crypto.subtle.sign('HMAC', s.key, enc.encode(canonical)));
  return { 'x-web-token': s.token, 'x-ts': ts, 'x-nonce': nonce, 'x-sig': sig };
}

async function send(method, path, bodyStr) {
  const headers = await signRequest(method, path, bodyStr);
  if (bodyStr) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, { method, headers, body: bodyStr || undefined, credentials: 'include' });
  const data = await res.json().catch(() => null);
  lastRequest = { method, path, headers, body: bodyStr, status: res.status, data };
  return { res, data };
}

// Usage: const { res, data } = await secureFetch('/api/blogs');
//        await secureFetch('/api/subscribe', { method: 'POST', body: { email } });
export async function secureFetch(path, { method = 'GET', body } = {}) {
  const bodyStr = body === undefined ? '' : JSON.stringify(body);
  let result = await send(method, path, bodyStr);
  if (result.res.status === 401 && RETRY_REASONS.has(result.data?.reason)) {
    await getSession(true); // network or clock changed, or token expired: start a fresh session
    result = await send(method, path, bodyStr);
  }
  return result;
}

export const getLastRequest = () => lastRequest;
