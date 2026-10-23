const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('./config');
const store = require('./store');
const { ipHash, uaHash, sha256 } = require('./clientIp');
const { deriveSessionKey } = require('./webSession');

const NONCE_RE = /^[A-Za-z0-9_-]{16,64}$/;

const fail = (reason, jti, status = 401) => ({ ok: false, reason, jti, status });

// Must match frontend/src/api/secureFetch.js byte for byte.
function canonicalString(req, ts, nonce) {
  return [req.method.toUpperCase(), req.originalUrl, ts, nonce, sha256(req.rawBody)].join('\n');
}

// Checks run cheapest-first; the nonce is only burned once the signature is valid,
// so unsigned junk cannot fill the nonce store or block a real request's nonce.
async function verifyWebRequest(req) {
  const token = req.get('x-web-token');
  if (!token) return fail('missing_token');

  const ts = req.get('x-ts');
  const nonce = req.get('x-nonce');
  const sig = req.get('x-sig');
  if (!ts || !nonce || !sig) return fail('missing_signature');

  let claims;
  try {
    claims = jwt.verify(token, config.WEB_TOKEN_SECRET, { algorithms: ['HS256'] });
  } catch (err) {
    return fail(err.name === 'TokenExpiredError' ? 'expired_token' : 'invalid_token');
  }
  const { jti } = claims;

  if (claims.ip !== ipHash(req)) return fail('ip_mismatch', jti);
  if (claims.ua !== uaHash(req)) return fail('ua_mismatch', jti);

  const tsNum = Number(ts);
  if (!Number.isInteger(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > config.TS_WINDOW_SEC) {
    return fail('stale_timestamp', jti);
  }
  if (!NONCE_RE.test(nonce)) return fail('bad_nonce', jti);

  const expected = crypto.createHmac('sha256', deriveSessionKey(jti))
    .update(canonicalString(req, ts, nonce))
    .digest();
  const given = Buffer.from(sig, 'base64');
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return fail('bad_signature', jti);
  }

  // Nonce TTL covers the whole timestamp window on both sides.
  if (!(await store.setNX(`nonce:${jti}:${nonce}`, config.TS_WINDOW_SEC * 2))) {
    return fail('nonce_reused', jti);
  }

  const count = await store.incr(`rate:web:${jti}`, 60);
  if (count > config.WEB_RATE_PER_MIN) return fail('rate_limited', jti, 429);

  return { ok: true, jti };
}

module.exports = { verifyWebRequest };
