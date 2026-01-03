/**
 * Security Middleware
 *
 * HTTP security headers, rate limiting, and request logging
 */
import { Request, Response, NextFunction } from 'express';
export declare const securityHeaders: (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
export declare const generalRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const analysisRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const billingRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const authRateLimit: import("express-rate-limit").RateLimitRequestHandler;
export declare const requestLogger: (req: Request, _res: Response, next: NextFunction) => void;
export declare const secureErrorHandler: (err: Error, _req: Request, res: Response, _next: NextFunction) => void;
declare const _default: {
    securityHeaders: (req: import("http").IncomingMessage, res: import("http").ServerResponse, next: (err?: unknown) => void) => void;
    generalRateLimit: import("express-rate-limit").RateLimitRequestHandler;
    analysisRateLimit: import("express-rate-limit").RateLimitRequestHandler;
    billingRateLimit: import("express-rate-limit").RateLimitRequestHandler;
    authRateLimit: import("express-rate-limit").RateLimitRequestHandler;
    requestLogger: (req: Request, _res: Response, next: NextFunction) => void;
    secureErrorHandler: (err: Error, _req: Request, res: Response, _next: NextFunction) => void;
};
export default _default;
//# sourceMappingURL=security.d.ts.map