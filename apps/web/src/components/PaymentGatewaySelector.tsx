/**
 * PaymentGatewaySelector — Choose between Razorpay and PhonePe
 *
 * Shows a modal letting the user pick their preferred payment gateway:
 *   - Razorpay  — inline popup, supports cards/UPI/wallets/netbanking
 *   - PhonePe   — redirect-based checkout (UPI-first)
 *
 * Once selected, renders the appropriate payment modal.
 * Active gateway is determined by env config (VITE_PAYMENT_GATEWAY).
 * If only one gateway is configured, it opens directly without a selector.
 */

import { FC, useState, useCallback } from "react";
import { PAYMENT_CONFIG } from "../config/env";
import { PhonePePaymentModal } from "./PhonePePayment";
// RazorpayPaymentModal is aliased to PhonePePaymentModal for backward compat
const RazorpayPaymentModal = PhonePePaymentModal;
import type { BillingCycle, PaidPlanId } from "../config/pricing";

// ============================================
// TYPES
// ============================================

type Gateway = "razorpay" | "phonepe";

interface PaymentGatewaySelectorProps {
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
// GATEWAY DEFINITIONS
// ============================================

const GATEWAYS: {
  id: Gateway;
  name: string;
  tagline: string;
  methods: string[];
  color: string;
  bgColor: string;
  borderColor: string;
  logo: FC<{ className?: string }>;
}[] = [
  {
    id: "razorpay",
    name: "Razorpay",
    tagline: "Cards, UPI, NetBanking, Wallets",
    methods: ["Visa", "Mastercard", "UPI", "Paytm", "PhonePe UPI", "NetBanking"],
    color: "#3395FF",
    bgColor: "rgba(51, 149, 255, 0.08)",
    borderColor: "rgba(51, 149, 255, 0.25)",
    logo: ({ className }) => (
      <svg
        className={className}
        viewBox="0 0 120 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Razorpay"
      >
        <path
          d="M8.5 4H16.5L10 14H18L6 26H14L20 16H12L18.5 6H10.5L8.5 4Z"
          fill="#3395FF"
        />
        <text x="28" y="21" fontFamily="Arial, sans-serif" fontSize="15" fontWeight="700" fill="#3395FF">
          razorpay
        </text>
      </svg>
    ),
  },
  {
    id: "phonepe",
    name: "PhonePe",
    tagline: "UPI & PhonePe Wallet",
    methods: ["PhonePe UPI", "BHIM UPI", "Bank UPI"],
    color: "#5f259f",
    bgColor: "rgba(95, 37, 159, 0.08)",
    borderColor: "rgba(95, 37, 159, 0.25)",
    logo: ({ className }) => (
      <svg
        className={className}
        viewBox="0 0 120 30"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="PhonePe"
      >
        <circle cx="12" cy="15" r="11" fill="#5f259f" />
        <path d="M8 10h5a3 3 0 0 1 0 6H10v4H8V10zm2 2v2h3a1 1 0 0 0 0-2h-3z" fill="white" />
        <text x="28" y="21" fontFamily="Arial, sans-serif" fontSize="15" fontWeight="700" fill="#5f259f">
          PhonePe
        </text>
      </svg>
    ),
  },
];

// ============================================
// GATEWAY SELECTOR COMPONENT
// ============================================

export const PaymentGatewaySelector: FC<PaymentGatewaySelectorProps> = ({
  userId,
  email,
  userName,
  planId = "pro",
  billingCycle = "monthly",
  onSuccess,
  onError,
  onClose,
  allowPlanToggle = true,
}) => {
  const activeGateway = PAYMENT_CONFIG.activeGateway;
  const razorpayConfigured = !!PAYMENT_CONFIG.razorpayKeyId;
  const phonePeConfigured = !!PAYMENT_CONFIG.phonePeMerchantId;

  // Determine which gateways to show
  const availableGateways = GATEWAYS.filter((g) => {
    if (activeGateway === "razorpay") return g.id === "razorpay";
    if (activeGateway === "phonepe") return g.id === "phonepe";
    // "both" — show all gateways (even if not fully configured, allow selection)
    return true;
  });

  // If only one gateway available, skip selector and go directly
  const skipSelector = availableGateways.length === 1;
  const [selected, setSelected] = useState<Gateway | null>(
    skipSelector ? availableGateways[0].id : null,
  );

  const handleSelect = useCallback((gateway: Gateway) => {
    setSelected(gateway);
  }, []);

  const handleBack = useCallback(() => {
    setSelected(null);
  }, []);

  // — Direct modal for selected gateway —
  if (selected === "razorpay") {
    return (
      <RazorpayPaymentModal
        userId={userId}
        email={email}
        userName={userName}
        planId={planId}
        billingCycle={billingCycle}
        onSuccess={onSuccess}
        onError={onError}
        onClose={skipSelector ? onClose : handleBack}
        allowPlanToggle={allowPlanToggle}
      />
    );
  }

  if (selected === "phonepe") {
    return (
      <PhonePePaymentModal
        userId={userId}
        email={email}
        userName={userName}
        planId={planId}
        billingCycle={billingCycle}
        onSuccess={onSuccess}
        onError={onError}
        onClose={skipSelector ? onClose : handleBack}
        allowPlanToggle={allowPlanToggle}
      />
    );
  }

  // — Gateway selection screen —
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="gateway-selector-title"
      className="fixed inset-0 z-[9995] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="relative w-[95%] max-w-[460px] rounded-2xl bg-[#12121e] border border-white/10 shadow-2xl shadow-blue-500/10 animate-in slide-in-from-bottom-4 duration-300">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-white/40 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
        </button>

        {/* Header */}
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 mb-4 shadow-lg shadow-blue-500/25">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><path d="M2 10h20"/></svg>
          </div>
          <h2 id="gateway-selector-title" className="text-2xl font-bold text-white tracking-tight">
            Choose Payment Method
          </h2>
          <p className="text-sm text-white/50 mt-1">Select your preferred payment gateway</p>
        </div>

        {/* Gateway Cards */}
        <div className="px-6 pb-4 space-y-3">
          {availableGateways.map((gw) => {
            const Logo = gw.logo;
            const isConfigured = gw.id === "razorpay" ? razorpayConfigured : phonePeConfigured;
            return (
              <button
                key={gw.id}
                type="button"
                onClick={() => handleSelect(gw.id)}
                className="w-full text-left rounded-xl border p-4 transition-all duration-200 hover:scale-[1.01] active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-blue-400/50"
                style={{
                  background: gw.bgColor,
                  borderColor: gw.borderColor,
                }}
                aria-label={`Pay with ${gw.name}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Logo className="h-7 w-28" />
                  </div>
                  <div className="flex items-center gap-2">
                    {!isConfigured && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 font-medium">
                        Config required
                      </span>
                    )}
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/30"><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                </div>

                <p className="mt-2 text-xs text-white/50">{gw.tagline}</p>

                {/* Payment method pills */}
                <div className="mt-2 flex flex-wrap gap-1">
                  {gw.methods.slice(0, 4).map((m) => (
                    <span
                      key={m}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/8"
                    >
                      {m}
                    </span>
                  ))}
                  {gw.methods.length > 4 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/8">
                      +{gw.methods.length - 4} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-8 pb-6 pt-2">
          <div className="flex items-center justify-center gap-1.5 text-[11px] text-white/25">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            <span>256-bit SSL · PCI DSS Compliant · Secure Checkout</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PaymentGatewaySelector;
