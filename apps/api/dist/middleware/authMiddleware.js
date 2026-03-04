import {
  clerkMiddleware,
  requireAuth as clerkRequireAuth,
  getAuth as clerkGetAuth
} from "@clerk/express";
const isUsingClerk = () => {
  return process.env["USE_CLERK"] === "true";
};
console.log("\u{1F510} API Auth Mode: Clerk");
const safeGetAuth = (req) => {
  const auth = clerkGetAuth(req);
  return {
    userId: auth.userId ?? null,
    sessionId: auth.sessionId ?? null
  };
};
const authMiddleware = clerkMiddleware();
const requireAuth = () => {
  return clerkRequireAuth();
};
const getAuth = (req) => {
  const { userId, sessionId } = safeGetAuth(req);
  return {
    userId,
    sessionId,
    email: null
    // Email must be fetched from Clerk user API separately
  };
};
const getUserId = (req) => {
  return safeGetAuth(req).userId;
};
const isAuthenticated = (req) => {
  return !!safeGetAuth(req).userId;
};
const requireRole = (roles) => {
  return async (req, res, next) => {
    const { userId } = safeGetAuth(req);
    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required"
      });
      return;
    }
    try {
      const clerkClient = (await import("@clerk/express")).clerkClient;
      const client = await clerkClient;
      const user = await client.users.getUser(userId);
      const userRole = user.publicMetadata?.role || "user";
      if (!roles.includes(userRole)) {
        res.status(403).json({
          success: false,
          message: "Insufficient permissions \u2014 required role: " + roles.join(" or ")
        });
        return;
      }
    } catch (error) {
      console.error("[Auth] Role check failed:", error);
      res.status(403).json({
        success: false,
        message: "Unable to verify permissions"
      });
      return;
    }
    next();
  };
};
const handleAuthError = (err, _req, res, next) => {
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
async function verifySocketToken(token) {
  if (!token) return null;
  try {
    const { verifyToken } = await import("@clerk/express");
    const payload = await verifyToken(token, {
      secretKey: process.env["CLERK_SECRET_KEY"] || ""
    });
    if (payload?.sub) {
      return { userId: payload.sub, sub: payload.sub };
    }
    return null;
  } catch (clerkErr) {
    try {
      const jwt = await import("jsonwebtoken");
      const secret = process.env["JWT_SECRET"];
      if (!secret) return null;
      const decoded = jwt.default.verify(token, secret);
      const userId = decoded.userId ?? decoded.sub ?? decoded.id;
      if (userId) return { userId, sub: userId };
      return null;
    } catch {
      return null;
    }
  }
}
export {
  authMiddleware,
  getAuth,
  getUserId,
  handleAuthError,
  isAuthenticated,
  isUsingClerk,
  requireAuth,
  requireRole,
  verifySocketToken
};
//# sourceMappingURL=authMiddleware.js.map
