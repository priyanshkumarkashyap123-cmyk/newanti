/**
 * Razorpay Billing Service
 * Subscription creation and webhook handling for Indian SaaS
 */

import * as crypto from 'crypto';
import { Request, Response, Router } from 'express';
import { User, Subscription } from './models.js';
import { createRequire } from 'module';

// ESM-compatible require for razorpay CommonJS module
const require = createRequire(import.meta.url);
const Razorpay = require('razorpay');

// ============================================
// RAZORPAY INITIALIZATION
// ============================================

const RAZORPAY_KEY_ID = process.env['RAZORPAY_KEY_ID'] ?? '';
const RAZORPAY_KEY_SECRET = process.env['RAZORPAY_KEY_SECRET'] ?? '';
const RAZORPAY_WEBHOOK_SECRET = process.env['RAZORPAY_WEBHOOK_SECRET'] ?? '';

// Initialize Razorpay only if credentials are available
let razorpay: InstanceType<typeof Razorpay> | null = null;

if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
        key_id: RAZORPAY_KEY_ID,
        key_secret: RAZORPAY_KEY_SECRET
    });
    console.log('✅ Razorpay initialized');
} else {
    console.warn('⚠️ Missing Razorpay credentials - payment features disabled');
}

// ============================================
// PLAN CONFIGURATION
// ============================================

const PLANS = {
    PRO_MONTHLY: process.env['RAZORPAY_PRO_MONTHLY_PLAN_ID'] ?? 'plan_xxx',
    PRO_YEARLY: process.env['RAZORPAY_PRO_YEARLY_PLAN_ID'] ?? 'plan_yyy',
    ENTERPRISE_MONTHLY: process.env['RAZORPAY_ENTERPRISE_MONTHLY_PLAN_ID'] ?? 'plan_zzz',
};

// ============================================
// RAZORPAY BILLING SERVICE
// ============================================

export class RazorpayBillingService {
    /**
     * Create a Razorpay subscription
     */
    static async createSubscription(
        userId: string,
        email: string,
        planId?: string,
        planType: 'monthly' | 'yearly' = 'monthly'
    ): Promise<{ subscriptionId: string; shortUrl?: string }> {
        // Get or create user
        let user = await User.findOne({ clerkId: userId });

        if (!user) {
            user = await User.create({
                clerkId: userId,
                email,
                tier: 'free'
            });
        }

        // Select plan
        const selectedPlanId = planId ?? (planType === 'yearly' ? PLANS.PRO_YEARLY : PLANS.PRO_MONTHLY);

        // Check if Razorpay is configured
        if (!razorpay) {
            throw new Error('Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.');
        }

        // Create Razorpay subscription
        const subscription = await razorpay.subscriptions.create({
            plan_id: selectedPlanId,
            total_count: planType === 'yearly' ? 1 : 12,
            customer_notify: 1,
            notes: {
                userId,
                email
            }
        });

        // Store subscription reference
        await Subscription.findOneAndUpdate(
            { user: user._id },
            {
                stripeCustomerId: subscription.id,  // Reusing field for Razorpay
                stripeSubscriptionId: subscription.id,
                status: 'incomplete'
            },
            { upsert: true, new: true }
        );

        return {
            subscriptionId: subscription.id,
            shortUrl: subscription.short_url
        };
    }

    /**
     * Verify Razorpay payment signature
     */
    static verifyPaymentSignature(
        paymentId: string,
        subscriptionId: string,
        signature: string
    ): boolean {
        const body = paymentId + '|' + subscriptionId;
        const expectedSignature = crypto
            .createHmac('sha256', RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex');

        return expectedSignature === signature;
    }

    /**
     * Verify webhook signature (HMAC-SHA256)
     */
    static verifyWebhookSignature(
        body: string,
        signature: string
    ): boolean {
        const expectedSignature = crypto
            .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
            .update(body)
            .digest('hex');

        return expectedSignature === signature;
    }

    /**
     * Handle webhook events
     */
    static async handleWebhook(
        event: string,
        payload: RazorpayWebhookPayload
    ): Promise<{ success: boolean; message: string }> {
        console.log(`📩 Razorpay webhook: ${event}`);

        switch (event) {
            case 'subscription.charged':
                await this.handleSubscriptionCharged(payload);
                return { success: true, message: 'Subscription charged processed' };

            case 'subscription.activated':
                await this.handleSubscriptionActivated(payload);
                return { success: true, message: 'Subscription activated' };

            case 'subscription.completed':
                await this.handleSubscriptionCompleted(payload);
                return { success: true, message: 'Subscription completed' };

            case 'subscription.cancelled':
                await this.handleSubscriptionCancelled(payload);
                return { success: true, message: 'Subscription cancelled' };

            case 'payment.failed':
                await this.handlePaymentFailed(payload);
                return { success: true, message: 'Payment failure recorded' };

            default:
                return { success: true, message: `Unhandled event: ${event}` };
        }
    }

    /**
     * Handle subscription.charged - UPDATE USER TO PRO
     */
    private static async handleSubscriptionCharged(payload: RazorpayWebhookPayload): Promise<void> {
        const subscriptionId = payload.subscription?.entity?.id;
        if (!subscriptionId) return;

        // Find subscription in database
        const subscription = await Subscription.findOne({
            stripeSubscriptionId: subscriptionId
        });
        if (!subscription) {
            console.log(`Subscription ${subscriptionId} not found in database`);
            return;
        }

        // Update subscription status
        subscription.status = 'active';
        if (payload.subscription?.entity?.current_end) {
            subscription.currentPeriodEnd = new Date(payload.subscription.entity.current_end * 1000);
        }
        await subscription.save();

        // Update user tier to PRO
        const user = await User.findById(subscription.user);
        if (user) {
            user.tier = 'pro';
            await user.save();
            console.log(`✅ User ${user.clerkId} upgraded to PRO via Razorpay`);
        }
    }

    /**
     * Handle subscription activated
     */
    private static async handleSubscriptionActivated(payload: RazorpayWebhookPayload): Promise<void> {
        const subscriptionId = payload.subscription?.entity?.id;
        if (!subscriptionId) return;

        const subscription = await Subscription.findOne({
            stripeSubscriptionId: subscriptionId
        });
        if (!subscription) return;

        subscription.status = 'active';
        await subscription.save();
    }

    /**
     * Handle subscription completed
     */
    private static async handleSubscriptionCompleted(payload: RazorpayWebhookPayload): Promise<void> {
        const subscriptionId = payload.subscription?.entity?.id;
        if (!subscriptionId) return;

        const subscription = await Subscription.findOne({
            stripeSubscriptionId: subscriptionId
        });
        if (!subscription) return;

        subscription.status = 'canceled';
        await subscription.save();

        // Downgrade user
        const user = await User.findById(subscription.user);
        if (user) {
            user.tier = 'free';
            await user.save();
            console.log(`📤 User ${user.clerkId} subscription completed, downgraded to FREE`);
        }
    }

    /**
     * Handle subscription cancelled
     */
    private static async handleSubscriptionCancelled(payload: RazorpayWebhookPayload): Promise<void> {
        const subscriptionId = payload.subscription?.entity?.id;
        if (!subscriptionId) return;

        const subscription = await Subscription.findOne({
            stripeSubscriptionId: subscriptionId
        });
        if (!subscription) return;

        subscription.status = 'canceled';
        await subscription.save();

        // Downgrade user
        const user = await User.findById(subscription.user);
        if (user) {
            user.tier = 'free';
            await user.save();
            console.log(`📤 User ${user.clerkId} subscription cancelled`);
        }
    }

    /**
     * Handle payment failed
     */
    private static async handlePaymentFailed(payload: RazorpayWebhookPayload): Promise<void> {
        const subscriptionId = payload.subscription?.entity?.id;
        if (!subscriptionId) return;

        const subscription = await Subscription.findOne({
            stripeSubscriptionId: subscriptionId
        });
        if (!subscription) return;

        subscription.status = 'past_due';
        await subscription.save();
        console.log(`⚠️ Payment failed for subscription ${subscriptionId}`);
    }
}

// ============================================
// WEBHOOK PAYLOAD TYPE
// ============================================

interface RazorpayWebhookPayload {
    subscription?: {
        entity?: {
            id?: string;
            plan_id?: string;
            customer_id?: string;
            status?: string;
            current_start?: number;
            current_end?: number;
            notes?: Record<string, string>;
        };
    };
    payment?: {
        entity?: {
            id?: string;
            amount?: number;
            currency?: string;
            status?: string;
        };
    };
}

// ============================================
// EXPRESS ROUTER
// ============================================

export const razorpayRouter = Router();

/**
 * POST /api/create-subscription
 * Create Razorpay subscription
 */
razorpayRouter.post('/create-subscription', async (req: Request, res: Response) => {
    try {
        const { userId, email, planId, planType } = req.body;

        if (!userId || !email) {
            res.status(400).json({ success: false, message: 'Missing userId or email' });
            return;
        }

        const result = await RazorpayBillingService.createSubscription(
            userId,
            email,
            planId,
            planType
        );

        res.json({
            success: true,
            subscriptionId: result.subscriptionId,
            shortUrl: result.shortUrl,
            keyId: RAZORPAY_KEY_ID  // Frontend needs this to open checkout
        });
    } catch (error) {
        console.error('Create subscription error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, message });
    }
});

/**
 * POST /api/verify-payment
 * Verify Razorpay payment signature
 */
razorpayRouter.post('/verify-payment', async (req: Request, res: Response) => {
    try {
        const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature, userId } = req.body;

        if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
            res.status(400).json({ success: false, message: 'Missing payment details' });
            return;
        }

        const isValid = RazorpayBillingService.verifyPaymentSignature(
            razorpay_payment_id,
            razorpay_subscription_id,
            razorpay_signature
        );

        if (!isValid) {
            res.status(400).json({ success: false, message: 'Invalid signature' });
            return;
        }

        // Update user to PRO (webhook will also do this, but this provides immediate feedback)
        if (userId) {
            const user = await User.findOne({ clerkId: userId });
            if (user) {
                user.tier = 'pro';
                await user.save();
            }
        }

        res.json({ success: true, message: 'Payment verified successfully' });
    } catch (error) {
        console.error('Verify payment error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, message });
    }
});

/**
 * POST /api/webhooks/razorpay
 * Razorpay webhook handler
 */
razorpayRouter.post('/webhooks/razorpay', async (req: Request, res: Response) => {
    const signature = req.headers['x-razorpay-signature'] as string;

    if (!signature) {
        res.status(400).json({ message: 'Missing x-razorpay-signature header' });
        return;
    }

    try {
        // Verify webhook signature
        const body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        const isValid = RazorpayBillingService.verifyWebhookSignature(body, signature);

        if (!isValid) {
            res.status(400).json({ message: 'Invalid webhook signature' });
            return;
        }

        // Parse payload
        const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        const event = payload.event as string;

        const result = await RazorpayBillingService.handleWebhook(event, payload.payload);

        res.json(result);
    } catch (error) {
        console.error('Webhook error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(400).json({ message });
    }
});

export default RazorpayBillingService;
