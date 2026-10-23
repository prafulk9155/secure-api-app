const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('./config');
const store = require('./store');
const { getClientIp, ipHash, uaHash } = require('./clientIp');

// Per-session signing key. Derived from the server secret + jti, so the server never
// stores it and the global HMAC_SECRET never reaches the browser.
function deriveSessionKey(jti) {
  return crypto.createHmac('sha256', config.HMAC_SECRET).update(jti).digest();
}

// POST /api/web/session - bootstraps a short-lived, IP+UA bound signing session.
async function issueWebSession(req, res) {
  // Browsers always send Origin on POST. Reject other sites; non-browser clients still
  // get through here, which is why sessions are short, bound and rate limited.
  const origin = req.get('origin');
  if (origin && origin !== config.CLIENT_ORIGIN) {
    return res.status(403).json({ error: 'Origin not allowed', reason: 'bad_origin' });
  }

  const count = await store.incr(`rate:session:${getClientIp(req)}`, 60);
  if (count > config.SESSION_ISSUE_PER_MIN) {
    return res.status(429).json({ error: 'Too many sessions', reason: 'rate_limited' });
  }

  const jti = crypto.randomUUID();
  const token = jwt.sign(
    { ip: ipHash(req), ua: uaHash(req) },
    config.WEB_TOKEN_SECRET,
    { algorithm: 'HS256', expiresIn: config.SESSION_TTL_SEC, jwtid: jti }
  );

  res.set('Cache-Control', 'no-store');
  res.json({
    token,
    sessionKey: deriveSessionKey(jti).toString('base64'),
    serverTime: Date.now(),
    expiresIn: config.SESSION_TTL_SEC
  });
}

module.exports = { issueWebSession, deriveSessionKey };
