/**
 * authRoutes.ts - In-House Authentication Routes
 *
 * JWT-based authentication endpoints:
 * - POST /api/auth/signup - Register new user
 * - POST /api/auth/signin - Login user
 * - POST /api/auth/signout - Logout user
 * - POST /api/auth/refresh - Refresh access token
 * - GET /api/auth/me - Get current user
 * - POST /api/auth/verify-email - Verify email with code
 * - POST /api/auth/forgot-password - Request password reset
 * - POST /api/auth/reset-password - Reset password with token
 * - PUT /api/auth/profile - Update user profile
 * - POST /api/auth/change-password - Change password
 * - DELETE /api/auth/delete-account - Delete user account
 */
declare const router: import("express-serve-static-core").Router;
export default router;
//# sourceMappingURL=authRoutes.d.ts.map