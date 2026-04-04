/**
 * BillingService — Centralized Billing & Subscription Management
 *
 * Single source of truth for all billing operations on the frontend.
 * Uses the existing API client for consistent error handling, retries,
 * and authentication.
 *
 * @version 1.0.0
 */

import { API_CONFIG } from '../config/env';
import { createLogger } from '../utils/logger';
import { fetchJson, postJson, fetchWithTimeout } from '../utils/fetchUtils';

const log = createLogger('BillingService');
const API_URL = API_CONFIG.baseUrl;

// ============================================
// TYPES
// ============================================

export type PlanType = 'monthly' | 'yearly';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'inactive';

export interface BillingPlan {
  id: string;
  name: string;
  price: number;
  currency: string;
  displayPrice: string;
  interval: 'month' | 'year';
  savings?: string;
  features: string[];
}

export interface BillingStatus {
  tier: 'free' | 'pro' | 'enterprise';
  active: boolean;
  expiresAt?: string;
  planType?: PlanType;
  daysRemaining?: number | null;
  cancelAtPeriodEnd?: boolean;
}

export interface OrderResponse {
  merchantTransactionId: string;
  redirectUrl: string;
  amount?: number;
  currency?: string;
}

export interface VerifyPaymentParams {
  merchantTransactionId: string;
  planType: PlanType;
}

// ============================================
// BILLING SERVICE
// ============================================

class BillingServiceClient {
  private token: string | null = null;

  /**
   * Set the auth token for API calls.
   * Should be called whenever the user's token refreshes.
   */
  setToken(token: string | null) {
    this.token = token;
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
    }
    return headers;
  }

  /**
   * Get available pricing plans from the backend.
   * Falls back to hardcoded plans if the endpoint isn't available.
   */
  async getPlans(): Promise<BillingPlan[]> {
    try {
      const result = await fetchJson<{ plans: BillingPlan[] }>(`${API_URL}/api/billing/plans`, {
        authToken: this.token ?? undefined,
      });
      if (result?.plans) {
        return result.plans;
      }
    } catch (err) {
      log.warn('Failed to fetch plans from API, using defaults', err);
    }

    // Fallback — hardcoded plans
    return [
      {
        id: 'pro_monthly',
        name: 'Pro Monthly',
        price: 99900,
        currency: 'INR',
        displayPrice: '₹999/month',
        interval: 'month',
        features: [
          'Unlimited projects',
          'Advanced analysis',
          'All design codes',
          'PDF reports',
          'AI design assistant',
          'Priority support',
        ],
      },
      {
        id: 'pro_yearly',
        name: 'Pro Annual',
        price: 999900,
        currency: 'INR',
        displayPrice: '₹9,999/year',
        interval: 'year',
        savings: 'Save 17%',
        features: [
          'Everything in Pro Monthly',
          '2 months free',
          'Locked-in pricing',
        ],
      },
    ];
  }

  /**
   * Get current subscription status for the authenticated user.
   */
  async getStatus(): Promise<BillingStatus> {
    const result = await fetchJson<BillingStatus>(`${API_URL}/api/billing/status`, {
      authToken: this.token ?? undefined,
    });
    if (!result) {
      throw new Error('Failed to fetch billing status');
    }
    return result;
  }

  /**
   * Create a PhonePe payment order.
   * Returns merchantTransactionId + redirectUrl for PhonePe checkout.
   * Supports idempotency via X-Idempotency-Key header.
   */
  async createOrder(
    email: string,
    planType: PlanType,
    idempotencyKey?: string,
  ): Promise<OrderResponse> {
    const extraHeaders: Record<string, string> = {};
    if (idempotencyKey) {
      extraHeaders['X-Idempotency-Key'] = idempotencyKey;
    }

    const result = await postJson<OrderResponse>(
      `${API_URL}/api/billing/create-order`,
      { email, planType },
      {
        authToken: this.token ?? undefined,
        withCsrf: true,
        headers: extraHeaders,
      }
    );

    if (!result) {
      throw new Error('Failed to create payment order');
    }
    return result;
  }

  /**
   * Verify a completed PhonePe payment and activate the subscription.
   */
  async verifyPayment(params: VerifyPaymentParams): Promise<{ success: boolean; message: string }> {
    const result = await postJson<{ success: boolean; message: string }>(
      `${API_URL}/api/billing/verify-payment`,
      params,
      {
        authToken: this.token ?? undefined,
        withCsrf: true,
      }
    );

    if (!result) {
      throw new Error('Payment verification failed');
    }
    return result;
  }

  /**
   * Check if the user's subscription is active and not expired.
   */
  async isSubscriptionActive(): Promise<boolean> {
    try {
      const status = await this.getStatus();
      return status.active && status.tier !== 'free';
    } catch {
      return false;
    }
  }

  /**
   * Get human-readable subscription summary.
   */
  async getSubscriptionSummary(): Promise<string> {
    try {
      const status = await this.getStatus();
      if (!status.active || status.tier === 'free') {
        return 'Free plan — upgrade to unlock all features';
      }
      const planLabel = status.planType === 'yearly' ? 'Annual' : 'Monthly';
      const daysLeft = status.daysRemaining ?? 0;
      return `Pro ${planLabel} — ${daysLeft} days remaining`;
    } catch {
      return 'Unable to retrieve subscription info';
    }
  }
}

// Singleton instance
export const billingService = new BillingServiceClient();
export default billingService;
