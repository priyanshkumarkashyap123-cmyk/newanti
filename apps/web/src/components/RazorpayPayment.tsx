/**
 * RazorpayPayment - Frontend Payment Component
 * Uses Razorpay Orders API for one-time payments
 *
 * Flow:
 *   1. Call backend to create an order
 *   2. Open Razorpay checkout with orderId
 *   3. On success, verify payment on backend
 *   4. Backend upgrades user to PRO
 */

import { FC, useState, useCallback, useEffect } from "react";
import { useAuth } from "../providers/AuthProvider";
import { API_CONFIG } from "../config/env";

// ============================================
// TYPES
// ============================================

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayOptions {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  image?: string;
  handler: (response: RazorpayResponse) => void;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  theme?: {
    color?: string;
  };
  modal?: {
    ondismiss?: () => void;
  };
  notes?: Record<string, string>;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => {
      open: () => void;
      close: () => void;
    };
  }
}

interface PaymentModalProps {
  userId: string;
  email: string;
  userName?: string;
  planType?: "monthly" | "yearly";
  onSuccess?: () => void;
  onError?: (error: string) => void;
  onClose?: () => void;
}

// ============================================
// RAZORPAY SCRIPT LOADER
// ============================================

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

// ============================================
// API HELPERS
// ============================================

const API_URL = API_CONFIG.baseUrl;

async function createOrder(
  userId: string,
  email: string,
  token: string,
  planType: "monthly" | "yearly",
) {
  const response = await fetch(`${API_URL}/api/billing/create-order`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ userId, email, planType }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Failed to create payment order");
  }

  return response.json();
}

async function verifyPayment(
  razorpay_order_id: string,
  razorpay_payment_id: string,
  razorpay_signature: string,
  planType: string,
  token: string,
) {
  const response = await fetch(`${API_URL}/api/billing/verify-payment`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      planType,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.message || "Payment verification failed");
  }

  return response.json();
}

// ============================================
// PAYMENT MODAL COMPONENT
// ============================================

export const RazorpayPaymentModal: FC<PaymentModalProps> = ({
  userId,
  email,
  userName,
  planType = "monthly",
  onSuccess,
  onError,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use auth hook to get token
  const { getToken } = useAuth();

  // Load Razorpay script on mount
  useEffect(() => {
    loadRazorpayScript();
  }, []);

  const handleUpgrade = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Authentication required");
      }

      // 1. Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error("Failed to load Razorpay");
      }

      // 2. Create order on backend
      const { orderId, amount, currency, keyId } = await createOrder(
        userId,
        email,
        token,
        planType,
      );

      // 3. Open Razorpay checkout
      const options: RazorpayOptions = {
        key: keyId,
        order_id: orderId,
        amount,
        currency,
        name: "BeamLab",
        description:
          planType === "yearly"
            ? "Annual Pro Subscription"
            : "Monthly Pro Subscription",
        image: "/logo.png",
        handler: async (response) => {
          try {
            // 4. Verify payment on backend
            await verifyPayment(
              response.razorpay_order_id,
              response.razorpay_payment_id,
              response.razorpay_signature,
              planType,
              token,
            );

            setLoading(false);
            onSuccess?.();
          } catch (err) {
            const errMsg =
              err instanceof Error ? err.message : "Verification failed";
            setError(errMsg);
            onError?.(errMsg);
            setLoading(false);
          }
        },
        prefill: {
          ...(userName ? { name: userName } : {}),
          email: email,
        },
        theme: {
          color: "#4F8EF7",
        },
        modal: {
          ondismiss: () => {
            setLoading(false);
            onClose?.();
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.open();
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Unknown error";
      setError(errMsg);
      onError?.(errMsg);
      setLoading(false);
    }
  }, [
    userId,
    email,
    userName,
    planType,
    onSuccess,
    onError,
    onClose,
    getToken,
  ]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h2 style={styles.title}>Upgrade to Pro</h2>

        <div style={styles.planInfo}>
          <div style={styles.planName}>BeamLab Pro</div>
          <div style={styles.price}>
            {planType === "yearly" ? "₹9,999/year" : "₹999/month"}
          </div>
          {planType === "yearly" && (
            <div style={styles.savings}>Save 17% with annual billing</div>
          )}
        </div>

        <ul style={styles.features}>
          <li>✓ Unlimited Projects</li>
          <li>✓ Advanced Analysis (Modal, Buckling)</li>
          <li>✓ Steel & Concrete Design</li>
          <li>✓ PDF Reports</li>
          <li>✓ Priority Support</li>
        </ul>

        {error && <div style={styles.error}>{error}</div>}

        <button
          style={styles.button}
          onClick={handleUpgrade}
          disabled={loading}
        >
          {loading ? "Processing..." : "Upgrade Now"}
        </button>

        <div style={styles.secure}>🔒 Secured by Razorpay</div>
      </div>
    </div>
  );
};

// ============================================
// HOOK FOR MANUAL TRIGGER
// ============================================

export function useRazorpayPayment() {
  const [loading, setLoading] = useState(false);
  const { getToken } = useAuth();

  const openPayment = useCallback(
    async (
      userId: string,
      email: string,
      planType: "monthly" | "yearly" = "monthly",
    ): Promise<boolean> => {
      setLoading(true);

      try {
        const token = await getToken();
        if (!token) throw new Error("Authentication required");

        const scriptLoaded = await loadRazorpayScript();
        if (!scriptLoaded) throw new Error("Failed to load Razorpay");

        const { orderId, amount, currency, keyId } = await createOrder(
          userId,
          email,
          token,
          planType,
        );

        return new Promise((resolve) => {
          const options: RazorpayOptions = {
            key: keyId,
            order_id: orderId,
            amount,
            currency,
            name: "BeamLab",
            description: planType === "yearly" ? "Annual Pro" : "Monthly Pro",
            handler: async (response) => {
              try {
                await verifyPayment(
                  response.razorpay_order_id,
                  response.razorpay_payment_id,
                  response.razorpay_signature,
                  planType,
                  token,
                );
                setLoading(false);
                resolve(true);
              } catch {
                setLoading(false);
                resolve(false);
              }
            },
            theme: { color: "#4F8EF7" },
            modal: {
              ondismiss: () => {
                setLoading(false);
                resolve(false);
              },
            },
          };

          const rzp = new window.Razorpay(options);
          rzp.open();
        });
      } catch (err) {
        setLoading(false);
        throw err;
      }
    },
    [getToken],
  );

  return { openPayment, loading };
}

// ============================================
// STYLES
// ============================================

const styles = {
  container: {
    position: "fixed" as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9995,
  },
  card: {
    backgroundColor: "#1E1E2E",
    borderRadius: "16px",
    padding: "32px",
    maxWidth: "400px",
    width: "90%",
    textAlign: "center" as const,
  },
  title: {
    color: "#fff",
    fontSize: "24px",
    marginBottom: "24px",
    fontWeight: 600,
  },
  planInfo: {
    marginBottom: "24px",
  },
  planName: {
    color: "#4F8EF7",
    fontSize: "18px",
    fontWeight: 600,
    marginBottom: "8px",
  },
  price: {
    color: "#fff",
    fontSize: "32px",
    fontWeight: 700,
  },
  savings: {
    color: "#22C55E",
    fontSize: "14px",
    marginTop: "4px",
  },
  features: {
    listStyle: "none" as const,
    padding: 0,
    margin: "24px 0",
    textAlign: "left" as const,
    color: "rgba(255, 255, 255, 0.8)",
  },
  error: {
    color: "#EF4444",
    fontSize: "14px",
    marginBottom: "16px",
    padding: "8px",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    borderRadius: "8px",
  },
  button: {
    width: "100%",
    padding: "14px 24px",
    fontSize: "16px",
    fontWeight: 600,
    color: "#fff",
    backgroundColor: "#4F8EF7",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  secure: {
    marginTop: "16px",
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: "12px",
  },
};

export default RazorpayPaymentModal;
