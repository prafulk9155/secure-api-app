const store = require('./store');
const { sha256 } = require('./clientIp');
const { ApiClient } = require('../models');

// Partner channel: a server-to-server caller identified by its secret code.
// Each client gets its own per-minute limit from its plan.
async function verifySecretCode(code) {
  const client = await ApiClient.findOne({ codeHash: sha256(code), active: true }).lean();
  if (!client) return { ok: false, reason: 'bad_secret_code', status: 401 };

  const count = await store.incr(`rate:client:${client._id}`, 60);
  if (count > client.limitPerMin) {
    return { ok: false, reason: 'rate_limited', status: 429, clientName: client.name };
  }
  return { ok: true, clientName: client.name, plan: client.plan };
}

module.exports = { verifySecretCode };
