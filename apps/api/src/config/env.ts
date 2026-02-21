/**
 * Environment Configuration & Validation
 *
 * Centralised env-var validation that runs ONCE at import time.
 * In production, missing critical variables crash the process immediately
 * instead of failing silently at runtime when a user hits a broken endpoint.
 *
 * Usage:
 *   import { env } from './config/env.js';
 *   console.log(env.PORT);            // typed, validated
 *   console.log(env.MONGODB_URI);     // guaranteed non-empty in prod
 */

import { z } from 'zod';

// ============================================
// SCHEMA
// ============================================

const envSchema = z.object({
    // Server
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),

    // Database
    MONGODB_URI: z.string().min(1, 'MONGODB_URI is required').default('mongodb://localhost:27017/beamlab'),

    // Auth — JWT secrets are validated separately in authRoutes.ts (crash on missing)
    USE_CLERK: z.string().optional(),
    CLERK_SECRET_KEY: z.string().optional(),
    CLERK_PUBLISHABLE_KEY: z.string().optional(),

    // CORS
    CORS_ALLOWED_ORIGINS: z.string().optional().default(''),
    FRONTEND_URL: z.string().url().optional().default('http://localhost:5173'),

    // Payments
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),

    // AI
    GEMINI_API_KEY: z.string().optional(),

    // Observability
    SENTRY_DSN: z.string().url().optional(),

    // Inter-service
    PYTHON_API_URL: z.string().url().optional().default('http://localhost:8000'),
    RUST_API_URL: z.string().url().optional().default('http://localhost:8080'),
});

// ============================================
// VALIDATE
// ============================================

const result = envSchema.safeParse(process.env);

if (!result.success) {
    const formatted = result.error.issues
        .map(i => `  • ${i.path.join('.')}: ${i.message}`)
        .join('\n');

    const isProduction = process.env.NODE_ENV === 'production';

    if (isProduction) {
        console.error(`\n❌ FATAL: Environment validation failed in PRODUCTION:\n${formatted}\n`);
        process.exit(1);
    } else {
        console.warn(`\n⚠️  Environment validation warnings (non-fatal in dev):\n${formatted}\n`);
    }
}

/**
 * Typed, validated environment variables.
 * Access via `env.PORT`, `env.MONGODB_URI`, etc.
 */
export const env = result.success ? result.data : (envSchema.parse({
    ...process.env,
    // Provide safe dev defaults when validation fails in dev mode
    NODE_ENV: process.env.NODE_ENV || 'development',
    PORT: process.env.PORT || '3001',
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/beamlab',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
    PYTHON_API_URL: process.env.PYTHON_API_URL || 'http://localhost:8000',
    RUST_API_URL: process.env.RUST_API_URL || 'http://localhost:8080',
}));

export type Env = z.infer<typeof envSchema>;
