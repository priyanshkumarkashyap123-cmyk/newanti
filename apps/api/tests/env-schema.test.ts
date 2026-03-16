/**
 * Tests for API environment schema validation
 *
 * We re-create the Zod schema inline (mirroring config/env.ts) so we can test
 * parsing without triggering the side-effect heavy module-level validation and
 * potential process.exit in the production path.
 */
import { describe, it, expect } from 'vitest';
import z from 'zod';

/**
 * Mirror of the env schema from config/env.ts.
 * If the schema changes there, these tests should be updated accordingly.
 */
const envSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    MONGODB_URI: z.string().min(1).default('mongodb://localhost:27017/beamlab'),
    USE_CLERK: z.string().optional(),
    CLERK_SECRET_KEY: z.string().optional(),
    CLERK_PUBLISHABLE_KEY: z.string().optional(),
    CORS_ALLOWED_ORIGINS: z.string().optional().default(''),
    FRONTEND_URL: z.string().url().optional().default('http://localhost:5173'),
    INTERNAL_SERVICE_SECRET: z.string().optional().default(''),
    // Stripe
    STRIPE_SECRET_KEY: z.string().optional(),
    STRIPE_WEBHOOK_SECRET: z.string().optional(),
    STRIPE_PRO_MONTHLY_PRICE_ID: z.string().optional(),
    STRIPE_PRO_YEARLY_PRICE_ID: z.string().optional(),
    STRIPE_ENTERPRISE_MONTHLY_PRICE_ID: z.string().optional(),
    // PhonePe
    PHONEPE_MERCHANT_ID: z.string().optional(),
    PHONEPE_SALT_KEY: z.string().optional(),
    PHONEPE_SALT_INDEX: z.string().optional().default('1'),
    PHONEPE_ENV: z.enum(['UAT', 'PRODUCTION']).optional().default('UAT'),
    // AI
    GEMINI_API_KEY: z.string().optional(),
    SENTRY_DSN: z.string().url().optional(),
    PYTHON_API_URL: z.string().url().optional().default('http://localhost:8000'),
    RUST_API_URL: z.string().url().optional().default('http://localhost:8080'),
});

describe('API env schema', () => {
    it('parses minimal (empty) env with defaults', () => {
        const result = envSchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.NODE_ENV).toBe('development');
            expect(result.data.PORT).toBe(3001);
            expect(result.data.MONGODB_URI).toBe('mongodb://localhost:27017/beamlab');
            expect(result.data.FRONTEND_URL).toBe('http://localhost:5173');
            expect(result.data.INTERNAL_SERVICE_SECRET).toBe('');
        }
    });

    it('accepts internal service secret when provided', () => {
        const result = envSchema.safeParse({
            INTERNAL_SERVICE_SECRET: 'super-secure-internal-secret',
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.INTERNAL_SERVICE_SECRET).toBe('super-secure-internal-secret');
        }
    });

    it('accepts valid Stripe env vars', () => {
        const result = envSchema.safeParse({
            STRIPE_SECRET_KEY: 'sk_test_123',
            STRIPE_WEBHOOK_SECRET: 'whsec_test_456',
            STRIPE_PRO_MONTHLY_PRICE_ID: 'price_abc',
            STRIPE_PRO_YEARLY_PRICE_ID: 'price_def',
            STRIPE_ENTERPRISE_MONTHLY_PRICE_ID: 'price_ghi',
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.STRIPE_SECRET_KEY).toBe('sk_test_123');
            expect(result.data.STRIPE_PRO_MONTHLY_PRICE_ID).toBe('price_abc');
        }
    });

    it('accepts valid PhonePe env vars', () => {
        const result = envSchema.safeParse({
            PHONEPE_MERCHANT_ID: 'MERCHANT_TEST',
            PHONEPE_SALT_KEY: 'salt_key_test',
            PHONEPE_SALT_INDEX: '1',
            PHONEPE_ENV: 'UAT',
        });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.PHONEPE_MERCHANT_ID).toBe('MERCHANT_TEST');
            expect(result.data.PHONEPE_ENV).toBe('UAT');
        }
    });

    it('rejects invalid NODE_ENV', () => {
        const result = envSchema.safeParse({ NODE_ENV: 'staging' });
        expect(result.success).toBe(false);
    });

    it('rejects invalid FRONTEND_URL (non-URL)', () => {
        const result = envSchema.safeParse({ FRONTEND_URL: 'not-a-url' });
        expect(result.success).toBe(false);
    });

    it('coerces PORT from string to number', () => {
        const result = envSchema.safeParse({ PORT: '8080' });
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.PORT).toBe(8080);
        }
    });

    it('all payment fields are optional (no failure on empty)', () => {
        const result = envSchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
            expect(result.data.STRIPE_SECRET_KEY).toBeUndefined();
            expect(result.data.PHONEPE_MERCHANT_ID).toBeUndefined();
            expect(result.data.STRIPE_PRO_MONTHLY_PRICE_ID).toBeUndefined();
        }
    });
});
