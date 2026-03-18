import React, { useCallback, useState, useEffect } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { motion } from 'framer-motion';
import { Loader2, ShieldCheck, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from './ui/button';
import { PAYMENT_CONFIG } from '../config/env';
import { logger } from '../utils/logger';

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

import { type PaidPlanId, type BillingCycle } from '../config/pricing';

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

  const planName = planId === "pro" ? "Pro" : "Enterprise";
  const priceDisplay = planId === "pro" ? (billingCycle === "monthly" ? "₹8,000" : "₹86,400") : "Custom";

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
      const token = await getToken();
      if (!token) throw new Error('Authentication failed');

      // 1. Create order on backend (need to build this route!)
      const backendUrl = import.meta.env.VITE_API_URL || "https://beamlab-backend-node.azurewebsites.net";
      const orderResponse = await fetch(`${backendUrl}/api/payments/razorpay/create-order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ tier: planId, billingCycle })
      });

      if (!orderResponse.ok) {
        throw new Error('Failed to create order on server');
      }

      const orderData = await orderResponse.json();
      
      const options = {
        key: orderData.keyId || PAYMENT_CONFIG.razorpayKeyId, 
        amount: orderData.amount,
        currency: orderData.currency,
        name: "BeamLab",
        description: `Upgrade to ${planName} (${billingCycle})`,
        order_id: orderData.orderId,
        handler: async function (response: any) {
          try {
            // Verify signature on backend
            setStatus("processing");
            const verifyToken = await getToken();
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
                onClose();
              }, 2000);
            } else {
              throw new Error("Payment verification failed");
            }
          } catch (err: any) {
            logger.error("Payment verification fell through:", err);
            setError("Payment processed, but verification failed. Please contact support.");
            setStatus("idle");
          }
        },
        prefill: {
          name: "BeamLab User",
          email: "user@beamlab.tech"
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
  }, [billingCycle, getToken, isLoaded, isSignedIn, planName, tier, onClose, onSuccess]);

  if (!isOpen) return null;

  return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800"
      >
        <div className="p-6 md:p-8">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 mb-6">
            <ShieldCheck className="w-6 h-6" />
          </div>

          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Complete your upgrade
          </h3>

          <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Plan</span>
              <span className="font-semibold text-slate-900 dark:text-white">{planName}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm text-slate-500 dark:text-slate-400">Billing</span>
              <span className="font-semibold text-slate-900 dark:text-white capitalize">{billingCycle}</span>
            </div>
            <div className="h-px bg-slate-200 dark:bg-slate-700 my-3" />
            <div className="flex justify-between items-center">
              <span className="font-medium text-slate-700 dark:text-slate-300">Total</span>
              <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400">
                {priceDisplay}
              </span>
            </div>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
              <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div className="flex-1 text-sm text-red-700 dark:text-red-300 whitespace-pre-wrap break-words">
                {error}
              </div>
            </div>
          )}

          {status === "success" ? (
            <div className="flex flex-col items-center justify-center py-6">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
              <p className="text-emerald-700 dark:text-emerald-400 font-medium">Payment Successful!</p>
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
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
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
