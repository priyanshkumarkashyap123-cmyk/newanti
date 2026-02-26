/**
 * Razorpay Billing Service
 * One-time payment order flow for Indian SaaS (using Orders API)
 *
 * Flow:
 *   1. Frontend calls POST /api/billing/create-order
 *   2. Backend creates a Razorpay Order and returns orderId + keyId
 *   3. Frontend opens Razorpay Checkout with orderId
 *   4. On success, frontend calls POST /api/billing/verify-payment
 *   5. Backend verifies signature and upgrades user to PRO
 *   6. Webhooks handle async confirmation (payment.captured / payment.failed)
 */

import * as crypto from "crypto";
import { Request, Response, Router, type IRouter } from "express";
import { User, Subscription } from "./models.js";
import { createRequire } from "module";
import { env } from "./config/env.js";

// ESM-compatible require for razorpay CommonJS module
const require = createRequire(import.meta.url);
const Razorpay = require("razorpay");

// ============================================
// RAZORPAY INITIALIZATION
// ============================================

const RAZORPAY_KEY_ID = env.RAZORPAY_KEY_ID ?? "";
const RAZORPAY_KEY_SECRET = env.RAZORPAY_KEY_SECRET ?? "";
const RAZORPAY_WEBHOOK_SECRET = env.RAZORPAY_WEBHOOK_SECRET ?? "";

// Initialize Razorpay only if credentials are available
let razorpay: InstanceType<typeof Razorpay> | null = null;

if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });
  console.log("✅ Razorpay initialized (Orders mode)");
} else {
  console.warn("⚠️ Missing Razorpay credentials - payment features disabled");
}

// ============================================
// PLAN/PRICING CONFIGURATION (amounts in paise)
// ============================================

const PRICING = {
  PRO_MONTHLY: {
    amount: 99900, // ₹999
    currency: "INR",
    description: "BeamLab Pro - Monthly",
    durationDays: 30,
  },
  PRO_YEARLY: {
    amount: 999900, // ₹9,999
    currency: "INR",
    description: "BeamLab Pro - Annual",
    durationDays: 365,
  },
} as const;

// ============================================
// RAZORPAY BILLING SERVICE (Orders API)
// ============================================

export class RazorpayBillingService {
  /**
   * Create a Razorpay order for a one-time payment
   */
  static async createOrder(
    userId: string,
    email: string,
    planType: "monthly" | "yearly" = "monthly",
  ): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    keyId: string;
  }> {
    // Get or create user
    let user = await User.findOne({ clerkId: userId });

    if (!user) {
      user = await User.create({
        clerkId: userId,
        email,
        tier: "free",
      });
    }

    // Check if Razorpay is configured
    if (!razorpay) {
      console.warn("⚠️ Razorpay not configured - returning 503");
      throw new Error("PAYMENT_SERVICE_UNAVAILABLE");
    }

    // Select pricing
    const pricing =
      planType === "yearly" ? PRICING.PRO_YEARLY : PRICING.PRO_MONTHLY;

    // Create Razorpay order
    const order = await razorpay.orders.create({
      amount: pricing.amount,
      currency: pricing.currency,
      receipt: `beamlab_${userId}_${Date.now()}`,
      notes: {
        userId,
        email,
        planType,
        description: pricing.description,
      },
    });

    console.log(
      `✅ Razorpay order created: ${order.id} for user ${userId} (${planType})`,
    );

    return {
      orderId: order.id,
      amount: pricing.amount,
      currency: pricing.currency,
      keyId: RAZORPAY_KEY_ID,
    };
  }

  /**
   * Verify Razorpay payment signature (order flow)
   * Signature = HMAC-SHA256(order_id + "|" + payment_id, key_secret)
   */
  static verifyPaymentSignature(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    const body = orderId + "|" + paymentId;
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(body)
      .digest("hex");

    return expectedSignature === signature;
  }

  /**
   * Verify webhook signature (HMAC-SHA256)
   */
  static verifyWebhookSignature(body: string, signature: string): boolean {
    if (!RAZORPAY_WEBHOOK_SECRET) {
      console.warn(
        "⚠️ RAZORPAY_WEBHOOK_SECRET not set, skipping webhook verification",
      );
      return false;
    }
    const expectedSignature = crypto
      .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
      .update(body)
      .digest("hex");

    return expectedSignature === signature;
  }

  /**
   * Activate user subscription after payment verification
   */
  static async activateSubscription(
    userId: string,
    paymentId: string,
    orderId: string,
    planType: "monthly" | "yearly" = "monthly",
  ): Promise<void> {
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }

    const pricing =
      planType === "yearly" ? PRICING.PRO_YEARLY : PRICING.PRO_MONTHLY;
    const now = new Date();
    const periodEnd = new Date(
      now.getTime() + pricing.durationDays * 24 * 60 * 60 * 1000,
    );

    // Create or update subscription record
    await Subscription.findOneAndUpdate(
      { user: user._id },
      {
        stripeCustomerId: paymentId, // Reusing field for Razorpay payment ID
        stripeSubscriptionId: orderId, // Reusing field for Razorpay order ID
        stripePriceId: planType,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
      { upsert: true, new: true },
    );

    // Upgrade user tier
    user.tier = "pro";
    await user.save();

    console.log(
      `✅ User ${userId} upgraded to PRO (${planType}) until ${periodEnd.toISOString()}`,
    );
  }

  /**
   * Handle webhook events
   */
  static async handleWebhook(
    event: string,
    payload: RazorpayWebhookPayload,
  ): Promise<{ success: boolean; message: string }> {
    console.log(`📩 Razorpay webhook: ${event}`);

    switch (event) {
      case "payment.captured": {
        const payment = payload.payment?.entity;
        if (!payment?.id || !payment?.order_id) {
          return { success: false, message: "Missing payment/order info" };
        }
        const notes = payment.notes || {};
        const userId = notes.userId;
        const planType = (notes.planType as "monthly" | "yearly") || "monthly";

        if (userId) {
          await this.activateSubscription(
            userId,
            payment.id,
            payment.order_id,
            planType,
          );
          return {
            success: true,
            message: "Payment captured and user upgraded",
          };
        }
        return {
          success: true,
          message: "Payment captured (no userId in notes)",
        };
      }

      case "payment.failed": {
        const payment = payload.payment?.entity;
        console.log(
          `⚠️ Payment failed: ${payment?.id} for order ${payment?.order_id}`,
        );
        return { success: true, message: "Payment failure recorded" };
      }

      case "order.paid": {
        const order = payload.order?.entity;
        const notes = order?.notes || {};
        const userId = notes.userId;
        const planType = (notes.planType as "monthly" | "yearly") || "monthly";

        if (userId && order?.id) {
          await this.activateSubscription(userId, order.id, order.id, planType);
          return { success: true, message: "Order paid and user upgraded" };
        }
        return { success: true, message: "Order paid (no userId in notes)" };
      }

      default:
        return { success: true, message: `Unhandled event: ${event}` };
    }
  }
}

// ============================================
// WEBHOOK PAYLOAD TYPE
// ============================================

interface RazorpayWebhookPayload {
  payment?: {
    entity?: {
      id?: string;
      order_id?: string;
      amount?: number;
      currency?: string;
      status?: string;
      notes?: Record<string, string>;
    };
  };
  order?: {
    entity?: {
      id?: string;
      amount?: number;
      currency?: string;
      status?: string;
      notes?: Record<string, string>;
    };
  };
}

// ============================================
// EXPRESS ROUTER
// ============================================

import { requireAuth, getAuth } from "./middleware/authMiddleware.js";

export const razorpayRouter: IRouter = Router();

/**
 * POST /api/billing/create-order
 * Create Razorpay order for payment
 */
razorpayRouter.post(
  "/create-order",
  requireAuth(),
  async (req: Request, res: Response) => {
    try {
      const { email, planType = "monthly" } = req.body;
      const { userId } = getAuth(req);

      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      if (!email) {
        res.status(400).json({ success: false, message: "Missing email" });
        return;
      }

      if (!razorpay) {
        res.status(503).json({
          success: false,
          message:
            "Payment service is currently unavailable. Please try again later.",
        });
        return;
      }

      const result = await RazorpayBillingService.createOrder(
        userId,
        email,
        planType,
      );

      res.json({
        success: true,
        orderId: result.orderId,
        amount: result.amount,
        currency: result.currency,
        keyId: result.keyId,
      });
    } catch (error) {
      console.error("Create order error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";

      if (message === "PAYMENT_SERVICE_UNAVAILABLE") {
        res.status(503).json({
          success: false,
          message:
            "Payment service is currently unavailable. Please try again later.",
        });
        return;
      }

      res.status(500).json({ success: false, message });
    }
  },
);

/**
 * POST /api/billing/create-subscription  (backward-compat alias -> same as create-order)
 */
razorpayRouter.post(
  "/create-subscription",
  requireAuth(),
  async (req: Request, res: Response) => {
    try {
      const { email, planType = "monthly" } = req.body;
      const { userId } = getAuth(req);

      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      if (!email) {
        res.status(400).json({ success: false, message: "Missing email" });
        return;
      }

      if (!razorpay) {
        res.status(503).json({
          success: false,
          message:
            "Payment service is currently unavailable. Please try again later.",
        });
        return;
      }

      const result = await RazorpayBillingService.createOrder(
        userId,
        email,
        planType,
      );

      // Return in old format for backward compatibility
      res.json({
        success: true,
        subscriptionId: result.orderId,
        orderId: result.orderId,
        amount: result.amount,
        currency: result.currency,
        keyId: result.keyId,
      });
    } catch (error) {
      console.error("Create subscription/order error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, message });
    }
  },
);

/**
 * POST /api/billing/verify-payment
 * Verify Razorpay payment signature and upgrade user
 */
razorpayRouter.post(
  "/verify-payment",
  requireAuth(),
  async (req: Request, res: Response) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        planType = "monthly",
      } = req.body;
      const { userId } = getAuth(req);

      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        res.status(400).json({
          success: false,
          message: "Missing payment details (order_id, payment_id, signature)",
        });
        return;
      }

      // Verify signature: HMAC-SHA256(order_id|payment_id, key_secret)
      const isValid = RazorpayBillingService.verifyPaymentSignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
      );

      if (!isValid) {
        res
          .status(400)
          .json({ success: false, message: "Invalid payment signature" });
        return;
      }

      // Activate subscription (upgrade to PRO)
      await RazorpayBillingService.activateSubscription(
        userId,
        razorpay_payment_id,
        razorpay_order_id,
        planType,
      );

      res.json({
        success: true,
        message: "Payment verified and account upgraded to Pro!",
      });
    } catch (error) {
      console.error("Verify payment error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, message });
    }
  },
);

/**
 * POST /api/billing/webhooks/razorpay
 * Razorpay webhook handler (async payment confirmation)
 */
razorpayRouter.post(
  "/webhooks/razorpay",
  async (req: Request, res: Response) => {
    const signature = req.headers["x-razorpay-signature"] as string;

    if (!signature) {
      res.status(400).json({ message: "Missing x-razorpay-signature header" });
      return;
    }

    try {
      // Verify webhook signature
      const body =
        typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const isValid = RazorpayBillingService.verifyWebhookSignature(
        body,
        signature,
      );

      if (!isValid) {
        res.status(400).json({ message: "Invalid webhook signature" });
        return;
      }

      // Parse payload
      const payload =
        typeof req.body === "string" ? JSON.parse(req.body) : req.body;
      const event = payload.event as string;

      const result = await RazorpayBillingService.handleWebhook(
        event,
        payload.payload,
      );

      res.json(result);
    } catch (error) {
      console.error("Webhook error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ message });
    }
  },
);

/**
 * GET /api/billing/status
 * Get current payment/subscription status for the authenticated user
 */
razorpayRouter.get(
  "/status",
  requireAuth(),
  async (req: Request, res: Response) => {
    try {
      const { userId } = getAuth(req);

      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }

      const user = await User.findOne({ clerkId: userId });
      if (!user) {
        res.json({ success: true, data: { tier: "free", active: false } });
        return;
      }

      const subscription = await Subscription.findOne({ user: user._id });

      if (!subscription || subscription.status !== "active") {
        res.json({
          success: true,
          data: {
            tier: user.tier || "free",
            active: false,
          },
        });
        return;
      }

      res.json({
        success: true,
        data: {
          tier: user.tier || "free",
          active: true,
          expiresAt: subscription.currentPeriodEnd,
          planType: subscription.stripePriceId || "monthly",
        },
      });
    } catch (error) {
      console.error("Get billing status error:", error);
      res.status(500).json({ success: false, message: "Internal error" });
    }
  },
);

export default RazorpayBillingService;
