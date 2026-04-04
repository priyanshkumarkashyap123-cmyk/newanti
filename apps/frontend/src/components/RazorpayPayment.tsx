import React, { useCallback, useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { Loader2, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from './ui/button';
import { logger } from '../utils/logger';
import { API_CONFIG } from '../config/env';

// --- External Script Loader ---
function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

import { type PaidPlanId, type BillingCycle, PRICING_INR, formatINR } from '../config/pricing';

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

export const RazorpayPaymentModal: React.FC<RazorpayPaymentModalProps> = ({
  userId,
  email,
  userName,
  planId = "pro",
  billingCycle = "monthly",
  onSuccess,
  onError: onPropError,
  onClose,
  allowPlanToggle = true,
}) => {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "processing" | "success">("idle");
  const [isOpen, setIsOpen] = useState(true);

  const planName = planId === "pro" ? "Pro" : "Business";
  const planAmountInr = PRICING_INR[planId][billingCycle];
  const priceDisplay = formatINR(planAmountInr);

  const getAuthToken = useCallback(async (): Promise<string | null> => {
    try {
      const token = await getToken();
      if (token) return token;
      // Retry once with a cache-bypass hint for fresh session tokens.
      return await getToken({ skipCache: true } as any) || null;
    } catch {
      return null;
    }
  }, [getToken]);

  // Prevent background scrolling
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
      if (status !== 'success') {
        setStatus('idle');
        setError(null);
      }
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, status]);

  const handleDisplayRazorpay = useCallback(async () => {
    if (!isLoaded || !isSignedIn) {
      setError('You must be signed in to purchase.');
      return;
    }

    setLoading(true);
    setError(null);

    const res = await loadScript('https://checkout.razorpay.com/v1/checkout.js');
    if (!res) {
      setError('Failed to load Razorpay SDK. Are you online?');
      setLoading(false);
      return;
    }

    try {
      const token = await getAuthToken();
      if (!token) throw new Error('Authentication failed');

      // 1. Create order on backend (need to build this route!)
      const backendUrl = API_CONFIG.baseUrl;
      const orderResponse = await fetch(`${backendUrl}/api/payments/razorpay/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tier: planId, billingCycle })
      });

      if (!orderResponse.ok) {
        let serverMessage = '';
        try {
          const payload = await orderResponse.json();
          serverMessage = String(payload?.message || '').trim();
        } catch {
          // ignore parse errors and fallback to status-based message
        }

        if (orderResponse.status === 401) {
          throw new Error(serverMessage || 'Your session is not authorized for payments. Please sign out and sign in again.');
        }

        if (orderResponse.status === 403) {
          throw new Error(serverMessage || 'Payment request was blocked by server policy. Please refresh and try again.');
        }

        if (orderResponse.status === 503) {
          throw new Error(serverMessage || 'Payment server is currently unavailable. Please try again in a moment.');
        }

        throw new Error(serverMessage || 'Failed to create order on server');
      }

      const orderData = await orderResponse.json();
      const checkoutKey = String(orderData.keyId || '').trim();
      const checkoutOrderId = String(orderData.orderId || '').trim();

      if (!checkoutKey) {
        throw new Error('Razorpay checkout key is missing from server response');
      }

      if (!checkoutOrderId) {
        throw new Error('Razorpay order id is missing from server response');
      }

      const isTestKey = /^rzp_(test)_/i.test(checkoutKey);
      if (import.meta.env.PROD && isTestKey) {
        throw new Error('Live payment gateway is not configured on server (test Razorpay key detected)');
      }
      
      const options = {
        key: checkoutKey,
        amount: orderData.amount,
        currency: orderData.currency,
        name: "BeamLab",
        description: `Upgrade to ${planName} (${billingCycle})`,
        order_id: checkoutOrderId,
        handler: async function (response: any) {
          try {
            // Verify signature on backend
            setStatus("processing");
            const verifyToken = await getAuthToken();
            if (!verifyToken) {
              throw new Error('Authentication failed while verifying payment. Please sign in again.');
            }
            const verifyRes = await fetch(`${backendUrl}/api/payments/razorpay/verify-payment`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${verifyToken}`
              },
              body: JSON.stringify({
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                tier: planId,
                billingCycle
              })
            });

            if (verifyRes.ok) {
              setStatus("success");
              setTimeout(() => {
                onSuccess?.();
                onClose?.();
              }, 2000);
            } else {
              let verifyMessage = 'Payment verification failed';
              try {
                const payload = await verifyRes.json();
                verifyMessage = String(payload?.message || payload?.error || '').trim() || verifyMessage;
              } catch {
                // ignore parsing errors
              }
              throw new Error(verifyMessage);
            }
          } catch (err: any) {
            logger.error("Payment verification fell through:", err);
            setError(err?.message || "Payment processed, but verification failed. Please contact support.");
            setStatus("idle");
          }
        },
        prefill: {
          name: userName || "BeamLab User",
          email: email || ""
          // We can't guarantee we have these from Clerk upfront in the browser safely, 
          // but we can leave them blank or fetch context.
        },
        theme: {
          color: "#3b82f6" // blue-500
        },
        modal: {
          ondismiss: function() {
            setLoading(false);
          }
        }
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.on('payment.failed', function (response: any) {
        logger.error("Razorpay Payment Failed:", response.error);
        setError(`Payment failed: ${response.error.description}`);
      });
      paymentObject.open();

    } catch (err: any) {
      logger.error('Razorpay Error:', err);
      setError(err.message || 'Payment failed to initiate');
      setLoading(false);
    }
  }, [billingCycle, email, getAuthToken, isLoaded, isSignedIn, onClose, onSuccess, planId, planName, userName]);

  if (!isOpen) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-[#0b1326] rounded-2xl shadow-2xl overflow-hidden border border-[#1a2333]"
      >
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-6">
            <ShieldCheck className="w-6 h-6" />
          </div>

          <h3 className="text-xl font-bold text-[#dae2fd] mb-2">
            Complete your upgrade
          </h3>

          <div className="bg-[#131b2e] rounded-xl p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-[#869ab8]">Plan</span>
              <span className="font-semibold text-[#dae2fd]">{planName}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-[#869ab8]">Billing</span>
              <span className="font-semibold text-[#dae2fd] capitalize">{billingCycle}</span>
            </div>
            <div className="h-px bg-slate-200 dark:bg-slate-700 my-3" />
            <div className="flex justify-between items-center">
              <span className="font-medium tracking-wide text-[#adc6ff]">Total</span>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                {priceDisplay}
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-[#1a2333] rounded-xl flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">
                {error}
              </div>
            </div>
          )}

          {status === "success" ? (
            <div className="flex flex-col items-center justify-center py-6">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
              <p className="text-emerald-700 dark:text-emerald-400 font-medium tracking-wide">Payment Successful!</p>
            </div>
          ) : (
             <div className="flex flex-col sm:flex-row gap-3">
                <Button
                    variant="outline"
                    className="flex-1"
                    onClick={onClose}
                    disabled={loading || status === 'processing'}
                >
                    Cancel
                </Button>
                <Button
                    className="flex-1 bg-gradient-to-r from-[#4d8eff] to-[#3b72cc] hover:from-[#3b72cc] hover:to-[#2a5599] text-white shadow-[0_0_15px_rgba(77,142,255,0.3)] hover:shadow-[0_0_20px_rgba(77,142,255,0.5)]"
                    onClick={() => {
                        handleDisplayRazorpay();
                    }}
                    disabled={loading || status === 'processing'}
                >
                    {loading || status === 'processing' ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        `Pay with Razorpay`
                    )}
                </Button>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
