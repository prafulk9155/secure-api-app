const crypto = require('crypto');

// Relies on app.set('trust proxy', ...) so req.ip only honours X-Forwarded-For
// when the request came through a proxy we trust. Never read the header directly.
function getClientIp(req) {
  let ip = req.ip || req.socket.remoteAddress || '';
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  if (ip === '::1') ip = '127.0.0.1';
  return ip;
}

const sha256 = (value) => crypto.createHash('sha256').update(value || '').digest('hex');

// Short hashes are enough for binding and keep raw IP/UA out of the token.
const ipHash = (req) => sha256(getClientIp(req)).slice(0, 16);
const uaHash = (req) => sha256(req.get('user-agent')).slice(0, 16);

module.exports = { getClientIp, ipHash, uaHash, sha256 };
