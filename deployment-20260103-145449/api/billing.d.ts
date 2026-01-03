/**
 * BillingService - Stripe Payment Integration
 * Checkout session creation and webhook handling
 */
import Stripe from 'stripe';
export declare class BillingService {
    /**
     * Create a Stripe checkout session
     */
    static createCheckoutSession(userId: string, email: string, priceId: string, successUrl?: string, cancelUrl?: string): Promise<Stripe.Checkout.Session>;
    /**
     * Handle Stripe webhook events
     */
    static handleWebhook(payload: Buffer, signature: string): Promise<{
        received: boolean;
        event?: string;
    }>;
    /**
     * Handle checkout session completion
     */
    private static handleCheckoutComplete;
    /**
     * Handle successful payment - UPDATE TIER TO PRO
     */
    private static handlePaymentSuccess;
    /**
     * Handle failed payment
     */
    private static handlePaymentFailed;
    /**
     * Handle subscription update
     */
    private static handleSubscriptionUpdate;
    /**
     * Handle subscription cancellation
     */
    private static handleSubscriptionCanceled;
    /**
     * Get customer portal URL
     */
    static createPortalSession(customerId: string): Promise<Stripe.BillingPortal.Session>;
}
export declare const billingRouter: import("express-serve-static-core").Router;
export default BillingService;
//# sourceMappingURL=billing.d.ts.map