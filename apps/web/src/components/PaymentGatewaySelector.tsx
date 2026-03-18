import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, CreditCard, Smartphone } from 'lucide-react';
import { PhonePePaymentModal } from './PhonePePayment';
import { RazorpayPaymentModal } from './RazorpayPayment';
import { Button } from './ui/button';
import { type PaidPlanId, type BillingCycle } from '../config/pricing';
import { PAYMENT_CONFIG } from '../config/env';

export interface PaymentGatewaySelectorProps {
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

export const PaymentGatewaySelector: React.FC<PaymentGatewaySelectorProps> = (props) => {
  const [selectedGateway, setSelectedGateway] = useState<"none" | "phonepe" | "razorpay">("none");
  const activeGateway = PAYMENT_CONFIG.activeGateway;
  const allowPhonePe = activeGateway === 'both' || activeGateway === 'phonepe';
  const allowRazorpay = activeGateway === 'both' || activeGateway === 'razorpay';

  const planName = props.planId === "pro" ? "Pro" : (props.planId === "business" ? "Business" : "Custom");

  if (selectedGateway === "none" && allowRazorpay && !allowPhonePe) {
    return (
      <RazorpayPaymentModal
        {...props}
        onClose={props.onClose}
      />
    );
  }

  if (selectedGateway === "none" && allowPhonePe && !allowRazorpay) {
    return (
      <PhonePePaymentModal
        {...props}
        onClose={props.onClose}
      />
    );
  }

  if (selectedGateway === "phonepe" && allowPhonePe) {
    return (
      <PhonePePaymentModal
        {...props}
        onClose={() => {
           setSelectedGateway("none");
           props.onClose?.();
        }}
      />
    );
  }

  if (selectedGateway === "razorpay" && allowRazorpay) {
    return (
      <RazorpayPaymentModal
        {...props}
        onClose={() => {
           setSelectedGateway("none");
           props.onClose?.();
        }}
      />
    );
  }

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

          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2 text-center">
            Select Payment Gateway
          </h3>
          <p className="text-sm text-slate-500 text-center mb-6">
            Choose your preferred method to complete the upgrade to {planName}.
          </p>

          <div className="flex flex-col gap-4">
            {allowRazorpay && (
              <button
                onClick={() => setSelectedGateway("razorpay")}
                className="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all text-left group"
              >
                <div className="p-3 bg-blue-100 dark:bg-blue-900/40 rounded-lg text-blue-600 dark:text-blue-400">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    Razorpay <span className="text-[10px] uppercase font-bold tracking-wider bg-green-100 text-green-700 px-2 py-0.5 rounded">Live</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Cards, UPI, NetBanking</div>
                </div>
              </button>
            )}

            {allowPhonePe && (
              <button
                onClick={() => setSelectedGateway("phonepe")}
                className="flex items-center gap-4 p-4 border border-slate-200 dark:border-slate-700 rounded-xl hover:border-purple-500 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all text-left group"
              >
                <div className="p-3 bg-purple-100 dark:bg-purple-900/40 rounded-lg text-purple-600 dark:text-purple-400">
                  <Smartphone className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                    PhonePe <span className="text-[10px] uppercase font-bold tracking-wider bg-amber-100 text-amber-700 px-2 py-0.5 rounded">UAT / Test</span>
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Sandbox Testing Environment</div>
                </div>
              </button>
            )}

            {!allowPhonePe && !allowRazorpay && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
               No payment gateway is enabled. Set <code>VITE_PAYMENT_GATEWAY</code> to <code>razorpay</code>, <code>phonepe</code>, or <code>both</code>.
              </div>
            )}
          </div>

          <div className="mt-6">
            <Button
              variant="ghost"
              className="w-full text-slate-500"
              onClick={props.onClose}
            >
              Cancel
            </Button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
