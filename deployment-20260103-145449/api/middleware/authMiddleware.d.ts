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
/**
 * Unified auth middleware (optional auth)
 * Use this for routes that can work with or without auth
 */
export declare const authMiddleware: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>> | ((req: AuthenticatedRequest, _res: Response, next: NextFunction) => Promise<void>);
/**
 * Unified require auth middleware
 * Use this for routes that require authentication
 */
export declare const requireAuth: (() => import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>) | (() => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>);
/**
 * Unified get auth helper
 * Returns the current user's auth info
 */
export declare const getAuth: (req: Request) => {
    userId: string | null;
    email: string | null;
    role: string | null;
};
/**
 * Get user ID from request
 * Works with both Clerk and in-house auth
 */
export declare const getUserId: (req: Request) => string | null;
/**
 * Check if user is authenticated
 */
export declare const isAuthenticated: (req: Request) => boolean;
/**
 * Require specific role middleware
 */
export declare const requireRole: (roles: string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
/**
 * Check if using Clerk
 */
export declare const isUsingClerk: () => boolean;
/**
 * Check if using in-house auth
 */
export declare const isUsingInHouseAuth: () => boolean;
declare const _default: {
    authMiddleware: import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>> | ((req: AuthenticatedRequest, _res: Response, next: NextFunction) => Promise<void>);
    requireAuth: (() => import("express").RequestHandler<import("express-serve-static-core").ParamsDictionary, any, any, import("qs").ParsedQs, Record<string, any>>) | (() => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>);
    getAuth: (req: Request) => {
        userId: string | null;
        email: string | null;
        role: string | null;
    };
    getUserId: (req: Request) => string | null;
    isAuthenticated: (req: Request) => boolean;
    requireRole: (roles: string[]) => (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void>;
    isUsingClerk: () => boolean;
    isUsingInHouseAuth: () => boolean;
};
export default _default;
//# sourceMappingURL=authMiddleware.d.ts.map