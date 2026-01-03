import { clerkMiddleware, requireAuth as clerkRequireAuth, getAuth as clerkGetAuth } from "@clerk/express";
const isUsingClerk = () => {
  return process.env["USE_CLERK"] === "true";
};
console.log("\u{1F510} API Auth Mode: Clerk");
const authMiddleware = clerkMiddleware();
const requireAuth = () => {
  return clerkRequireAuth();
};
const getAuth = (req) => {
  const auth = clerkGetAuth(req);
  return {
    userId: auth.userId ?? null,
    sessionId: auth.sessionId ?? null,
    email: null
    // Email must be fetched from Clerk user API separately
  };
};
const getUserId = (req) => {
  const auth = clerkGetAuth(req);
  return auth.userId ?? null;
};
const isAuthenticated = (req) => {
  const auth = clerkGetAuth(req);
  return !!auth.userId;
};
const requireRole = (roles) => {
  return async (req, res, next) => {
    const auth = clerkGetAuth(req);
    if (!auth.userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }
    next();
  };
};
const handleAuthError = (err, req, res, next) => {
  if (err.name === "ClerkError" || err.message.includes("Unauthenticated")) {
    res.status(401).json({
      success: false,
      message: "Authentication failed",
      error: err.message
    });
    return;
  }
  next(err);
};
export {
  authMiddleware,
  getAuth,
  getUserId,
  handleAuthError,
  isAuthenticated,
  isUsingClerk,
  requireAuth,
  requireRole
};
//# sourceMappingURL=authMiddleware.js.map
