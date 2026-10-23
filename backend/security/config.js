const crypto = require('crypto');

// Secrets fall back to a random per-boot value so the demo runs without setup.
// That means every restart invalidates issued web sessions (the client re-bootstraps).
function secret(name) {
  if (process.env[name]) return process.env[name];
  console.warn(`[security] ${name} not set - using a random value for this process only`);
  return crypto.randomBytes(32).toString('hex');
}

const int = (name, def) => Number.parseInt(process.env[name], 10) || def;

module.exports = {
  WEB_TOKEN_SECRET: secret('WEB_TOKEN_SECRET'), // signs the web session JWT
  HMAC_SECRET: secret('HMAC_SECRET'),           // derives per-session signing keys; never leaves the server
  GUARD_MODE: process.env.GUARD_MODE === 'log' ? 'log' : 'enforce',
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
  ADMIN_KEY: process.env.ADMIN_KEY || '', // empty -> /api/admin/* is loopback-only
  SESSION_TTL_SEC: int('WEB_SESSION_TTL_SEC', 600),
  TS_WINDOW_SEC: int('SIG_TS_WINDOW_SEC', 60),
  WEB_RATE_PER_MIN: int('WEB_RATE_PER_MIN', 60),       // per web session (jti)
  IP_RATE_PER_MIN: int('IP_RATE_PER_MIN', 120),        // per client IP on public routes
  SESSION_ISSUE_PER_MIN: int('SESSION_ISSUE_PER_MIN', 20), // per IP on /api/web/session
  ALERT_THRESHOLD: int('REJECTION_ALERT_THRESHOLD', 5)  // rejections per IP per minute
};
