/**
 * Razorpay Billing Service
 * Subscription creation and webhook handling for Indian SaaS
 */
export declare class RazorpayBillingService {
    /**
     * Create a Razorpay subscription
     */
    static createSubscription(userId: string, email: string, planId?: string, planType?: 'monthly' | 'yearly'): Promise<{
        subscriptionId: string;
        shortUrl?: string;
    }>;
    /**
     * Verify Razorpay payment signature
     */
    static verifyPaymentSignature(paymentId: string, subscriptionId: string, signature: string): boolean;
    /**
     * Verify webhook signature (HMAC-SHA256)
     */
    static verifyWebhookSignature(body: string, signature: string): boolean;
    /**
     * Handle webhook events
     */
    static handleWebhook(event: string, payload: RazorpayWebhookPayload): Promise<{
        success: boolean;
        message: string;
    }>;
    /**
     * Handle subscription.charged - UPDATE USER TO PRO
     */
    private static handleSubscriptionCharged;
    /**
     * Handle subscription activated
     */
    private static handleSubscriptionActivated;
    /**
     * Handle subscription completed
     */
    private static handleSubscriptionCompleted;
    /**
     * Handle subscription cancelled
     */
    private static handleSubscriptionCancelled;
    /**
     * Handle payment failed
     */
    private static handlePaymentFailed;
}
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
export declare const razorpayRouter: import("express-serve-static-core").Router;
export default RazorpayBillingService;
//# sourceMappingURL=razorpay.d.ts.map