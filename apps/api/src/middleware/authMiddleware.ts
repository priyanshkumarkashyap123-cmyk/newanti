/**
 * authMiddleware.ts - Clerk Authentication Middleware
 *
 * Uses Clerk for API authentication.
 * All protected routes require valid Clerk JWT tokens.
 *
 * Environment Variables:
 * - CLERK_SECRET_KEY: Required for Clerk backend verification
 */

import { Request, Response, NextFunction, RequestHandler } from "express";
import {
  clerkMiddleware,
  requireAuth as clerkRequireAuth,
  getAuth as clerkGetAuth,
} from "@clerk/express";
import { logger } from "../utils/logger.js";

// ============================================
// CONFIGURATION
// ============================================

export const isUsingClerk = (): boolean => {
  return process.env["USE_CLERK"] === "true";
};

logger.info('API Auth Mode: Clerk');

// ============================================
// TYPES
// ============================================

export interface AuthenticatedRequest extends Request {
  auth?: {
    userId: string;
    email?: string;
    sessionId?: string;
  };
}

/**
 * Minimal auth shape returned by our helpers.
 * Keeps downstream code free of `as any`.
 */
interface ClerkAuthResult {
  userId: string | null;
  sessionId: string | null;
}

// ============================================
// INTERNAL HELPERS
// ============================================

/**
 * Single cast boundary — Clerk SDK v5 ships Express v4 types whereas we use
 * Express v5.  This cast is intentional and confined to one spot.
 */
const safeGetAuth = (req: Request): ClerkAuthResult => {
  const auth = clerkGetAuth(req as any);
  return {
    userId: ((auth as Record<string, unknown>).userId as string | null) ?? null,
    sessionId:
      ((auth as Record<string, unknown>).sessionId as string | null) ?? null,
  };
};

// ============================================
// CLERK MIDDLEWARE
// ============================================

/**
 * Clerk authentication middleware
 * Validates JWT tokens and attaches auth info to request
 */
export const authMiddleware: RequestHandler =
  clerkMiddleware() as unknown as RequestHandler;

/**
 * Require authentication middleware
 * Returns 401 if user is not authenticated
 */
export const requireAuth = (): RequestHandler => {
  return clerkRequireAuth() as unknown as RequestHandler;
};

/**
 * Get authentication info from request
 */
export const getAuth = (req: Request) => {
  const { userId, sessionId } = safeGetAuth(req);
  return {
    userId,
    sessionId,
    email: null as string | null, // Email must be fetched from Clerk user API separately
  };
};

/**
 * Get user ID from request (convenience helper)
 */
export const getUserId = (req: Request): string | null => {
  return safeGetAuth(req).userId;
};

/**
 * Check if request is authenticated
 */
export const isAuthenticated = (req: Request): boolean => {
  return !!safeGetAuth(req).userId;
};

// ============================================
// ROLE-BASED ACCESS CONTROL (Optional)
// ============================================

/**
 * Require specific roles (can be extended based on Clerk metadata)
 */
export const requireRole = (roles: string[]): RequestHandler => {
  return async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    const { userId } = safeGetAuth(req);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Authentication required",
      });
      return;
    }

    try {
      // Check user role from Clerk public metadata
      const clerkClient = (await import("@clerk/express")).clerkClient;
      const client = await clerkClient;
      const user = await client.users.getUser(userId);
      const userRole =
        ((user.publicMetadata as Record<string, unknown>)?.role as string) ||
        "user";

      if (!roles.includes(userRole)) {
        res.status(403).json({
          success: false,
          message:
            "Insufficient permissions — required role: " + roles.join(" or "),
        });
        return;
      }
    } catch (error) {
      logger.error({ err: error }, '[Auth] Role check failed');
      // Fail closed — deny access if role check fails
      res.status(403).json({
        success: false,
        message: "Unable to verify permissions",
      });
      return;
    }

    next();
  };
};

// ============================================
// ERROR HANDLERS
// ============================================

/**
 * Handle authentication errors
 */
export const handleAuthError = (
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (err.name === "ClerkError" || err.message.includes("Unauthenticated")) {
    res.status(401).json({
      success: false,
      message: "Authentication failed",
      error: err.message,
    });
    return;
  }
  next(err);
};

// ============================================
// WEBSOCKET TOKEN VERIFICATION
// ============================================

/**
 * Verify a JWT/Clerk token for WebSocket connections.
 * Used by SocketServer's io.use() middleware to authenticate
 * socket connections before they are accepted.
 *
 * Returns the decoded token payload (with userId/sub) or null if invalid.
 */
export async function verifySocketToken(
  token: string,
): Promise<{ userId?: string; sub?: string; id?: string } | null> {
  if (!token) return null;

  try {
    // Attempt Clerk token verification via Clerk Backend SDK
    // Clerk's verifyToken uses the JWKS endpoint and RS256
    const { verifyToken } = await import("@clerk/express");
    const payload = await verifyToken(token, {
      secretKey: process.env["CLERK_SECRET_KEY"] || "",
    });
    if (payload?.sub) {
      return { userId: payload.sub, sub: payload.sub };
    }
    return null;
  } catch (clerkErr) {
    // Clerk verification failed — try in-house JWT as fallback
    try {
      const jwt = await import("jsonwebtoken");
      const secret = process.env["JWT_SECRET"];
      if (!secret) return null;
      const decoded = jwt.default.verify(token, secret) as Record<
        string,
        unknown
      >;
      const userId = (decoded.userId ?? decoded.sub ?? decoded.id) as
        | string
        | undefined;
      if (userId) return { userId, sub: userId };
      return null;
    } catch {
      return null;
    }
  }
}
