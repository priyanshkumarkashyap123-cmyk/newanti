/**
 * BillingService - Stripe Payment Integration
 * Checkout session creation and webhook handling
 */

import Stripe from 'stripe';
import { Request, Response, Router } from 'express';
import { User, Subscription } from './models.js';

// ============================================
// STRIPE INITIALIZATION
// ============================================

const STRIPE_SECRET_KEY = process.env['STRIPE_SECRET_KEY'] ?? '';
const STRIPE_WEBHOOK_SECRET = process.env['STRIPE_WEBHOOK_SECRET'] ?? '';
const FRONTEND_URL = process.env['FRONTEND_URL'] ?? 'http://localhost:5173';

if (!STRIPE_SECRET_KEY) {
    console.warn('⚠️ Missing STRIPE_SECRET_KEY environment variable');
}

const stripe = new Stripe(STRIPE_SECRET_KEY);

// ============================================
// PRICE CONFIGURATION
// ============================================

const PRICES = {
    PRO_MONTHLY: process.env['STRIPE_PRO_MONTHLY_PRICE_ID'] ?? 'price_xxx',
    PRO_YEARLY: process.env['STRIPE_PRO_YEARLY_PRICE_ID'] ?? 'price_yyy',
    ENTERPRISE_MONTHLY: process.env['STRIPE_ENTERPRISE_MONTHLY_PRICE_ID'] ?? 'price_zzz',
};

// ============================================
// BILLING SERVICE
// ============================================

export class BillingService {
    /**
     * Create a Stripe checkout session
     */
    static async createCheckoutSession(
        userId: string,
        email: string,
        priceId: string,
        successUrl?: string,
        cancelUrl?: string
    ): Promise<Stripe.Checkout.Session> {
        // Get or create Stripe customer
        let user = await User.findOne({ clerkId: userId });
        let customerId: string;

        if (user?.subscription) {
            const subscription = await Subscription.findById(user.subscription);
            customerId = subscription?.stripeCustomerId ?? '';
        }

        if (!customerId!) {
            // Create new Stripe customer
            const customer = await stripe.customers.create({
                email,
                metadata: { clerkId: userId }
            });
            customerId = customer.id;
        }

        // Create checkout session
        const session = await stripe.checkout.sessions.create({
            customer: customerId,
            mode: 'subscription',
            payment_method_types: ['card'],
            line_items: [
                {
                    price: priceId,
                    quantity: 1
                }
            ],
            success_url: successUrl ?? `${FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: cancelUrl ?? `${FRONTEND_URL}/billing/canceled`,
            metadata: {
                clerkId: userId
            },
            subscription_data: {
                metadata: {
                    clerkId: userId
                }
            }
        });

        return session;
    }

    /**
     * Handle Stripe webhook events
     */
    static async handleWebhook(
        payload: Buffer,
        signature: string
    ): Promise<{ received: boolean; event?: string }> {
        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(
                payload,
                signature,
                STRIPE_WEBHOOK_SECRET
            );
        } catch (err) {
            console.error('Webhook signature verification failed:', err);
            throw new Error('Invalid webhook signature');
        }

        // Handle specific events
        switch (event.type) {
            case 'checkout.session.completed':
                await this.handleCheckoutComplete(event.data.object as Stripe.Checkout.Session);
                break;

            case 'invoice.payment_succeeded':
                await this.handlePaymentSuccess(event.data.object as Stripe.Invoice);
                break;

            case 'invoice.payment_failed':
                await this.handlePaymentFailed(event.data.object as Stripe.Invoice);
                break;

            case 'customer.subscription.updated':
                await this.handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
                break;

            case 'customer.subscription.deleted':
                await this.handleSubscriptionCanceled(event.data.object as Stripe.Subscription);
                break;
        }

        return { received: true, event: event.type };
    }

    /**
     * Handle checkout session completion
     */
    private static async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
        const clerkId = session.metadata?.['clerkId'];
        if (!clerkId) return;

        const user = await User.findOne({ clerkId });
        if (!user) return;

        // Create or update subscription record
        const subscription = await Subscription.findOneAndUpdate(
            { user: user._id },
            {
                stripeCustomerId: session.customer as string,
                stripeSubscriptionId: session.subscription as string,
                status: 'active'
            },
            { upsert: true, new: true }
        );

        // Update user
        user.subscription = subscription._id;
        user.tier = 'pro';
        await user.save();

        console.log(`✅ User ${clerkId} upgraded to PRO`);
    }

    /**
     * Handle successful payment - UPDATE TIER TO PRO
     */
    private static async handlePaymentSuccess(invoice: Stripe.Invoice): Promise<void> {
        const customerId = invoice.customer as string;

        // Find subscription by Stripe customer ID
        const subscription = await Subscription.findOne({ stripeCustomerId: customerId });
        if (!subscription) return;

        // Update subscription status
        subscription.status = 'active';
        if (invoice.lines.data[0]?.period) {
            subscription.currentPeriodStart = new Date(invoice.lines.data[0].period.start * 1000);
            subscription.currentPeriodEnd = new Date(invoice.lines.data[0].period.end * 1000);
        }
        await subscription.save();

        // Update user tier to PRO
        const user = await User.findById(subscription.user);
        if (user && user.tier !== 'enterprise') {
            user.tier = 'pro';
            await user.save();
            console.log(`✅ Payment succeeded for user ${user.clerkId}, tier set to PRO`);
        }
    }

    /**
     * Handle failed payment
     */
    private static async handlePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
        const customerId = invoice.customer as string;

        const subscription = await Subscription.findOne({ stripeCustomerId: customerId });
        if (!subscription) return;

        subscription.status = 'past_due';
        await subscription.save();

        console.log(`⚠️ Payment failed for customer ${customerId}`);
    }

    /**
     * Handle subscription update
     */
    private static async handleSubscriptionUpdate(stripeSub: Stripe.Subscription): Promise<void> {
        const subscription = await Subscription.findOne({
            stripeSubscriptionId: stripeSub.id
        });
        if (!subscription) return;

        const stripeData = stripeSub as unknown as {
            status: string;
            cancel_at_period_end: boolean;
            current_period_end: number
        };

        subscription.status = stripeData.status as typeof subscription.status;
        subscription.cancelAtPeriodEnd = stripeData.cancel_at_period_end;
        if (stripeData.current_period_end) {
            subscription.currentPeriodEnd = new Date(stripeData.current_period_end * 1000);
        }
        await subscription.save();
    }

    /**
     * Handle subscription cancellation
     */
    private static async handleSubscriptionCanceled(stripeSub: Stripe.Subscription): Promise<void> {
        const subscription = await Subscription.findOne({
            stripeSubscriptionId: stripeSub.id
        });
        if (!subscription) return;

        subscription.status = 'canceled';
        await subscription.save();

        // Downgrade user to free tier
        const user = await User.findById(subscription.user);
        if (user) {
            user.tier = 'free';
            await user.save();
            console.log(`📤 User ${user.clerkId} downgraded to FREE`);
        }
    }

    /**
     * Get customer portal URL
     */
    static async createPortalSession(customerId: string): Promise<Stripe.BillingPortal.Session> {
        return stripe.billingPortal.sessions.create({
            customer: customerId,
            return_url: `${FRONTEND_URL}/settings`
        });
    }
}

// ============================================
// EXPRESS ROUTER
// ============================================

export const billingRouter = Router();

/**
 * POST /api/checkout
 * Create Stripe checkout session
 */
billingRouter.post('/checkout', async (req: Request, res: Response) => {
    try {
        const { userId, email, priceId, plan } = req.body;

        if (!userId || !email) {
            res.status(400).json({ success: false, message: 'Missing userId or email' });
            return;
        }

        const selectedPriceId = priceId ?? (plan === 'yearly' ? PRICES.PRO_YEARLY : PRICES.PRO_MONTHLY);

        const session = await BillingService.createCheckoutSession(
            userId,
            email,
            selectedPriceId
        );

        res.json({
            success: true,
            sessionId: session.id,
            url: session.url
        });
    } catch (error) {
        console.error('Checkout error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, message });
    }
});

/**
 * POST /api/webhook
 * Stripe webhook handler
 */
billingRouter.post('/webhook', async (req: Request, res: Response) => {
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
        res.status(400).json({ message: 'Missing stripe-signature header' });
        return;
    }

    try {
        // Note: req.body must be the raw buffer for webhook verification
        // Make sure to use express.raw() middleware for this route
        const result = await BillingService.handleWebhook(
            req.body as Buffer,
            signature
        );

        res.json(result);
    } catch (error) {
        console.error('Webhook error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(400).json({ message });
    }
});

/**
 * POST /api/billing/portal
 * Create customer portal session
 */
billingRouter.post('/portal', async (req: Request, res: Response) => {
    try {
        const { userId } = req.body;

        const user = await User.findOne({ clerkId: userId }).populate('subscription');
        if (!user?.subscription) {
            res.status(404).json({ success: false, message: 'No subscription found' });
            return;
        }

        const subscription = await Subscription.findById(user.subscription);
        if (!subscription) {
            res.status(404).json({ success: false, message: 'Subscription not found' });
            return;
        }

        const session = await BillingService.createPortalSession(subscription.stripeCustomerId);

        res.json({
            success: true,
            url: session.url
        });
    } catch (error) {
        console.error('Portal error:', error);
        const message = error instanceof Error ? error.message : 'Unknown error';
        res.status(500).json({ success: false, message });
    }
});

export default BillingService;
