const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'secure-jwt-token-secret-key-9876543210';
const HMAC_SECRET = process.env.HMAC_SECRET || 'secure-hmac-shared-key-1234567890';
const ALERT_THRESHOLD = 5; // Alert if >= 5 rejections in 60s
const NONCE_TTL_MS = 5 * 60 * 1000;

const seenNonces = new Map();
const rejectionHistory = new Map();
const rateLimits = new Map();

function getClientIp(req) {
  return (req.headers['x-forwarded-for'] || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim();
}

function normalizePath(path) {
  return (path || '/').toLowerCase().replace(/\/+$/, '') || '/';
}

function logRejection(ip, path, reason) {
  const now = Date.now();
  console.warn(`[SECURITY REJECTION] IP: ${ip} | Path: ${path} | Reason: ${reason} | Time: ${new Date(now).toISOString()}`);

  let timestamps = rejectionHistory.get(ip) || [];
  timestamps = timestamps.filter(t => now - t < 60000);
  timestamps.push(now);
  rejectionHistory.set(ip, timestamps);

  if (timestamps.length >= ALERT_THRESHOLD) {
    console.error(`🚨 [SECURITY ALERT] Unusual rejection volume detected! IP: ${ip} | Rejections in last 60s: ${timestamps.length}`);
  }
}

function checkRateLimit(key, maxRequests = 30, windowMs = 60000) {
  const now = Date.now();
  let record = rateLimits.get(key);
  if (!record || now > record.resetTime) {
    rateLimits.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }
  if (record.count >= maxRequests) return false;
  record.count++;
  return true;
}

function issueWebSession(req) {
  const ip = getClientIp(req);
  const jti = crypto.randomUUID();
  const uaHash = crypto.createHash('sha256').update(req.headers['user-agent'] || '').digest('hex');

  // Token TTL: 10 minutes, bound to IP and User-Agent
  const token = jwt.sign({ jti, ip, uaHash }, JWT_SECRET, { expiresIn: '10m' });
  return { token, jti, clientHmacSecret: HMAC_SECRET, expiresIn: 600 };
}

function secureBlogAccess(req, res, next) {
  const ip = getClientIp(req);
  const normalizedPath = normalizePath(req.path);

  // 1. SecretCode Header Bypass Check
  const secretCode = req.headers['secretcode'] || req.headers['x-secret-code'];
  if (secretCode === 'ALLOWED') {
    return next();
  }

  // 2. Token Check (10-minute TTL, bound to IP and User-Agent)
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : req.headers['x-access-token'];

  if (!token) {
    logRejection(ip, normalizedPath, 'Missing token and invalid secretCode');
    return res.status(401).json({ error: 'Unauthorized: Valid token or secretCode ALLOWED required' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    logRejection(ip, normalizedPath, `Token verification failed: ${err.message}`);
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired token (10m TTL)' });
  }

  // Bind token to IP
  if (decoded.ip !== ip) {
    logRejection(ip, normalizedPath, `Token IP mismatch (bound: ${decoded.ip}, current: ${ip})`);
    return res.status(401).json({ error: 'Unauthorized: Token IP mismatch' });
  }

  // Bind token to User-Agent
  const currentUaHash = crypto.createHash('sha256').update(req.headers['user-agent'] || '').digest('hex');
  if (decoded.uaHash !== currentUaHash) {
    logRejection(ip, normalizedPath, 'Token User-Agent mismatch');
    return res.status(401).json({ error: 'Unauthorized: Token User-Agent mismatch' });
  }

  // 3. Rate Limit per jti and per IP on normalized path
  const jtiKey = `jti:${decoded.jti}:${normalizedPath}`;
  const ipKey = `ip:${ip}:${normalizedPath}`;

  if (!checkRateLimit(jtiKey, 30) || !checkRateLimit(ipKey, 60)) {
    logRejection(ip, normalizedPath, 'Rate limit exceeded');
    return res.status(429).json({ error: 'Too Many Requests: Rate limit exceeded' });
  }

  // 4. HMAC + Nonce Verification on public route
  const timestamp = req.headers['x-timestamp'];
  const nonce = req.headers['x-nonce'];
  const signature = req.headers['x-signature'];

  if (!timestamp || !nonce || !signature) {
    logRejection(ip, normalizedPath, 'Missing HMAC headers (x-timestamp, x-nonce, x-signature)');
    return res.status(401).json({ error: 'Unauthorized: HMAC signature and nonce required' });
  }

  const reqTime = Number(timestamp);
  const now = Date.now();
  if (isNaN(reqTime) || Math.abs(now - reqTime) > NONCE_TTL_MS) {
    logRejection(ip, normalizedPath, 'Expired or invalid HMAC timestamp (>5m)');
    return res.status(401).json({ error: 'Unauthorized: Timestamp expired' });
  }

  // Cleanup expired nonces & check reuse
  for (const [n, exp] of seenNonces.entries()) {
    if (exp <= now) seenNonces.delete(n);
  }
  if (seenNonces.has(nonce)) {
    logRejection(ip, normalizedPath, 'Replayed nonce detected');
    return res.status(401).json({ error: 'Unauthorized: Nonce already used' });
  }
  seenNonces.set(nonce, reqTime + NONCE_TTL_MS);

  // Validate HMAC signature
  const rawBody = req.rawBody ? req.rawBody.toString('utf8') : '';
  const bodyHash = crypto.createHash('sha256').update(rawBody).digest('hex');
  const payload = `${req.method.toUpperCase()}\n${req.originalUrl || req.path}\n${timestamp}\n${nonce}\n${bodyHash}`;
  const expectedSig = crypto.createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');

  const expectedBuf = Buffer.from(expectedSig, 'hex');
  const receivedBuf = Buffer.from(signature, 'hex');

  if (expectedBuf.length !== receivedBuf.length || !crypto.timingSafeEqual(expectedBuf, receivedBuf)) {
    logRejection(ip, normalizedPath, 'HMAC signature mismatch');
    return res.status(401).json({ error: 'Unauthorized: Invalid signature' });
  }

  next();
}

module.exports = {
  issueWebSession,
  secureBlogAccess,
  logRejection
};
