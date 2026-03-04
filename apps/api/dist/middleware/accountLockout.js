const MAX_FAILURES = 10;
const LOCKOUT_DURATION_MS = 15 * 60 * 1e3;
const DECAY_WINDOW_MS = 60 * 60 * 1e3;
const lockoutStore = /* @__PURE__ */ new Map();
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of lockoutStore.entries()) {
    if ((!entry.lockedUntil || entry.lockedUntil < now) && now - entry.lastAttempt > DECAY_WINDOW_MS) {
      lockoutStore.delete(key);
    }
  }
}, 5 * 60 * 1e3);
function getLockoutKey(req) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const email = typeof req.body?.email === "string" ? req.body.email.toLowerCase() : "";
  return email ? `${ip}:${email}` : `ip:${ip}`;
}
function checkLockout(req, res, next) {
  const key = getLockoutKey(req);
  const entry = lockoutStore.get(key);
  if (!entry) {
    return next();
  }
  if (entry.lockedUntil && entry.lockedUntil > Date.now()) {
    const retryAfterSec = Math.ceil(
      (entry.lockedUntil - Date.now()) / 1e3
    );
    console.warn(
      `[LOCKOUT] Blocked attempt from ${key} \u2014 locked for ${retryAfterSec}s more`
    );
    res.status(429).json({
      success: false,
      error: "Account temporarily locked due to too many failed attempts. Please try again later.",
      retryAfter: retryAfterSec
    });
    return;
  }
  if (Date.now() - entry.lastAttempt > DECAY_WINDOW_MS) {
    lockoutStore.delete(key);
  }
  next();
}
function recordAuthFailure(req) {
  const key = getLockoutKey(req);
  const entry = lockoutStore.get(key) || {
    failures: 0,
    lockedUntil: null,
    lastAttempt: Date.now()
  };
  entry.failures += 1;
  entry.lastAttempt = Date.now();
  if (entry.failures >= MAX_FAILURES) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    console.warn(
      `[LOCKOUT] Account locked: ${key} after ${entry.failures} failures (${LOCKOUT_DURATION_MS / 6e4} min)`
    );
  }
  lockoutStore.set(key, entry);
}
function resetAuthFailures(req) {
  const key = getLockoutKey(req);
  lockoutStore.delete(key);
}
export {
  checkLockout,
  recordAuthFailure,
  resetAuthFailures
};
//# sourceMappingURL=accountLockout.js.map
