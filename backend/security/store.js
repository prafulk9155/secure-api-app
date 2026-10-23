// In-memory key/value store with TTL. The API mirrors the Redis commands used in
// production (SET key 1 EX ttl NX, INCR + EXPIRE) so it can be swapped for a Redis
// client without touching the guards. In-memory only works for a single instance.
const entries = new Map(); // key -> { value, expiresAt }

function live(key) {
  const entry = entries.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    entries.delete(key);
    return null;
  }
  return entry;
}

// Redis: SET key 1 EX ttlSec NX  -> true when the key was created
async function setNX(key, ttlSec) {
  if (live(key)) return false;
  entries.set(key, { value: 1, expiresAt: Date.now() + ttlSec * 1000 });
  return true;
}

// Redis: INCR key; EXPIRE key ttlSec (only on first hit) -> new count
async function incr(key, ttlSec) {
  const entry = live(key);
  if (entry) return ++entry.value;
  entries.set(key, { value: 1, expiresAt: Date.now() + ttlSec * 1000 });
  return 1;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of entries) if (entry.expiresAt <= now) entries.delete(key);
}, 30 * 1000).unref();

module.exports = { setNX, incr };
