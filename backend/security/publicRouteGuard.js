const config = require('./config');
const store = require('./store');
const { getClientIp } = require('./clientIp');
const { verifyWebRequest } = require('./webGuard');
const { verifySecretCode } = require('./secretCodeGuard');
const { RequestLog } = require('../models');

// Fire-and-forget audit row. At real traffic volumes, batch these or ship them to a log pipeline.
function record(req, channel, result) {
  RequestLog.create({
    channel: result.ok ? channel : 'rejected',
    reason: result.ok ? 'ok' : result.reason,
    wouldBlock: !result.ok && config.GUARD_MODE === 'log',
    jti: result.jti,
    clientName: result.clientName,
    ip: getClientIp(req),
    method: req.method,
    path: req.path
  }).catch((err) => console.error('[guard] log write failed:', err.message));
}

async function noteRejection(req, reason) {
  const ip = getClientIp(req);
  const count = await store.incr(`rejections:${ip}`, 60);
  if (count === config.ALERT_THRESHOLD) {
    console.warn(`[ALERT] ${count} rejected requests from ${ip} in the last minute (latest: ${reason} on ${req.method} ${req.path})`);
  }
}

// Guards routes that need no login but should only be usable from our website
// (signed web session) or by a known partner (secret code).
async function publicRouteGuard(req, res, next) {
  try {
    const code = req.get('x-secret-code') || req.get('secretcode');
    const channel = code ? 'secret' : 'web';
    let result;

    if (code) {
      result = await verifySecretCode(code);
    } else {
      const ipCount = await store.incr(`rate:ip:${getClientIp(req)}`, 60);
      result = ipCount > config.IP_RATE_PER_MIN
        ? { ok: false, reason: 'rate_limited', status: 429 }
        : await verifyWebRequest(req);
    }

    record(req, channel, result);
    req.apiAccess = { channel, ...result };
    if (result.ok) return next();

    await noteRejection(req, result.reason);
    if (config.GUARD_MODE === 'log') return next();
    res.status(result.status).json({ error: 'Request blocked', reason: result.reason });
  } catch (err) {
    next(err);
  }
}

module.exports = { publicRouteGuard };
