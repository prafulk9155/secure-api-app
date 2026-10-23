const crypto = require('crypto');

const ALERT_THRESHOLD = 5;
const rejectionHistory = new Map();
const rateLimits = new Map();

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  process.env.CLIENT_ORIGIN
].filter(Boolean);

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

function checkRateLimit(key, maxRequests = 60, windowMs = 60000) {
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

// Open for our app only, or via secretCode: ALLOWED header
function secureBlogAccess(req, res, next) {
  const ip = getClientIp(req);
  const normalizedPath = normalizePath(req.path);

  // Rate limit by IP
  if (!checkRateLimit(`ip:${ip}:${normalizedPath}`, 60)) {
    logRejection(ip, normalizedPath, 'Rate limit exceeded');
    return res.status(429).json({ error: 'Too Many Requests' });
  }

  // 1. Direct SecretCode Header Check
  const secretCode = req.headers['secretcode'] || req.headers['x-secret-code'];
  if (secretCode === 'ALLOWED') {
    return next();
  }

  // 2. Validate request is from OUR APP ONLY
  const appHeader = req.headers['x-app-source'];
  const origin = req.headers['origin'];
  const referer = req.headers['referer'];
  const secFetchDest = req.headers['sec-fetch-dest']; // 'document' when typed directly in address bar

  const isFromOurApp =
    appHeader === 'secure-api-app' ||
    (origin && ALLOWED_ORIGINS.some(o => origin.startsWith(o))) ||
    (referer && ALLOWED_ORIGINS.some(o => referer.startsWith(o)));

  const isDirectBrowserNavigation = secFetchDest === 'document' || (!origin && !referer && !appHeader);

  if (isFromOurApp && !isDirectBrowserNavigation) {
    return next();
  }

  // Otherwise, reject direct / external access
  logRejection(ip, normalizedPath, 'Direct / External access blocked (Not from our app)');
  return res.status(401).json({
    error: 'Unauthorized: Blog API is open only for our web application, or requires secretCode: ALLOWED header'
  });
}

module.exports = {
  secureBlogAccess,
  logRejection
};
