/**
 * authMiddleware.ts - Clerk Authentication Middleware
 *
 * Uses Clerk for API authentication.
 * All protected routes require valid Clerk JWT tokens.
 *
 * Environment Variables:
 * - CLERK_SECRET_KEY: Required for Clerk backend verification
 */

import { Request, Response, NextFunction, RequestHandler } from 'express';
import {
    clerkMiddleware,
    requireAuth as clerkRequireAuth,
    getAuth as clerkGetAuth,
} from '@clerk/express';

// ============================================
// CONFIGURATION
// ============================================

export const isUsingClerk = (): boolean => {
    return process.env['USE_CLERK'] === 'true';
};

console.log('🔐 API Auth Mode: Clerk');

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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const safeGetAuth = (req: Request): ClerkAuthResult => {
    const auth = clerkGetAuth(req as any);
    return {
        userId: (auth as Record<string, unknown>).userId as string | null ?? null,
        sessionId: (auth as Record<string, unknown>).sessionId as string | null ?? null,
    };
};

// ============================================
// CLERK MIDDLEWARE
// ============================================

/**
 * Clerk authentication middleware
 * Validates JWT tokens and attaches auth info to request
 */
export const authMiddleware: RequestHandler = clerkMiddleware() as unknown as RequestHandler;

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
        email: null as string | null // Email must be fetched from Clerk user API separately
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
export const requireRole = (_roles: string[]): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const { userId } = safeGetAuth(req);

        if (!userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        // For now, all authenticated users pass
        // Can be extended to check Clerk user metadata for roles
        // const user = await clerkClient.users.getUser(userId);
        // const userRole = user.publicMetadata.role as string;
        // if (!roles.includes(userRole)) { ... }

        next();
    };
};

// ============================================
// ERROR HANDLERS
// ============================================

/**
 * Handle authentication errors
 */
export const handleAuthError = (err: Error, _req: Request, res: Response, next: NextFunction): void => {
    if (err.name === 'ClerkError' || err.message.includes('Unauthenticated')) {
        res.status(401).json({
            success: false,
            message: 'Authentication failed',
            error: err.message
        });
        return;
    }
    next(err);
};
