/**
 * ============================================================================
 * @deprecated Razorpay Payment Gateway — Billing Service
 * This module is deprecated. Use PhonePe (phonepe.ts) for all new payment flows.
 * Kept for backward compatibility with existing Razorpay transactions.
 * ============================================================================
 *
 * Handles the Razorpay checkout flow for BeamLab:
 *   1. POST /api/billing/razorpay/create-order  → Creates a Razorpay order
 *   2. Frontend opens Razorpay popup             → User pays inline
 *   3. POST /api/billing/razorpay/verify-payment → Verifies HMAC-SHA256 signature
 *   4. POST /api/billing/razorpay/webhook        → Server-to-server callback
 *
 * Key features:
 *   - HMAC-SHA256 payment signature verification (prevents tampering)
 *   - Webhook signature verification (X-Razorpay-Signature)
 *   - Idempotent order creation with deduplication guard
 *   - Structured logging with request correlation
 *   - Webhook replay deduplication
 *
 * Razorpay docs: https://razorpay.com/docs/payment-gateway/web-integration/standard/
 *
 * @version 1.0.0
 */

import { Router, Request, Response, type IRouter } from "express";
import { createHmac } from "crypto";
import { requireAuth, getAuth, isUsingClerk } from "./middleware/authMiddleware.js";
import {
  validateBody,
  billingCreateOrderSchema,
  razorpayVerifySchema,
} from "./middleware/validation.js";
import { User, Subscription, UserModel, PaymentWebhookEvent } from "./models.js";
import { resolveTierFromPlanId } from "./utils/billingConfig.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { createOrderUsingVendorPattern } from "./razorpay.custom.js";

// ============================================
// LOGGING
// ============================================

const log = {
  info: (msg: string, ctx?: Record<string, unknown>) =>
    logger.info({ service: "razorpay-billing", ...ctx }, msg),
  warn: (msg: string, ctx?: Record<string, unknown>) =>
    logger.warn({ service: "razorpay-billing", ...ctx }, msg),
  error: (msg: string, ctx?: Record<string, unknown>) =>
    logger.error({ service: "razorpay-billing", ...ctx }, msg),
};

// ============================================
// TYPES
// ============================================

export type PlanType = "monthly" | "yearly";
export type PlanId = "pro" | "business";
export type CheckoutPlanId = `${PlanId}_${PlanType}`;

interface PlanConfig {
  planId: PlanId;
  billingCycle: PlanType;
  checkoutPlanId: CheckoutPlanId;
  amountPaise: number;
  displayPrice: string;
  durationDays: number;
  label: string;
}

export const RAZORPAY_PLANS: Record<CheckoutPlanId, PlanConfig> = {
  pro_monthly: {
    planId: "pro",
    billingCycle: "monthly",
    checkoutPlanId: "pro_monthly",
    amountPaise: 99900,        // ₹999
    displayPrice: "₹999/month",
    durationDays: 30,
    label: "Pro Monthly",
  },
  pro_yearly: {
    planId: "pro",
    billingCycle: "yearly",
    checkoutPlanId: "pro_yearly",
    amountPaise: 999900,       // ₹9,999
    displayPrice: "₹9,999/year",
    durationDays: 365,
    label: "Pro Annual",
  },
  business_monthly: {
    planId: "business",
    billingCycle: "monthly",
    checkoutPlanId: "business_monthly",
    amountPaise: 199900,       // ₹1,999
    displayPrice: "₹1,999/month",
    durationDays: 30,
    label: "Business Monthly",
  },
  business_yearly: {
    planId: "business",
    billingCycle: "yearly",
    checkoutPlanId: "business_yearly",
    amountPaise: 1999900,      // ₹19,999
    displayPrice: "₹19,999/year",
    durationDays: 365,
    label: "Business Annual",
  },
};

function resolveCheckoutPlan(input: {
  planType?: string;
  planId?: string;
  checkoutPlanId?: string;
}): PlanConfig | null {
  const checkoutPlanId = (input.checkoutPlanId || "").toLowerCase() as CheckoutPlanId;
  if (checkoutPlanId && RAZORPAY_PLANS[checkoutPlanId]) {
    return RAZORPAY_PLANS[checkoutPlanId];
  }

  const planType = (input.planType || "").toLowerCase() as PlanType;
  const planId = ((input.planId || "pro").toLowerCase() as PlanId);
  if ((planType === "monthly" || planType === "yearly") && (planId === "pro" || planId === "business")) {
    return RAZORPAY_PLANS[`${planId}_${planType}` as CheckoutPlanId];
  }

  return null;
}

class BillingError extends Error {
  constructor(
    message: string,
    public code:
      | "PAYMENT_UNAVAILABLE"
      | "INVALID_SIGNATURE"
      | "MISSING_FIELDS"
      | "ORDER_CREATION_FAILED"
      | "VERIFICATION_FAILED"
      | "USER_NOT_FOUND",
    public statusCode = 400,
    public retryable = false,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

// Razorpay REST API response types
interface RazorpayOrderResponse {
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
  error?: { description: string; code: string };
}

// ============================================
// RAZORPAY CONFIGURATION
// ============================================

const RAZORPAY_KEY_ID = env.RAZORPAY_KEY_ID ?? "";
const RAZORPAY_KEY_SECRET = env.RAZORPAY_KEY_SECRET ?? "";
const RAZORPAY_WEBHOOK_SECRET = env.RAZORPAY_WEBHOOK_SECRET ?? "";
const BILLING_BYPASS_REQUESTED = process.env["TEMP_UNLOCK_ALL"] === "true";
const BILLING_BYPASS = BILLING_BYPASS_REQUESTED && env.NODE_ENV !== "production";

const isRazorpayConfigured = !!(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);

if (isRazorpayConfigured) {
  log.info("Razorpay initialized", { keyId: RAZORPAY_KEY_ID.slice(0, 12) + "..." });
} else {
  log.warn("Razorpay not configured — payment features disabled", {
    hasKeyId: !!RAZORPAY_KEY_ID,
    hasKeySecret: !!RAZORPAY_KEY_SECRET,
  });
}

if (BILLING_BYPASS_REQUESTED && env.NODE_ENV === "production") {
  log.warn("TEMP_UNLOCK_ALL was requested but is ignored in production");
} else if (BILLING_BYPASS) {
  log.warn("Billing bypass enabled (non-production only) — Razorpay verification skipped");
}

// ============================================
// IDEMPOTENCY STORE
// ============================================

const idempotencyStore = new Map<string, { result: unknown; expiresAt: number }>();
const IDEMPOTENCY_TTL = 5 * 60 * 1000; // 5 minutes

function cleanIdempotencyStore() {
  const now = Date.now();
  for (const [key, entry] of idempotencyStore) {
    if (entry.expiresAt < now) idempotencyStore.delete(key);
  }
}

// ============================================
// RAZORPAY BILLING SERVICE
// ============================================

export class RazorpayBillingService {
  /**
   * Create a Razorpay order.
   * Returns orderId + keyId for the frontend checkout popup.
   */
  static async createOrder(
    userId: string,
    planType: PlanType,
    planId: PlanId = "pro",
    checkoutPlanId?: string,
    idempotencyKey?: string,
  ): Promise<{ orderId: string; amount: number; currency: string; keyId: string }> {
    if (idempotencyKey) {
      cleanIdempotencyStore();
      const cached = idempotencyStore.get(idempotencyKey);
      if (cached) {
        log.info("Idempotent hit", { idempotencyKey });
        return cached.result as { orderId: string; amount: number; currency: string; keyId: string };
      }
    }

    if (!isRazorpayConfigured) {
      throw new BillingError("Payment gateway not configured", "PAYMENT_UNAVAILABLE", 503, true);
    }

    const plan = resolveCheckoutPlan({ planType, planId, checkoutPlanId });
    if (!plan) {
      throw new BillingError("Invalid plan type", "MISSING_FIELDS");
    }

    const receipt = `BL_${userId.slice(-8)}_${Date.now()}`;

    let order: RazorpayOrderResponse;
    try {
      order = (await createOrderUsingVendorPattern({
        amount: plan.amountPaise, // in paise (₹999 = 99900)
        currency: "INR",
        receipt,
        notes: {
          userId,
          planType: plan.billingCycle,
          planId: plan.planId,
          checkoutPlanId: plan.checkoutPlanId,
        },
      })) as RazorpayOrderResponse;
    } catch (error) {
      log.error("Razorpay order creation failed", {
        description: error instanceof Error ? error.message : String(error),
      });
      throw new BillingError("Failed to create payment order", "ORDER_CREATION_FAILED", 502, true);
    }

    const result = { orderId: order.id, amount: order.amount, currency: order.currency, keyId: RAZORPAY_KEY_ID };

    if (idempotencyKey) {
      idempotencyStore.set(idempotencyKey, { result, expiresAt: Date.now() + IDEMPOTENCY_TTL });
    }

    log.info("Razorpay order created", {
      orderId: order.id,
      planType: plan.billingCycle,
      planId: plan.planId,
      checkoutPlanId: plan.checkoutPlanId,
      userId: userId.slice(-6),
    });
    return result;
  }

  /**
   * Verify a Razorpay payment.
   * Verifies: HMAC-SHA256(orderId + "|" + paymentId, keySecret)
   */
  static async verifyAndActivate(
    userId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string,
    planType: PlanType,
    planId: PlanId = "pro",
    checkoutPlanId?: string,
  ): Promise<void> {
    if (!isRazorpayConfigured) {
      throw new BillingError("Payment gateway not configured", "PAYMENT_UNAVAILABLE", 503);
    }

    // Signature verification (prevents tampering with payment IDs)
    const expectedSignature = createHmac("sha256", RAZORPAY_KEY_SECRET)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    if (expectedSignature !== razorpaySignature) {
      log.error("Razorpay signature mismatch", {
        orderId: razorpayOrderId,
        paymentId: razorpayPaymentId,
      });
      throw new BillingError("Invalid payment signature", "INVALID_SIGNATURE", 400);
    }

    const plan = resolveCheckoutPlan({ planType, planId, checkoutPlanId });
    if (!plan) {
      throw new BillingError("Invalid plan type", "MISSING_FIELDS");
    }

    // Activate subscription in DB
    await RazorpayBillingService.activateSubscription(
      userId,
      razorpayPaymentId,
      razorpayOrderId,
      plan,
    );

    log.info("Razorpay payment verified & subscription activated", {
      userId: userId.slice(-6),
      planType: plan.billingCycle,
      planId: plan.planId,
      checkoutPlanId: plan.checkoutPlanId,
      paymentId: razorpayPaymentId,
    });
  }

  /**
   * Activate subscription after successful payment.
   */
  static async activateSubscription(
    userId: string,
    transactionId: string,
    orderId: string,
    plan: PlanConfig,
  ): Promise<void> {
    const targetTier = resolveTierFromPlanId(plan.planId);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    const USE_CLERK = isUsingClerk();
    const userDoc = USE_CLERK
      ? await User.findOne({ clerkId: userId }).lean()
      : await UserModel.findById(userId).lean();

    if (!userDoc?._id) {
      throw new BillingError("User not found", "USER_NOT_FOUND", 404);
    }

    const duplicateTxSub = await Subscription.findOne({
      $or: [
        { razorpayPaymentId: transactionId },
        { razorpayOrderId: orderId },
      ],
    })
      .select('user razorpayPaymentId razorpayOrderId')
      .lean();

    if (duplicateTxSub) {
      const duplicateUserId = String(duplicateTxSub.user);
      const currentUserId = String(userDoc._id);
      if (duplicateUserId !== currentUserId) {
        throw new BillingError(
          'Transaction already linked to another account',
          'VERIFICATION_FAILED',
          409,
          false,
        );
      }
      log.info('Duplicate Razorpay activation skipped', {
        userId: String(userId),
        transactionId,
        orderId,
      });
      return;
    }

    const subscription = await Subscription.findOneAndUpdate(
      { user: userDoc._id },
      {
        $set: {
          user: userDoc._id,
          planType: plan.checkoutPlanId,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: expiresAt,
          cancelAtPeriodEnd: false,
          razorpayPaymentId: transactionId,
          razorpayOrderId: orderId,
        },
      },
      { upsert: true, new: true },
    );

    if (USE_CLERK) {
      await User.updateOne(
        { _id: userDoc._id },
        { $set: { tier: targetTier, subscription: subscription._id } },
      );
    } else {
      await UserModel.updateOne(
        { _id: userDoc._id },
        { $set: { subscriptionTier: targetTier } },
      );
    }

    log.info("Subscription activated via Razorpay", {
      userId: userId.slice(-6),
      planType: plan.billingCycle,
      planId: plan.planId,
      checkoutPlanId: plan.checkoutPlanId,
      expiresAt: expiresAt.toISOString(),
    });
  }

  /**
   * Handle Razorpay webhook callback.
   * Verifies X-Razorpay-Signature header.
   */
  static async handleWebhook(
    rawBody: string,
    signatureHeader: string,
  ): Promise<{ processed: boolean; eventId?: string }> {
    if (!RAZORPAY_WEBHOOK_SECRET) {
      log.warn("Razorpay webhook secret not configured — skipping signature verification");
    } else {
      const expectedSig = createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
        .update(rawBody)
        .digest("hex");

      if (expectedSig !== signatureHeader) {
        throw new BillingError("Invalid webhook signature", "INVALID_SIGNATURE", 400);
      }
    }

    const event = JSON.parse(rawBody) as {
      event: string;
      payload?: {
        payment?: {
          entity?: {
            id: string;
            order_id: string;
            notes?: { userId?: string; planType?: string; planId?: string; checkoutPlanId?: string };
          };
        };
      };
    };

    const eventId = event.payload?.payment?.entity?.id ?? `evt_${Date.now()}`;

    // Deduplication guard (persistent)
    try {
      await PaymentWebhookEvent.create({
        gateway: "razorpay",
        eventKey: eventId,
        status: "processing",
        metadata: { eventType: event.event },
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        log.info("Webhook duplicate — skipping", { eventId });
        return { processed: false, eventId };
      }
      throw err;
    }

    if (event.event === "payment.captured") {
      const payment = event.payload?.payment?.entity;
      if (payment) {
        const userId = payment.notes?.userId ?? "";
        const plan = resolveCheckoutPlan({
          planType: payment.notes?.planType,
          planId: payment.notes?.planId,
          checkoutPlanId: payment.notes?.checkoutPlanId,
        });
        if (userId) {
          if (!plan) {
            throw new BillingError("Invalid plan in webhook payload", "MISSING_FIELDS");
          }
          await RazorpayBillingService.activateSubscription(
            userId,
            payment.id,
            payment.order_id,
            plan,
          );
        }
      }
    }

    await PaymentWebhookEvent.updateOne(
      { gateway: "razorpay", eventKey: eventId },
      {
        $set: {
          status: "processed",
          metadata: {
            eventType: event.event,
          },
        },
      },
    );

    return { processed: true, eventId };
  }
}

// ============================================
// EXPRESS ROUTER
// ============================================

export const razorpayBillingRouter: IRouter = Router();

/**
 * POST /api/billing/razorpay/create-order
 * Creates a Razorpay order and returns orderId + keyId for frontend checkout.
 */
razorpayBillingRouter.post(
  "/create-order",
  requireAuth(),
  validateBody(billingCreateOrderSchema),
  async (req: Request, res: Response) => {
    const requestId = (req as Request & { requestId?: string }).requestId || "unknown";
    try {
      const { userId } = getAuth(req);
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized", requestId });
        return;
      }

      const { planType, planId, checkoutPlanId } = req.body as {
        planType: PlanType;
        planId?: PlanId;
        checkoutPlanId?: string;
      };

      if (BILLING_BYPASS) {
        res.json({
          success: true,
          requestId,
          data: {
            bypassed: true,
            tier: "enterprise",
            message: "Billing bypass active: payment is not required.",
          },
        });
        return;
      }

      const idempotencyKey = req.headers["x-idempotency-key"] as string | undefined;

      const result = await RazorpayBillingService.createOrder(
        userId,
        planType as PlanType,
        (planId as PlanId | undefined) ?? "pro",
        checkoutPlanId,
        idempotencyKey,
      );

      res.json({ success: true, requestId, data: result });
    } catch (err) {
      if (err instanceof BillingError) {
        res.status(err.statusCode).json({
          success: false,
          message: err.message,
          code: err.code,
          retryable: err.retryable,
          requestId,
        });
        return;
      }
      log.error("Unexpected error in razorpay/create-order", {
        error: err instanceof Error ? err.message : String(err),
        requestId,
      });
      res.status(500).json({ success: false, message: "Internal server error", requestId });
    }
  },
);

/**
 * POST /api/billing/razorpay/verify-payment
 * Verifies Razorpay payment signature and activates subscription.
 */
razorpayBillingRouter.post(
  "/verify-payment",
  requireAuth(),
  validateBody(razorpayVerifySchema),
  async (req: Request, res: Response) => {
    const requestId = (req as Request & { requestId?: string }).requestId || "unknown";
    try {
      const { userId } = getAuth(req);
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized", requestId });
        return;
      }

      const { razorpayOrderId, razorpayPaymentId, razorpaySignature, planType, planId, checkoutPlanId } =
        req.body as {
          razorpayOrderId: string;
          razorpayPaymentId: string;
          razorpaySignature: string;
          planType: PlanType;
          planId?: PlanId;
          checkoutPlanId?: string;
        };

      if (BILLING_BYPASS) {
        res.json({
          success: true,
          message: "Billing bypass active. Pro features unlocked.",
          requestId,
          data: { tier: "enterprise", planType, transactionId: razorpayPaymentId },
        });
        return;
      }

      await RazorpayBillingService.verifyAndActivate(
        userId,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature,
        planType as PlanType,
        (planId as PlanId | undefined) ?? "pro",
        checkoutPlanId,
      );

      res.json({
        success: true,
        requestId,
        message: `Payment verified. Welcome to BeamLab ${planId === 'business' ? 'Enterprise' : 'Pro'}!`,
        data: {
          tier: resolveTierFromPlanId((planId as PlanId | undefined) ?? 'pro'),
          planType,
          transactionId: razorpayPaymentId,
        },
      });
    } catch (err) {
      if (err instanceof BillingError) {
        res.status(err.statusCode).json({
          success: false,
          message: err.message,
          code: err.code,
          requestId,
        });
        return;
      }
      log.error("Unexpected error in razorpay/verify-payment", {
        error: err instanceof Error ? err.message : String(err),
        requestId,
      });
      res.status(500).json({ success: false, message: "Internal server error", requestId });
    }
  },
);

/**
 * POST /api/billing/razorpay/webhook
 * Razorpay server-to-server payment event webhook.
 * Signature verified via X-Razorpay-Signature header.
 */
razorpayBillingRouter.post(
  "/webhook",
  async (req: Request, res: Response) => {
    const requestId = (req as Request & { requestId?: string }).requestId || "unknown";
    try {
      const signatureHeader = req.headers["x-razorpay-signature"] as string ?? "";
      const rawBody = (req as Request & { rawBody?: Buffer }).rawBody?.toString("utf-8")
        ?? JSON.stringify(req.body);

      const { processed, eventId } = await RazorpayBillingService.handleWebhook(
        rawBody,
        signatureHeader,
      );

      log.info("Razorpay webhook processed", { processed, eventId, requestId });
      res.json({ success: true, requestId });
    } catch (err) {
      if (err instanceof BillingError && err.code === "INVALID_SIGNATURE") {
        log.warn("Razorpay webhook signature invalid", { requestId });
        res.status(400).json({ success: false, message: err.message, requestId });
        return;
      }
      log.error("Razorpay webhook error", {
        error: err instanceof Error ? err.message : String(err),
        requestId,
      });
      res.status(500).json({ success: false, message: "Webhook processing failed", requestId });
    }
  },
);

export default razorpayBillingRouter;
