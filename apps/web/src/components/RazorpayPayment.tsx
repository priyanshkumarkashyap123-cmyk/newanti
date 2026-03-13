/**
 * RazorpayPayment — Inline Checkout Component
 *
 * Features:
 *   - Razorpay Standard Checkout (popup-based — no redirect needed)
 *   - Dynamically loads Razorpay JS SDK from cdn
 *   - HMAC-SHA256 signature verification on backend before activation
 *   - Idempotent order creation with deduplication guard
 *   - Monthly / yearly plan toggle with savings badge
 *   - Payment state machine: idle → creating → checkout → verifying → success/error
 *   - Accessibility (ARIA, focus trap, keyboard navigation)
 *
 * Flow:
 *   1. Frontend calls backend to create Razorpay order → gets orderId + keyId
 *   2. Razorpay popup opens (user enters card/UPI/wallet/netbanking)
 *   3. On success, Razorpay returns razorpayPaymentId + razorpaySignature
 *   4. Frontend sends these to backend for HMAC-SHA256 verification
 *   5. Backend activates Pro subscription
 */

import { FC, useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useSubscription } from "../hooks/useSubscription";
import { API_CONFIG, PAYMENT_CONFIG } from "../config/env";
import {
  CHECKOUT_FEATURES,
  FEATURE_BUNDLES,
  PRICING_INR,
  formatINR,
  getCheckoutPlanId,
  type BillingCycle,
  type PaidPlanId,
} from "../config/pricing";

// ============================================
// RAZORPAY GLOBAL TYPE
// ============================================

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => RazorpayInstance;
  }
}

interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  order_id: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

interface RazorpayInstance {
  open(): void;
  close(): void;
}

// ============================================
// TYPES
// ============================================

type PlanType = BillingCycle;

type PaymentState =
  | "idle"
  | "creating"
  | "checkout"
  | "verifying"
  | "success"
  | "error";

interface CreateOrderResponse {
  success: boolean;
  data?: {
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
    bypassed?: boolean;
  };
  message?: string;
}

interface VerifyPaymentResponse {
  success: boolean;
  message?: string;
  data?: {
    tier: string;
    planType: string;
    transactionId: string;
  };
}

export interface RazorpayPaymentModalProps {
  userId: string;
  email: string;
  userName?: string;
  planId?: PaidPlanId;
  billingCycle?: BillingCycle;
  onSuccess?: () => void;
  onError?: (error: string) => void;
  onClose?: () => void;
  allowPlanToggle?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const MAX_RETRIES = 3;
const RETRY_BASE_DELAY_MS = 1000;
const API_URL = API_CONFIG.baseUrl;

function getPlanDetails(planId: PaidPlanId, billingCycle: BillingCycle) {
  const amountInr = PRICING_INR[planId][billingCycle];
  return {
    label: billingCycle === "yearly" ? "Annual" : "Monthly",
    price: formatINR(amountInr),
    period: billingCycle === "yearly" ? "/year" : "/month",
    description: `BeamLab ${planId === "business" ? "Business" : "Pro"} — ${billingCycle === "yearly" ? "Annual" : "Monthly"}`,
  };
}

const STATE_LABELS: Record<PaymentState, string> = {
  idle: "Pay with Razorpay",
  creating: "Creating Order…",
  checkout: "Opening Checkout…",
  verifying: "Verifying Payment…",
  success: "Payment Successful!",
  error: "Retry Payment",
};

// ============================================
// HELPERS
// ============================================

function generateIdempotencyKey(userId: string, planType: PlanType): string {
  return `rzp_${userId}_${planType}_${Math.floor(Date.now() / 60_000)}`;
}

async function fetchWithRetry<T>(
  url: string,
  options: RequestInit,
  retries = MAX_RETRIES,
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, {
        ...options,
        signal: options.signal ?? AbortSignal.timeout(30_000),
      });
      if (response.ok) {
        return response.json() as Promise<T>;
      }
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          (errorData as { message?: string }).message ||
            `Request failed with status ${response.status}`,
        );
      }
      lastError = new Error(`Server error: ${response.status}`);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") throw err;
      lastError = err instanceof Error ? err : new Error("Network error");
    }
    if (attempt < retries) {
      const delay = RETRY_BASE_DELAY_MS * Math.pow(2, attempt) + Math.random() * 500;
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastError ?? new Error("Request failed after retries");
}

/** Load Razorpay checkout.js from CDN (idempotent — safe to call multiple times) */
function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Razorpay) {
      resolve();
      return;
    }
    const existing = document.getElementById("razorpay-checkout-js");
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Razorpay SDK")));
      return;
    }
    const script = document.createElement("script");
    script.id = "razorpay-checkout-js";
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Razorpay SDK"));
    document.head.appendChild(script);
  });
}

async function createRazorpayOrder(
  userId: string,
  token: string,
  planType: PlanType,
  planId: PaidPlanId,
): Promise<CreateOrderResponse> {
  const idempotencyKey = generateIdempotencyKey(userId, planType);
  const checkoutPlanId = getCheckoutPlanId(planId, planType);
  return fetchWithRetry<CreateOrderResponse>(
    `${API_URL}/api/billing/razorpay/create-order`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        "X-Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ planType, planId, checkoutPlanId }),
    },
  );
}

async function verifyRazorpayPayment(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  razorpaySignature: string,
  planType: PlanType,
  planId: PaidPlanId,
  token: string,
): Promise<VerifyPaymentResponse> {
  const checkoutPlanId = getCheckoutPlanId(planId, planType);
  return fetchWithRetry<VerifyPaymentResponse>(
    `${API_URL}/api/billing/razorpay/verify-payment`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        planType,
        planId,
        checkoutPlanId,
      }),
    },
  );
}

// ============================================
// RAZORPAY PAYMENT MODAL COMPONENT
// ============================================

export const RazorpayPaymentModal: FC<RazorpayPaymentModalProps> = ({
  userId,
  email,
  userName,
  planId = "pro",
  billingCycle: initialPlanType = "monthly",
  onSuccess,
  onError,
  onClose,
  allowPlanToggle = true,
}) => {
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>(initialPlanType);
  const abortRef = useRef<AbortController | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const rzpRef = useRef<RazorpayInstance | null>(null);

  const { getToken } = useAuth();
  const { refreshSubscription } = useSubscription();
  const billingBypass = PAYMENT_CONFIG.billingBypass;

  const isProcessing =
    paymentState !== "idle" && paymentState !== "error" && paymentState !== "success";
  const plan = getPlanDetails(planId, selectedPlan);
  const checkoutFeatures =
    planId === "business"
      ? FEATURE_BUNDLES.business
      : CHECKOUT_FEATURES;

  // Focus trap on mount
  useEffect(() => {
    if (modalRef.current) modalRef.current.focus();
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      clearTimeout(successTimerRef.current);
      rzpRef.current?.close();
    };
  }, []);

  // Keyboard escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isProcessing) onClose?.();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isProcessing, onClose]);

  const handlePayment = useCallback(async () => {
    if (isProcessing) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setPaymentState("creating");
    setError(null);

    try {
      // Billing bypass — skip actual payment
      if (billingBypass) {
        await refreshSubscription();
        setPaymentState("success");
        successTimerRef.current = setTimeout(() => onSuccess?.(), 1500);
        return;
      }

      const token = await getToken();
      if (!token) throw new Error("Please sign in to continue");

      // 1. Create Razorpay order on backend
      const orderResponse = await createRazorpayOrder(userId, token, selectedPlan, planId);

      if (!orderResponse.success || !orderResponse.data) {
        throw new Error(orderResponse.message || "Failed to create payment order");
      }

      // Bypass path: backend says no payment needed
      if (orderResponse.data.bypassed) {
        await refreshSubscription();
        setPaymentState("success");
        successTimerRef.current = setTimeout(() => onSuccess?.(), 1500);
        return;
      }

      const { orderId, amount, currency, keyId } = orderResponse.data;

      // 2. Load Razorpay SDK
      setPaymentState("checkout");
      await loadRazorpayScript();

      if (!window.Razorpay) {
        throw new Error("Payment SDK failed to load. Please check your connection.");
      }

      // 3. Open Razorpay popup
      await new Promise<void>((resolve, reject) => {
        const options: RazorpayOptions = {
          key: keyId,
          amount,
          currency,
          name: "BeamLab",
          description: plan.description,
          order_id: orderId,
          prefill: { name: userName, email },
          theme: { color: "#3b82f6" },
          handler: async (response: RazorpaySuccessResponse) => {
            // 4. Verify payment on backend
            setPaymentState("verifying");
            try {
              const verifyResp = await verifyRazorpayPayment(
                response.razorpay_order_id,
                response.razorpay_payment_id,
                response.razorpay_signature,
                selectedPlan,
                planId,
                token,
              );
              if (verifyResp.success) {
                await refreshSubscription();
                setPaymentState("success");
                successTimerRef.current = setTimeout(() => onSuccess?.(), 1500);
                resolve();
              } else {
                reject(new Error(verifyResp.message || "Payment verification failed"));
              }
            } catch (verifyErr) {
              reject(verifyErr);
            }
          },
          modal: {
            ondismiss: () => {
              setPaymentState("idle");
              resolve();
            },
          },
        };

        const rzp = new window.Razorpay!(options);
        rzpRef.current = rzp;
        rzp.open();
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      const errMsg =
        err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(errMsg);
      setPaymentState("error");
      onError?.(errMsg);
    }
  }, [
    isProcessing,
    billingBypass,
    userId,
    email,
    userName,
    selectedPlan,
    planId,
    plan.description,
    onSuccess,
    onError,
    getToken,
    refreshSubscription,
  ]);

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget && !isProcessing) onClose?.();
    },
    [isProcessing, onClose],
  );

  const buttonLabel = useMemo(() => STATE_LABELS[paymentState], [paymentState]);

  return (
    <div
      ref={modalRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rzp-payment-title"
      tabIndex={-1}
      className="fixed inset-0 z-[9995] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div className="relative w-[95%] max-w-[440px] rounded-2xl bg-[#12121e] border border-white/10 shadow-2xl shadow-blue-500/10 animate-in slide-in-from-bottom-4 duration-300">
        {/* Close button */}
        {!isProcessing && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close payment modal"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        )}

        {/* Header */}
        <div className="px-8 pt-8 pb-2 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 mb-4 shadow-lg shadow-blue-500/25">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>
          </div>
          <h2 id="rzp-payment-title" className="text-2xl font-bold text-white tracking-tight">
            Upgrade to {planId === "business" ? "Business" : "Pro"}
          </h2>
          <p className="text-sm text-white/50 mt-1">Unlock the full power of BeamLab</p>

          {/* Razorpay badge */}
          <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full bg-[#072654]/50 border border-[#3395FF]/20">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="#3395FF"/>
              <path d="M2 17L12 22L22 17" stroke="#3395FF" strokeWidth="2" strokeLinecap="round"/>
              <path d="M2 12L12 17L22 12" stroke="#3395FF" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <span className="text-[11px] font-semibold text-[#3395FF]">Secured by Razorpay</span>
          </div>
        </div>

        {/* Plan Toggle */}
        {allowPlanToggle && (
          <div className="mx-8 mt-4">
            <div className="flex rounded-xl bg-white/5 p-1">
              {(["monthly", "yearly"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  disabled={isProcessing}
                  onClick={() => setSelectedPlan(p)}
                  className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    selectedPlan === p
                      ? "bg-blue-500 text-white shadow-md shadow-blue-500/30"
                      : "text-white/50 hover:text-white/80"
                  }`}
                  aria-pressed={selectedPlan === p}
                >
                  {p === "yearly" ? "Annual" : "Monthly"}
                  {p === "yearly" && (
                    <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/20 text-green-400">
                      -17%
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Price */}
        <div className="px-8 py-5 text-center">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-extrabold text-white tracking-tight">{plan.price}</span>
            <span className="text-base text-white/40 font-medium">{plan.period}</span>
          </div>
          {selectedPlan === "yearly" && (
            <p className="text-sm text-green-400 mt-1.5 font-medium">Save ₹2,989/year vs monthly</p>
          )}
        </div>

        {/* Features */}
        <div className="mx-8 mb-5">
          <ul className="space-y-2.5" role="list">
            {checkoutFeatures.map((feature) => (
              <li key={feature} className="flex items-center gap-3 text-sm text-white/80">
                <span className="text-base flex-shrink-0" aria-hidden="true">✅</span>
                <span>{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Error */}
        {error && (
          <div
            role="alert"
            className="mx-8 mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm"
          >
            <div className="flex items-start gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="flex-shrink-0 mt-0.5"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Success */}
        {paymentState === "success" && (
          <div
            role="status"
            className="mx-8 mb-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 text-sm"
          >
            <div className="flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
              <span className="font-medium">Welcome to BeamLab {planId === "business" ? "Business" : "Pro"}!</span>
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="px-8 pb-6">
          <button
            type="button"
            onClick={handlePayment}
            disabled={isProcessing || paymentState === "success"}
            aria-busy={isProcessing}
            className={`w-full py-3.5 px-6 rounded-xl text-base font-bold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:ring-offset-2 focus:ring-offset-[#12121e] ${
              paymentState === "success"
                ? "bg-green-500 text-white cursor-default"
                : isProcessing
                  ? "bg-blue-500/70 text-white/70 cursor-wait"
                  : "bg-gradient-to-r from-blue-500 to-blue-600 text-white hover:from-blue-600 hover:to-blue-700 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 active:scale-[0.98]"
            }`}
          >
            <span className="flex items-center justify-center gap-2">
              {isProcessing && (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
              )}
              {buttonLabel}
            </span>
          </button>

          <div className="flex items-center justify-center gap-1.5 mt-4 text-[11px] text-white/30">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>256-bit SSL · Cards, UPI, NetBanking, Wallets · PCI DSS Compliant</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================
// HOOK FOR PROGRAMMATIC TRIGGER
// ============================================

/**
 * useRazorpayPayment — Hook for triggering Razorpay popup programmatically.
 *
 * Razorpay uses an inline popup (no page redirect):
 *   1. Call backend → create order → get orderId
 *   2. Open Razorpay popup — user pays
 *   3. On success, verify signature with backend
 *   4. Backend activates subscription
 */
export function useRazorpayPayment() {
  const [loading, setLoading] = useState(false);
  const [paymentState, setPaymentState] = useState<PaymentState>("idle");
  const { getToken } = useAuth();
  const { refreshSubscription } = useSubscription();
  const billingBypass = PAYMENT_CONFIG.billingBypass;
  const abortRef = useRef<AbortController | null>(null);
  const rzpRef = useRef<RazorpayInstance | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      rzpRef.current?.close();
    };
  }, []);

  const openPayment = useCallback(
    async (
      userId: string,
      email: string,
      planType: PlanType = "monthly",
      userName?: string,
    ): Promise<boolean> => {
      if (billingBypass) {
        await refreshSubscription();
        setPaymentState("success");
        return true;
      }

      if (loading) return false;

      abortRef.current?.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      setPaymentState("creating");

      try {
        const token = await getToken();
        if (!token) throw new Error("Authentication required");

        const orderResponse = await createRazorpayOrder(userId, token, planType, "pro");

        if (!orderResponse.success || !orderResponse.data) {
          throw new Error(orderResponse.message || "Failed to create order");
        }

        if (orderResponse.data.bypassed) {
          await refreshSubscription();
          setPaymentState("success");
          setLoading(false);
          return true;
        }

        const { orderId, amount, currency, keyId } = orderResponse.data;

        setPaymentState("checkout");
        await loadRazorpayScript();

        if (!window.Razorpay) throw new Error("Payment SDK failed to load");

        return await new Promise<boolean>((resolve, reject) => {
          const options: RazorpayOptions = {
            key: keyId,
            amount,
            currency,
            name: "BeamLab",
            description: getPlanDetails("pro", planType).description,
            order_id: orderId,
            prefill: { name: userName, email },
            theme: { color: "#3b82f6" },
            handler: async (response) => {
              setPaymentState("verifying");
              try {
                const verifyResp = await verifyRazorpayPayment(
                  response.razorpay_order_id,
                  response.razorpay_payment_id,
                  response.razorpay_signature,
                  planType,
                  "pro",
                  token,
                );
                if (verifyResp.success) {
                  await refreshSubscription();
                  setPaymentState("success");
                  setLoading(false);
                  resolve(true);
                } else {
                  reject(new Error(verifyResp.message || "Verification failed"));
                }
              } catch (err) {
                reject(err);
              }
            },
            modal: {
              ondismiss: () => {
                setPaymentState("idle");
                setLoading(false);
                resolve(false);
              },
            },
          };
          const rzp = new window.Razorpay!(options);
          rzpRef.current = rzp;
          rzp.open();
        });
      } catch (err) {
        setPaymentState("error");
        setLoading(false);
        throw err;
      }
    },
    [billingBypass, getToken, loading, refreshSubscription],
  );

  return { openPayment, loading, paymentState };
}

export default RazorpayPaymentModal;
