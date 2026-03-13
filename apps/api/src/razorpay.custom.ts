import { env } from "./config/env.js";

/**
 * Vendor-style order payload adapted to this codebase.
 * Amount is always in currency subunits (paise for INR).
 */
export interface VendorOrderCreateRequest {
  amount: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface VendorOrderCreateResponse {
  id: string;
  entity: string;
  amount: number;
  amount_paid: number;
  amount_due: number;
  currency: string;
  receipt: string;
  status: string;
  attempts: number;
  created_at: number;
}

/**
 * Preserved vendor snippet for reference (non-executable):
 *
 * var instance = new Razorpay({ key_id: 'YOUR_KEY_ID', key_secret: 'YOUR_SECRET' })
 * instance.orders.create({ amount, currency, receipt, notes })
 */
export const VENDOR_SERVER_SNIPPET = String.raw`var instance = new Razorpay({ key_id: 'YOUR_KEY_ID', key_secret: 'YOUR_SECRET' })
instance.orders.create({
  amount: 50000,
  currency: "INR",
  receipt: "receipt#1",
  notes: { key1: "value3", key2: "value2" }
})`;

/**
 * Creates an order using Razorpay REST API with Basic auth.
 * Keys are sourced from env, never hardcoded.
 */
export async function createOrderUsingVendorPattern(
  payload: VendorOrderCreateRequest,
): Promise<VendorOrderCreateResponse> {
  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    throw new Error("Razorpay keys are missing. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.");
  }

  const authHeader =
    "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: authHeader,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const err = (await response.json().catch(() => ({}))) as {
      error?: { code?: string; description?: string };
    };
    throw new Error(
      err.error?.description || `Razorpay order create failed (HTTP ${response.status})`,
    );
  }

  return (await response.json()) as VendorOrderCreateResponse;
}
