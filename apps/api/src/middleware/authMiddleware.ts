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
import { clerkMiddleware, requireAuth as clerkRequireAuth, getAuth as clerkGetAuth } from '@clerk/express';

// ============================================
// CONFIGURATION
// ============================================

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

// ============================================
// CLERK MIDDLEWARE
// ============================================

/**
 * Clerk authentication middleware
 * Validates JWT tokens and attaches auth info to request
 */
export const authMiddleware: RequestHandler = clerkMiddleware();

/**
 * Require authentication middleware
 * Returns 401 if user is not authenticated
 */
export const requireAuth = (): RequestHandler => {
    return clerkRequireAuth();
};

/**
 * Get authentication info from request
 */
export const getAuth = (req: Request) => {
    const auth = clerkGetAuth(req);
    return {
        userId: auth.userId ?? null,
        sessionId: auth.sessionId ?? null
    };
};

/**
 * Get user ID from request (convenience helper)
 */
export const getUserId = (req: Request): string | null => {
    const auth = clerkGetAuth(req);
    return auth.userId ?? null;
};

/**
 * Check if request is authenticated
 */
export const isAuthenticated = (req: Request): boolean => {
    const auth = clerkGetAuth(req);
    return !!auth.userId;
};

// ============================================
// ROLE-BASED ACCESS CONTROL (Optional)
// ============================================

/**
 * Require specific roles (can be extended based on Clerk metadata)
 */
export const requireRole = (roles: string[]): RequestHandler => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        const auth = clerkGetAuth(req);
        
        if (!auth.userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }

        // For now, all authenticated users pass
        // Can be extended to check Clerk user metadata for roles
        // const user = await clerkClient.users.getUser(auth.userId);
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
export const handleAuthError = (err: Error, req: Request, res: Response, next: NextFunction): void => {
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
