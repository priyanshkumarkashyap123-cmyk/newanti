/**
 * RazorpayCustom.tsx
 *
 * Compile-safe adaptation of the vendor Razorpay snippet you pasted.
 *
 * Why this exists:
 * - Raw HTML <script> snippets cannot be pasted directly into TSX modules.
 * - This component keeps the same intent (button-triggered checkout) but uses
 *   the project's secure flow:
 *     1) backend creates order
 *     2) Razorpay popup opens
 *     3) backend verifies signature
 *
 * Secrets:
 * - Uses only public key via frontend env (`VITE_RAZORPAY_KEY_ID`)
 * - Private secret stays on API server (`RAZORPAY_KEY_SECRET`)
 */

import { FC, useCallback, useMemo, useState } from "react";
import { PAYMENT_CONFIG } from "../config/env";
import { useRazorpayPayment } from "./RazorpayPayment";

type PlanType = "monthly" | "yearly";

export interface RazorpayCustomProps {
  userId: string;
  email: string;
  userName?: string;
  planType?: PlanType;
  className?: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
}

/**
 * Vendor snippet #1 (callback_url based) preserved for reference only.
 */
export const VENDOR_SNIPPET_CALLBACK_URL = String.raw`<button id="rzp-button1">Pay</button>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
var options = {
    "key": "YOUR_KEY_ID",
    "amount": "50000",
    "currency": "<currency>",
    "name": "Acme Corp",
    "description": "Test Transaction",
    "image": "https://example.com/your_logo",
    "order_id": "order_9A33XWu170gUtm",
    "callback_url": "https://eneqd3r9zrjok.x.pipedream.net/"
};
</script>`;

/**
 * Vendor snippet #2 (handler + payment.failed) preserved for reference only.
 */
export const VENDOR_SNIPPET_HANDLER = String.raw`var options = {
    "key": "YOUR_KEY_ID",
    "amount": "50000",
    "currency": "<currency>",
    "name": "Acme Corp",
    "description": "Test Transaction",
    "order_id": "order_9A33XWu170gUtm",
    "handler": function (response){
        console.log('payment_id', response.razorpay_payment_id);
        console.log('order_id', response.razorpay_order_id);
        console.log('signature', response.razorpay_signature);
    }
};
var rzp1 = new Razorpay(options);
rzp1.on('payment.failed', function (response){
  console.error('payment.failed', response.error.code);
});`;

export const RazorpayCustom: FC<RazorpayCustomProps> = ({
  userId,
  email,
  userName,
  planType = "monthly",
  className,
  onSuccess,
  onError,
}) => {
  const { openPayment, loading, paymentState } = useRazorpayPayment();
  const [message, setMessage] = useState<string>("");

  const keyLabel = useMemo(() => {
    const key = PAYMENT_CONFIG.razorpayKeyId;
    if (!key) return "Not configured";
    return key.length > 12 ? `${key.slice(0, 12)}…` : key;
  }, []);

  const handlePay = useCallback(async () => {
    try {
      setMessage("");
      const ok = await openPayment(userId, email, planType, userName);
      if (ok) {
        setMessage("Payment successful. Subscription updated.");
        onSuccess?.();
      } else {
        setMessage("Checkout was closed before payment.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Payment failed";
      setMessage(msg);
      onError?.(msg);
    }
  }, [email, onError, onSuccess, openPayment, planType, userId, userName]);

  return (
    <div className={className}>
      <button
        id="rzp-button1"
        type="button"
        onClick={handlePay}
        disabled={loading}
        className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Processing..." : "Pay with Razorpay"}
      </button>

      <p className="mt-2 text-xs text-white/60">
        Gateway key: <span className="font-mono">{keyLabel}</span>
      </p>

      {paymentState !== "idle" && (
        <p className="mt-1 text-xs text-white/60">State: {paymentState}</p>
      )}

      {message && (
        <p className="mt-2 text-sm text-white/80" role="status">
          {message}
        </p>
      )}
    </div>
  );
};

export default RazorpayCustom;
