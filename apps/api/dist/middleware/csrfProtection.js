import { randomUUID } from "crypto";
const CSRF_COOKIE = "csrf_token";
const CSRF_HEADER = "x-csrf-token";
const SAFE_METHODS = /* @__PURE__ */ new Set(["GET", "HEAD", "OPTIONS"]);
const ALLOWED_ORIGINS = [
  "https://beamlabultimate.tech",
  "https://www.beamlabultimate.tech",
  "https://brave-mushroom-0eae8ec00.4.azurestaticapps.net",
  "http://localhost:5173",
  "http://localhost:3000"
];
function csrfCookieMiddleware(_req, res, next) {
  const token = randomUUID();
  res.cookie(CSRF_COOKIE, token, {
    httpOnly: false,
    // Client JS must read it to send in the header
    secure: true,
    sameSite: "none",
    // Required for cross-origin (frontend & API on different domains)
    path: "/",
    maxAge: 60 * 60 * 1e3
    // 1 hour
  });
  next();
}
function csrfValidationMiddleware(req, res, next) {
  if (SAFE_METHODS.has(req.method)) {
    return next();
  }
  if (req.path === "/health" || req.path.includes("/webhook") || req.path.includes("/razorpay")) {
    return next();
  }
  const origin = req.get("origin");
  const referer = req.get("referer");
  if (origin) {
    if (!ALLOWED_ORIGINS.includes(origin)) {
      console.warn(`[CSRF] Blocked request from disallowed origin: ${origin}`);
      res.status(403).json({
        success: false,
        error: "Forbidden \u2014 invalid origin"
      });
      return;
    }
  } else if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (!ALLOWED_ORIGINS.includes(refOrigin)) {
        console.warn(
          `[CSRF] Blocked request from disallowed referer: ${referer}`
        );
        res.status(403).json({
          success: false,
          error: "Forbidden \u2014 invalid referer"
        });
        return;
      }
    } catch {
      res.status(403).json({
        success: false,
        error: "Forbidden \u2014 malformed referer"
      });
      return;
    }
  }
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get(CSRF_HEADER);
  if (process.env.NODE_ENV !== "production") {
    if (process.env.NODE_ENV === void 0) {
      console.warn(
        "[CSRF] WARNING: NODE_ENV is not set \u2014 CSRF validation skipped. Set NODE_ENV=production in production!"
      );
    }
    return next();
  }
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    console.warn(
      `[CSRF] Token mismatch \u2014 cookie: ${!!cookieToken}, header: ${!!headerToken}`
    );
    res.status(403).json({
      success: false,
      error: "CSRF validation failed"
    });
    return;
  }
  next();
}
export {
  csrfCookieMiddleware,
  csrfValidationMiddleware
};
//# sourceMappingURL=csrfProtection.js.map
