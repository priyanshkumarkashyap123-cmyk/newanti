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

import { Router, Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import axios from 'axios';
import queryString from 'query-string';
import { UserModel, RefreshTokenModel, VerificationCodeModel } from '../models.js';
import { emailService } from '../services/emailService.js';
import {
    validateBody,
    signUpSchema,
    signInSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema,
    updateProfileSchema,
} from '../middleware/validation.js';
import { getCircuitBreaker } from '../utils/circuitBreaker.js';

const router: Router = Router();

// ============================================
// CONFIGURATION
// ============================================

// SECURITY: Never fall back to a hardcoded secret. Crash early if misconfigured.
const JWT_SECRET = process.env['JWT_SECRET'];
const JWT_REFRESH_SECRET = process.env['JWT_REFRESH_SECRET'];

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
    throw new Error(
        'FATAL: JWT_SECRET and JWT_REFRESH_SECRET environment variables are required. ' +
        'Refusing to start with insecure defaults.'
    );
}

const ACCESS_TOKEN_EXPIRY = '15m'; // 15 minutes
const REFRESH_TOKEN_EXPIRY = '7d'; // 7 days
const SALT_ROUNDS = 12;

// OAuth Configurations (From .env)
const GOOGLE_CLIENT_ID = process.env['GOOGLE_CLIENT_ID'];
const GOOGLE_CLIENT_SECRET = process.env['GOOGLE_CLIENT_SECRET'];
const GOOGLE_CALLBACK_URL = process.env['GOOGLE_CALLBACK_URL'] || 'http://localhost:5173/auth/callback/google';

const GITHUB_CLIENT_ID = process.env['GITHUB_CLIENT_ID'];
const GITHUB_CLIENT_SECRET = process.env['GITHUB_CLIENT_SECRET'];
const GITHUB_CALLBACK_URL = process.env['GITHUB_CALLBACK_URL'] || 'http://localhost:5173/auth/callback/github';

const LINKEDIN_CLIENT_ID = process.env['LINKEDIN_CLIENT_ID'];
const LINKEDIN_CLIENT_SECRET = process.env['LINKEDIN_CLIENT_SECRET'];
const LINKEDIN_CALLBACK_URL = process.env['LINKEDIN_CALLBACK_URL'] || 'http://localhost:5173/auth/callback/linkedin';

// ============================================
// TYPES
// ============================================

interface SignUpBody {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    company?: string;
    phone?: string;
}

interface SignInBody {
    email: string;
    password: string;
    rememberMe?: boolean;
}

interface JWTPayload {
    userId: string;
    email: string;
    role: string;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate access token
 */
const generateAccessToken = (user: { id: string; email: string; role: string }): string => {
    return jwt.sign(
        { userId: user.id, email: user.email, role: user.role },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (user: { id: string }): string => {
    return jwt.sign(
        { userId: user.id, type: 'refresh' },
        JWT_REFRESH_SECRET,
        { expiresIn: REFRESH_TOKEN_EXPIRY }
    );
};

/**
 * Generate verification code
 */
const generateVerificationCode = (): string => {
    return crypto.randomInt(100000, 999999).toString();
};

/**
 * Generate password reset token
 */
const generateResetToken = (): string => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Validate email format
 */
const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

/**
 * Validate password strength
 */
const isValidPassword = (password: string): { valid: boolean; message?: string } => {
    if (password.length < 8) {
        return { valid: false, message: 'Password must be at least 8 characters' };
    }
    if (!/[A-Z]/.test(password)) {
        return { valid: false, message: 'Password must contain an uppercase letter' };
    }
    if (!/[a-z]/.test(password)) {
        return { valid: false, message: 'Password must contain a lowercase letter' };
    }
    if (!/[0-9]/.test(password)) {
        return { valid: false, message: 'Password must contain a number' };
    }
    return { valid: true };
};

/**
 * Safely extract error message from unknown values.
 */
const getErrorMessage = (error: unknown, fallback: string): string => {
    if (error instanceof Error) return error.message;
    return fallback;
};

/**
 * Safely extract provider error details from Axios-like errors.
 */
const getProviderErrorDetails = (error: unknown): unknown => {
    if (error && typeof error === 'object' && 'response' in error) {
        return (error as { response?: { data?: unknown } }).response?.data;
    }
    return getErrorMessage(error, 'Unknown error');
};

/**
 * Sanitize user object for response (remove sensitive fields)
 */
const sanitizeUser = (user: any) => {
    return {
        id: user._id?.toString() || user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        role: user.role,
        subscriptionTier: user.subscriptionTier,
        company: user.company,
        phone: user.phone
    };
};

// ============================================
// OAUTH HELPER FUNCTIONS
// ============================================

/**
 * Handle OAuth User Login/Signup
 */
const handleOAuthUser = async (email: string, firstName: string, lastName: string, avatarUrl: string) => {
    let user = await UserModel.findOne({ email: email.toLowerCase() });

    if (!user) {
        // Create new user
        // Generate random password for OAuth users
        const randomPassword = crypto.randomBytes(16).toString('hex');
        const hashedPassword = await bcrypt.hash(randomPassword, SALT_ROUNDS);

        user = await UserModel.create({
            email: email.toLowerCase(),
            password: hashedPassword,
            firstName,
            lastName,
            avatarUrl,
            role: 'user',
            subscriptionTier: 'free',
            emailVerified: true, // Trusted provider
            createdAt: new Date(),
            updatedAt: new Date()
        });
    } else {
        // Update existing user info
        await UserModel.updateOne(
            { _id: user._id },
            {
                $set: {
                    firstName,
                    lastName,
                    avatarUrl: user.avatarUrl || avatarUrl,
                    lastLoginAt: new Date(),
                    emailVerified: true
                }
            }
        );
    }

    // Generate tokens
    const accessToken = generateAccessToken({
        id: user._id.toString(),
        email: user.email,
        role: user.role
    });
    const refreshToken = generateRefreshToken({ id: user._id.toString() });

    // Store refresh token
    await RefreshTokenModel.create({
        userId: user._id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });

    return { user, accessToken, refreshToken };
};

// ============================================
// OAUTH LOGIN REDIRECTS (Initiate Flow)
// ============================================

router.get('/google/login', (req, res) => {
    if (!GOOGLE_CLIENT_ID) return res.status(503).json({ success: false, error: 'Google OAuth not configured' });

    const params = queryString.stringify({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: GOOGLE_CALLBACK_URL,
        response_type: 'code',
        scope: 'openid email profile',
        access_type: 'offline',
        prompt: 'consent'
    });

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

router.get('/github/login', (req, res) => {
    if (!GITHUB_CLIENT_ID) return res.status(503).json({ success: false, error: 'GitHub OAuth not configured' });

    const params = queryString.stringify({
        client_id: GITHUB_CLIENT_ID,
        redirect_uri: GITHUB_CALLBACK_URL,
        scope: 'read:user user:email',
    });

    res.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

router.get('/linkedin/login', (req, res) => {
    if (!LINKEDIN_CLIENT_ID) return res.status(503).json({ success: false, error: 'LinkedIn OAuth not configured' });

    const params = queryString.stringify({
        response_type: 'code',
        client_id: LINKEDIN_CLIENT_ID,
        redirect_uri: LINKEDIN_CALLBACK_URL,
        scope: 'openid profile email',
    });

    res.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`);
});

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/auth/google - Google OAuth
 */
router.post('/google', async (req: Request, res: Response) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ success: false, error: 'Authorization code required' });

        if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
            return res.status(503).json({ success: false, error: 'Google OAuth not configured' });
        }

        // Exchange code for tokens (circuit-breaker protected)
        const googleBreaker = getCircuitBreaker('google-oauth', { failureThreshold: 3, resetTimeoutMs: 60_000 });
        const { data: { access_token } } = await googleBreaker.execute(() =>
            axios.post('https://oauth2.googleapis.com/token', {
                client_id: GOOGLE_CLIENT_ID,
                client_secret: GOOGLE_CLIENT_SECRET,
                code,
                grant_type: 'authorization_code',
                redirect_uri: GOOGLE_CALLBACK_URL,
            })
        );

        // Get user info
        const { data: profile } = await googleBreaker.execute(() =>
            axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
                headers: { Authorization: `Bearer ${access_token}` },
            })
        );

        const result = await handleOAuthUser(
            profile.email,
            profile.given_name,
            profile.family_name || '',
            profile.picture
        );

        res.json({
            success: true,
            user: sanitizeUser(result.user),
            accessToken: result.accessToken,
            refreshToken: result.refreshToken
        });
    } catch (error: unknown) {
        console.error('Google OAuth error:', getProviderErrorDetails(error));
        res.status(500).json({ success: false, error: 'Google authentication failed' });
    }
});

/**
 * POST /api/auth/github - GitHub OAuth
 */
router.post('/github', async (req: Request, res: Response) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ success: false, error: 'Authorization code required' });

        if (!GITHUB_CLIENT_ID || !GITHUB_CLIENT_SECRET) {
            return res.status(503).json({ success: false, error: 'GitHub OAuth not configured' });
        }

        // Exchange code for tokens (circuit-breaker protected)
        const githubBreaker = getCircuitBreaker('github-oauth', { failureThreshold: 3, resetTimeoutMs: 60_000 });
        const { data: tokenData } = await githubBreaker.execute(() =>
            axios.post('https://github.com/login/oauth/access_token', {
                client_id: GITHUB_CLIENT_ID,
                client_secret: GITHUB_CLIENT_SECRET,
                code,
                redirect_uri: GITHUB_CALLBACK_URL
            }, {
                headers: { Accept: 'application/json' }
            })
        );

        if (tokenData.error) throw new Error(tokenData.error_description);

        // Get user info
        const { data: profile } = await githubBreaker.execute(() =>
            axios.get('https://api.github.com/user', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            })
        );

        // Get user email (might be private)
        let email = profile.email;
        if (!email) {
            const { data: emails } = await githubBreaker.execute(() =>
                axios.get('https://api.github.com/user/emails', {
                    headers: { Authorization: `Bearer ${tokenData.access_token}` },
                })
            );
            const primary = emails.find((e: any) => e.primary && e.verified);
            email = primary ? primary.email : emails[0].email;
        }

        const [firstName, ...lastNameParts] = (profile.name || profile.login).split(' ');
        const lastName = lastNameParts.join(' ');

        const result = await handleOAuthUser(
            email,
            firstName,
            lastName || '',
            profile.avatar_url
        );

        res.json({
            success: true,
            user: sanitizeUser(result.user),
            accessToken: result.accessToken,
            refreshToken: result.refreshToken
        });

    } catch (error: unknown) {
        console.error('GitHub OAuth error:', getProviderErrorDetails(error));
        res.status(500).json({ success: false, error: 'GitHub authentication failed' });
    }
});

/**
 * POST /api/auth/linkedin - LinkedIn OAuth
 */
router.post('/linkedin', async (req: Request, res: Response) => {
    try {
        const { code } = req.body;
        if (!code) return res.status(400).json({ success: false, error: 'Authorization code required' });

        if (!LINKEDIN_CLIENT_ID || !LINKEDIN_CLIENT_SECRET) {
            return res.status(503).json({ success: false, error: 'LinkedIn OAuth not configured' });
        }

        // Exchange code for tokens
        const tokenParams = new URLSearchParams({
            grant_type: 'authorization_code',
            code,
            redirect_uri: LINKEDIN_CALLBACK_URL,
            client_id: LINKEDIN_CLIENT_ID,
            client_secret: LINKEDIN_CLIENT_SECRET,
        });

        // Exchange code for tokens (circuit-breaker protected)
        const linkedinBreaker = getCircuitBreaker('linkedin-oauth', { failureThreshold: 3, resetTimeoutMs: 60_000 });
        const { data: tokenData } = await linkedinBreaker.execute(() =>
            axios.post('https://www.linkedin.com/oauth/v2/accessToken',
                tokenParams.toString(),
                { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
            )
        );

        // Get user info
        const { data: profile } = await linkedinBreaker.execute(() =>
            axios.get('https://api.linkedin.com/v2/userinfo', {
                headers: { Authorization: `Bearer ${tokenData.access_token}` },
            })
        );

        const result = await handleOAuthUser(
            profile.email,
            profile.given_name,
            profile.family_name,
            profile.picture
        );

        res.json({
            success: true,
            user: sanitizeUser(result.user),
            accessToken: result.accessToken,
            refreshToken: result.refreshToken
        });

    } catch (error: unknown) {
        console.error('LinkedIn OAuth error:', getProviderErrorDetails(error));
        res.status(500).json({ success: false, error: 'LinkedIn authentication failed' });
    }
});

// ============================================
// ROUTES
// ============================================

/**
 * POST /api/auth/signup - Register new user
 */
router.post('/signup', validateBody(signUpSchema), async (req: Request, res: Response) => {
    try {
        // Body is already validated & transformed by Zod middleware
        const { email, password, firstName, lastName, company, phone } = req.body;

        // Check if user already exists
        const existingUser = await UserModel.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            res.status(409).json({
                success: false,
                message: 'An account with this email already exists',
                errors: { email: 'Email already registered' }
            });
            return;
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        // Create user
        const user = await UserModel.create({
            email: email.toLowerCase(),
            password: hashedPassword,
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            company: company?.trim(),
            phone: phone?.trim(),
            role: 'user',
            subscriptionTier: 'free',
            emailVerified: false,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        // Generate tokens
        const accessToken = generateAccessToken({
            id: user._id.toString(),
            email: user.email,
            role: user.role
        });
        const refreshToken = generateRefreshToken({ id: user._id.toString() });

        // Store refresh token
        await RefreshTokenModel.create({
            userId: user._id,
            token: refreshToken,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        });

        // Generate verification code
        const verificationCode = generateVerificationCode();
        await VerificationCodeModel.create({
            userId: user._id,
            code: verificationCode,
            type: 'email',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        });

        // Send verification email
        try {
            await emailService.sendVerificationEmail(user.email, user.firstName, verificationCode);
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            // Continue signup even if email fails - user can request resend
        }

        res.status(201).json({
            success: true,
            user: sanitizeUser(user),
            accessToken,
            refreshToken,
            message: 'Account created successfully. Please verify your email.'
        });
    } catch (error) {
        console.error('Signup error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create account. Please try again.'
        });
    }
});

/**
 * POST /api/auth/signin - Login user
 */
router.post('/signin', validateBody(signInSchema), async (req: Request, res: Response) => {
    try {
        // Body is already validated & transformed by Zod middleware
        const { email, password, rememberMe } = req.body;

        // Find user
        const user = await UserModel.findOne({ email: email.toLowerCase() });
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate tokens
        const accessToken = generateAccessToken({
            id: user._id.toString(),
            email: user.email,
            role: user.role
        });
        const refreshToken = generateRefreshToken({ id: user._id.toString() });

        // Store refresh token
        await RefreshTokenModel.create({
            userId: user._id,
            token: refreshToken,
            expiresAt: new Date(Date.now() + (rememberMe ? 30 : 7) * 24 * 60 * 60 * 1000)
        });

        // Update last login
        await UserModel.updateOne(
            { _id: user._id },
            { $set: { lastLoginAt: new Date() } }
        );

        res.json({
            success: true,
            user: sanitizeUser(user),
            accessToken,
            refreshToken
        });
    } catch (error) {
        console.error('Signin error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sign in. Please try again.'
        });
    }
});

/**
 * POST /api/auth/signout - Logout user
 */
router.post('/signout', async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (refreshToken) {
            // Remove refresh token from database
            await RefreshTokenModel.deleteOne({ token: refreshToken });
        }

        res.json({ success: true, message: 'Signed out successfully' });
    } catch (error) {
        console.error('Signout error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to sign out'
        });
    }
});

/**
 * POST /api/auth/refresh - Refresh access token
 */
router.post('/refresh', async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token required'
            });
        }

        // Verify refresh token
        let decoded: any;
        try {
            decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
        } catch {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired refresh token'
            });
        }

        // Check if token exists in database
        const storedToken = await RefreshTokenModel.findOne({ token: refreshToken });
        if (!storedToken) {
            return res.status(401).json({
                success: false,
                message: 'Refresh token has been revoked'
            });
        }

        // Check if token is expired
        if (storedToken.expiresAt < new Date()) {
            await RefreshTokenModel.deleteOne({ _id: storedToken._id });
            return res.status(401).json({
                success: false,
                message: 'Refresh token expired'
            });
        }

        // Get user
        const user = await UserModel.findById(decoded.userId);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found'
            });
        }

        // Generate new access token
        const newAccessToken = generateAccessToken({
            id: user._id.toString(),
            email: user.email,
            role: user.role
        });

        // Optionally rotate refresh token
        const newRefreshToken = generateRefreshToken({ id: user._id.toString() });
        await RefreshTokenModel.updateOne(
            { _id: storedToken._id },
            {
                $set: {
                    token: newRefreshToken,
                    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                }
            }
        );

        res.json({
            success: true,
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        });
    } catch (error) {
        console.error('Refresh error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to refresh token'
        });
    }
});

/**
 * GET /api/auth/me - Get current user
 */
router.get('/me', async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const token = authHeader.split(' ')[1];

        let decoded: JWTPayload;
        try {
            decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
        } catch {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired token'
            });
        }

        const user = await UserModel.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({ success: true, data: sanitizeUser(user) });
    } catch (error) {
        console.error('Get user error:', error);
        res.status(500).json({ success: false, error: 'Failed to get user' });
    }
});

/**
 * POST /api/auth/verify-email - Verify email with code
 */
router.post('/verify-email', async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

        const { code } = req.body;
        if (!code) {
            return res.status(400).json({
                success: false,
                message: 'Verification code required'
            });
        }

        // Find verification code
        const verification = await VerificationCodeModel.findOne({
            userId: decoded.userId,
            code,
            type: 'email',
            expiresAt: { $gt: new Date() }
        });

        if (!verification) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired verification code'
            });
        }

        // Update user
        await UserModel.updateOne(
            { _id: decoded.userId },
            { $set: { emailVerified: true, updatedAt: new Date() } }
        );

        // Delete verification code
        await VerificationCodeModel.deleteOne({ _id: verification._id });

        res.json({
            success: true,
            message: 'Email verified successfully'
        });
    } catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify email'
        });
    }
});

/**
 * POST /api/auth/forgot-password - Request password reset
 */
router.post('/forgot-password', validateBody(forgotPasswordSchema), async (req: Request, res: Response) => {
    try {
        // Body is already validated & transformed by Zod middleware
        const { email } = req.body;

        const user = await UserModel.findOne({ email });

        // Always return success to prevent email enumeration
        if (!user) {
            return res.json({
                success: true,
                message: 'If an account exists with this email, you will receive a password reset link.'
            });
        }

        // Generate reset token
        const resetToken = generateResetToken();
        const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Store reset token
        await VerificationCodeModel.create({
            userId: user._id,
            code: resetTokenHash,
            type: 'password_reset',
            expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
        });

        // Send password reset email
        try {
            await emailService.sendPasswordResetEmail(user.email, user.firstName, resetToken);
        } catch (emailError) {
            console.error('Failed to send password reset email:', emailError);
            // Continue - user can request to resend
        }

        res.json({
            success: true,
            message: 'If an account exists with this email, you will receive a password reset link.'
        });
    } catch (error) {
        console.error('Forgot password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to process request'
        });
    }
});

/**
 * POST /api/auth/reset-password - Reset password with token
 */
router.post('/reset-password', validateBody(resetPasswordSchema), async (req: Request, res: Response) => {
    try {
        // Body is already validated by Zod middleware
        const { token, password: newPassword } = req.body;

        // Hash token for lookup
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

        // Find reset token
        const resetRecord = await VerificationCodeModel.findOne({
            code: tokenHash,
            type: 'password_reset',
            expiresAt: { $gt: new Date() }
        });

        if (!resetRecord) {
            return res.status(400).json({
                success: false,
                message: 'Invalid or expired reset token'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

        // Update user password
        await UserModel.updateOne(
            { _id: resetRecord.userId },
            { $set: { password: hashedPassword, updatedAt: new Date() } }
        );

        // Delete reset token
        await VerificationCodeModel.deleteOne({ _id: resetRecord._id });

        // Invalidate all refresh tokens for this user
        await RefreshTokenModel.deleteMany({ userId: resetRecord.userId });

        res.json({
            success: true,
            message: 'Password reset successfully. Please sign in with your new password.'
        });
    } catch (error) {
        console.error('Reset password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to reset password'
        });
    }
});

/**
 * PUT /api/auth/profile - Update user profile
 */
router.put('/profile', validateBody(updateProfileSchema), async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

        const { firstName, lastName, avatarUrl, company, phone } = req.body;

        const updates: any = { updatedAt: new Date() };
        if (firstName !== undefined) updates.firstName = firstName.trim();
        if (lastName !== undefined) updates.lastName = lastName.trim();
        if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;
        if (company !== undefined) updates.company = company.trim();
        if (phone !== undefined) updates.phone = phone.trim();

        const user = await UserModel.findByIdAndUpdate(
            decoded.userId,
            { $set: updates },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json(sanitizeUser(user));
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to update profile'
        });
    }
});

/**
 * POST /api/auth/change-password - Change password
 */
router.post('/change-password', validateBody(changePasswordSchema), async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

        // Body is already validated by Zod middleware
        const { currentPassword, newPassword } = req.body;

        const user = await UserModel.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify current password
        const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Current password is incorrect'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);

        // Update password
        await UserModel.updateOne(
            { _id: user._id },
            { $set: { password: hashedPassword, updatedAt: new Date() } }
        );

        res.json({
            success: true,
            message: 'Password changed successfully'
        });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to change password'
        });
    }
});

/**
 * DELETE /api/auth/delete-account - Delete user account
 */
router.delete('/delete-account', async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ success: false, error: 'Not authenticated' });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

        const { password } = req.body;

        if (!password) {
            return res.status(400).json({
                success: false,
                message: 'Password is required to delete account'
            });
        }

        const user = await UserModel.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Incorrect password'
            });
        }

        // Delete user data
        await RefreshTokenModel.deleteMany({ userId: user._id });
        await VerificationCodeModel.deleteMany({ userId: user._id });
        await UserModel.deleteOne({ _id: user._id });

        res.json({
            success: true,
            message: 'Account deleted successfully'
        });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to delete account'
        });
    }
});

/**
 * GET /api/auth/check-email - Check if email is available
 */
router.get('/check-email', async (req: Request, res: Response) => {
    try {
        const email = req.query['email'] as string;

        if (!email) {
            return res.status(400).json({ available: false });
        }

        const existingUser = await UserModel.findOne({ email: email.toLowerCase() });
        res.json({ available: !existingUser });
    } catch (error) {
        console.error('Check email error:', error);
        res.json({ available: false });
    }
});

/**
 * POST /api/auth/resend-verification - Resend verification email
 */
router.post('/resend-verification', async (req: Request, res: Response) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Not authenticated'
            });
        }

        const token = authHeader.split(' ')[1];
        const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;

        const user = await UserModel.findById(decoded.userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        if (user.emailVerified) {
            return res.status(400).json({
                success: false,
                message: 'Email already verified'
            });
        }

        // Generate new verification code
        const verificationCode = generateVerificationCode();

        // Delete old codes
        await VerificationCodeModel.deleteMany({
            userId: user._id,
            type: 'email'
        });

        // Create new code
        await VerificationCodeModel.create({
            userId: user._id,
            code: verificationCode,
            type: 'email',
            expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
        });

        // Send verification email
        try {
            await emailService.sendVerificationEmail(user.email, user.firstName, verificationCode);
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            return res.status(500).json({
                success: false,
                message: 'Failed to send verification email. Please try again later.'
            });
        }

        res.json({
            success: true,
            message: 'Verification email sent successfully'
        });
    } catch (error) {
        console.error('Resend verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to resend verification email'
        });
    }
});

export default router;
