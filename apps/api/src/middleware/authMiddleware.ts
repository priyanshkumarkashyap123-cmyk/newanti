/**
 * authMiddleware.ts - Unified Authentication Middleware
 * 
 * Supports both Clerk and in-house JWT authentication.
 * Switches based on USE_CLERK environment variable.
 * 
 * Environment Variables:
 * - USE_CLERK: 'true' | 'false' - Switch between auth providers
 * - JWT_SECRET: Secret key for JWT verification (in-house auth)
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { clerkMiddleware, requireAuth as clerkRequireAuth, getAuth as clerkGetAuth } from '@clerk/express';
import { UserModel } from '../models.js';

// ============================================
// CONFIGURATION
// ============================================

const USE_CLERK = process.env['USE_CLERK'] === 'true';
const JWT_SECRET = process.env['JWT_SECRET'] || 'beamlab-secret-key-change-in-production';

console.log(`🔐 API Auth Mode: ${USE_CLERK ? 'Clerk' : 'In-House JWT'}`);

// ============================================
// TYPES
// ============================================

export interface JWTPayload {
    userId: string;
    email: string;
    role: string;
    iat?: number;
    exp?: number;
}

export interface AuthenticatedRequest extends Request {
    auth?: {
        userId: string;
        email?: string;
        role?: string;
        sessionId?: string;
    };
}

// ============================================
// IN-HOUSE JWT VERIFICATION
// ============================================

/**
 * Verify JWT token and extract payload
 */
const verifyJWT = (token: string): JWTPayload | null => {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        return decoded;
    } catch {
        return null;
    }
};

/**
 * Extract token from Authorization header
 */
const extractToken = (req: Request): string | null => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
        return null;
    }
    
    if (authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7);
    }
    
    return authHeader;
};

// ============================================
// IN-HOUSE MIDDLEWARE
// ============================================

/**
 * In-house JWT authentication middleware (optional auth)
 * Attaches auth info to request if valid token is present
 */
const inHouseAuthMiddleware = async (
    req: AuthenticatedRequest,
    _res: Response,
    next: NextFunction
): Promise<void> => {
    const token = extractToken(req);
    
    if (token) {
        const payload = verifyJWT(token);
        
        if (payload) {
            req.auth = {
                userId: payload.userId,
                email: payload.email,
                role: payload.role
            };
        }
    }
    
    next();
};

/**
 * In-house JWT require auth middleware
 * Returns 401 if no valid token is present
 */
const inHouseRequireAuth = () => {
    return async (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const token = extractToken(req);
        
        if (!token) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }
        
        const payload = verifyJWT(token);
        
        if (!payload) {
            res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
            return;
        }
        
        // Verify user still exists
        const user = await UserModel.findById(payload.userId);
        if (!user) {
            res.status(401).json({
                success: false,
                message: 'User not found'
            });
            return;
        }
        
        req.auth = {
            userId: payload.userId,
            email: payload.email,
            role: payload.role
        };
        
        next();
    };
};

/**
 * In-house get auth helper
 */
const inHouseGetAuth = (req: AuthenticatedRequest) => {
    return {
        userId: req.auth?.userId ?? null,
        email: req.auth?.email ?? null,
        role: req.auth?.role ?? null
    };
};

// ============================================
// CLERK WRAPPER
// ============================================

/**
 * Clerk auth middleware wrapper
 */
const clerkAuthWrapper = () => {
    return clerkMiddleware();
};

/**
 * Clerk require auth wrapper
 */
const clerkRequireAuthWrapper = () => {
    return clerkRequireAuth();
};

/**
 * Clerk get auth wrapper
 */
const clerkGetAuthWrapper = (req: Request) => {
    const auth = clerkGetAuth(req);
    return {
        userId: auth.userId ?? null,
        email: null, // Clerk doesn't provide email directly
        role: null
    };
};

// ============================================
// UNIFIED EXPORTS
// ============================================

/**
 * Unified auth middleware (optional auth)
 * Use this for routes that can work with or without auth
 */
export const authMiddleware = USE_CLERK ? clerkAuthWrapper() : inHouseAuthMiddleware;

/**
 * Unified require auth middleware
 * Use this for routes that require authentication
 */
export const requireAuth = USE_CLERK ? clerkRequireAuthWrapper : inHouseRequireAuth;

/**
 * Unified get auth helper
 * Returns the current user's auth info
 */
export const getAuth = (req: Request) => {
    if (USE_CLERK) {
        return clerkGetAuthWrapper(req);
    }
    return inHouseGetAuth(req as AuthenticatedRequest);
};

/**
 * Get user ID from request
 * Works with both Clerk and in-house auth
 */
export const getUserId = (req: Request): string | null => {
    if (USE_CLERK) {
        const auth = clerkGetAuth(req);
        return auth.userId ?? null;
    }
    return (req as AuthenticatedRequest).auth?.userId ?? null;
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = (req: Request): boolean => {
    return getUserId(req) !== null;
};

/**
 * Require specific role middleware
 */
export const requireRole = (roles: string[]) => {
    return async (
        req: AuthenticatedRequest,
        res: Response,
        next: NextFunction
    ): Promise<void> => {
        const auth = getAuth(req);
        
        if (!auth.userId) {
            res.status(401).json({
                success: false,
                message: 'Authentication required'
            });
            return;
        }
        
        // For in-house auth, check role
        if (!USE_CLERK) {
            if (!auth.role || !roles.includes(auth.role)) {
                res.status(403).json({
                    success: false,
                    message: 'Insufficient permissions'
                });
                return;
            }
        }
        
        // For Clerk, you might check user metadata
        // This is a simplified version
        
        next();
    };
};

/**
 * Check if using Clerk
 */
export const isUsingClerk = (): boolean => USE_CLERK;

/**
 * Check if using in-house auth
 */
export const isUsingInHouseAuth = (): boolean => !USE_CLERK;

export default {
    authMiddleware,
    requireAuth,
    getAuth,
    getUserId,
    isAuthenticated,
    requireRole,
    isUsingClerk,
    isUsingInHouseAuth
};
