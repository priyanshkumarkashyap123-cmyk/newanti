/**
 * ============================================================================
 * PhonePe Payment Gateway — Production-Grade Billing Service
 * ============================================================================
 *
 * Handles the full PhonePe Standard Checkout flow for BeamLab:
 *   1. POST /api/billing/create-order  → Initiates a PhonePe payment
 *   2. PhonePe redirects user back     → Frontend polls /api/billing/status
 *   3. POST /api/billing/verify-payment→ Checks tx status with PhonePe S2S API
 *   4. POST /api/billing/webhooks/phonepe → Server-to-server callback
 *
 * Key features:
 *   - Idempotent order creation (duplicate requests return same merchantTransactionId)
 *   - HMAC-SHA256 webhook signature verification (X-VERIFY header)
 *   - Structured logging with request correlation
 *   - Auto-expiry enforcement on /status
 *   - Webhook replay deduplication
 *
 * PhonePe Standard Checkout docs:
 *   https://developer.phonepe.com/v1/reference/pay-api
 *
 * @version 1.0.0
 */

import { Router, Request, Response, type IRouter } from "express";
import { createHmac } from "crypto";
import { requireAuth, getAuth, isUsingClerk } from "./middleware/authMiddleware.js";
import {
  validateBody,
  billingInitiateSchema,
  billingCreateOrderSchema,
  billingVerifySchema,
} from "./middleware/validation.js";
import { User, Subscription, UserModel, PaymentWebhookEvent } from "./models.js";
import { resolveTierFromPlanId } from "./utils/billingConfig.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";

// ============================================
// LOGGING
// ============================================

const log = {
  info: (msg: string, ctx?: Record<string, unknown>) =>
    logger.info({ service: "phonepe-billing", ...ctx }, msg),
  warn: (msg: string, ctx?: Record<string, unknown>) =>
    logger.warn({ service: "phonepe-billing", ...ctx }, msg),
  error: (msg: string, ctx?: Record<string, unknown>) =>
    logger.error({ service: "phonepe-billing", ...ctx }, msg),
};

import { BILLING_PLANS, CheckoutPlanId, BillingPlanCycle, BillingPlanId } from "./utils/billingConfig.js";
import { logTierChange } from "./utils/tierChangeLog.js";

// ============================================
// TYPES
// ============================================

export type PlanType = BillingPlanCycle;
export type PlanId = BillingPlanId;

export const PLANS = BILLING_PLANS;

function resolveCheckoutPlan(input: {
  planType?: string;
  planId?: string;
  checkoutPlanId?: string;
}): BillingPlanConfig | null {
  const checkoutPlanId = (input.checkoutPlanId || "").toLowerCase() as CheckoutPlanId;
  if (checkoutPlanId && PLANS[checkoutPlanId]) {
    return PLANS[checkoutPlanId];
  }

  const planType = (input.planType || "").toLowerCase() as PlanType;
  const planId = ((input.planId || "pro").toLowerCase() as PlanId);
  if ((planType === "monthly" || planType === "yearly") && (planId === "pro" || planId === "business")) {
    return PLANS[`${planId}_${planType}` as CheckoutPlanId];
  }

  return null;
}

/** Error taxonomy for billing operations */
class BillingError extends Error {
  constructor(
    message: string,
    public code:
      | "PAYMENT_UNAVAILABLE"
      | "USER_NOT_FOUND"
      | "INVALID_SIGNATURE"
      | "MISSING_FIELDS"
      | "DUPLICATE_ORDER"
      | "ALREADY_PRO"
      | "ORDER_CREATION_FAILED"
      | "VERIFICATION_FAILED",
    public statusCode = 400,
    public retryable = false,
  ) {
    super(message);
    this.name = "BillingError";
  }
}

// PhonePe API response types
interface PhonePePayResponse {
  success: boolean;
  code: string;
  message: string;
  data?: {
    merchantId: string;
    merchantTransactionId: string;
    instrumentResponse?: {
      type: string;
      redirectInfo?: {
        url: string;
        method: string;
      };
    };
  };
}

interface PhonePeStatusResponse {
  success: boolean;
  code: string;
  message: string;
  data?: {
    merchantId: string;
    merchantTransactionId: string;
    transactionId: string;
    amount: number;
    state: "COMPLETED" | "PENDING" | "FAILED";
    responseCode: string;
    paymentInstrument?: {
      type: string;
      utr?: string;
    };
  };
}

// ============================================
// PHONEPE CONFIGURATION
// ============================================

const PHONEPE_MERCHANT_ID = env.PHONEPE_MERCHANT_ID ?? "";
const PHONEPE_SALT_KEY = env.PHONEPE_SALT_KEY ?? "";
const PHONEPE_SALT_INDEX = env.PHONEPE_SALT_INDEX ?? "1";
const PHONEPE_ENV = env.PHONEPE_ENV ?? "UAT"; // UAT or PRODUCTION

// PhonePe API base URLs
const PHONEPE_API_BASE = PHONEPE_ENV === "PRODUCTION"
  ? "https://api.phonepe.com/apis/hermes"
  : "https://api-preprod.phonepe.com/apis/pg-sandbox";

const FRONTEND_URL = env.FRONTEND_URL ?? "http://localhost:5173";
const BILLING_BYPASS_REQUESTED = process.env["TEMP_UNLOCK_ALL"] === "true";
// SAFE DEFAULT: BILLING_BYPASS is false when TEMP_UNLOCK_ALL env var is absent or not "true".
// This ensures production deployments are secure by default.
const BILLING_BYPASS = BILLING_BYPASS_REQUESTED && env.NODE_ENV !== "production";

const isPhonePeConfigured = !!(PHONEPE_MERCHANT_ID && PHONEPE_SALT_KEY);

if (isPhonePeConfigured) {
  log.info("PhonePe initialized", { env: PHONEPE_ENV, merchantId: PHONEPE_MERCHANT_ID.slice(0, 8) + "..." });
} else {
  log.warn("PhonePe not configured — payment features disabled", {
    hasMerchantId: !!PHONEPE_MERCHANT_ID,
    hasSaltKey: !!PHONEPE_SALT_KEY,
  });
}

if (BILLING_BYPASS_REQUESTED && env.NODE_ENV === "production") {
  log.warn("TEMP_UNLOCK_ALL was requested but is ignored in production");
} else if (BILLING_BYPASS) {
  log.warn("Billing bypass enabled (non-production only): payment verification disabled");
}

// ============================================
// IDEMPOTENCY & DEDUPLICATION
// ============================================

const idempotencyStore = new Map<string, { result: unknown; expiresAt: number }>();
const IDEMPOTENCY_TTL = 5 * 60 * 1000; // 5 minutes

function cleanIdempotencyStore() {
  const now = Date.now();
  for (const [key, val] of idempotencyStore) {
    if (val.expiresAt < now) idempotencyStore.delete(key);
  }
}

// ============================================
// PHONEPE CRYPTO HELPERS
// ============================================

/**
 * Generate X-VERIFY header for PhonePe API calls.
 * Formula: SHA256(base64EncodedPayload + endpoint + saltKey) + "###" + saltIndex
 */
function generateXVerify(base64Payload: string, endpoint: string): string {
  const dataToSign = base64Payload + endpoint + PHONEPE_SALT_KEY;
  const hash = createHmac("sha256", "")
    .update(dataToSign)
    .digest("hex");
  // PhonePe uses plain SHA256, not HMAC — let's use crypto.createHash instead
  const crypto = require("crypto");
  const sha256Hash = crypto.createHash("sha256").update(dataToSign).digest("hex");
  return sha256Hash + "###" + PHONEPE_SALT_INDEX;
}

/**
 * Verify webhook callback signature.
 * X-VERIFY = SHA256(response + saltKey) + "###" + saltIndex
 */
function verifyWebhookSignature(responseBody: string, xVerifyHeader: string): boolean {
  if (!PHONEPE_SALT_KEY) return false;
  const crypto = require("crypto");
  const expectedHash = crypto.createHash("sha256")
    .update(responseBody + PHONEPE_SALT_KEY)
    .digest("hex");
  const expected = expectedHash + "###" + PHONEPE_SALT_INDEX;
  return expected === xVerifyHeader;
}

/**
 * Verify status API callback.
 * X-VERIFY = SHA256("/pg/v1/status/{merchantId}/{merchantTransactionId}" + saltKey) + "###" + saltIndex
 */
function generateStatusXVerify(merchantTransactionId: string): string {
  const crypto = require("crypto");
  const endpoint = `/pg/v1/status/${PHONEPE_MERCHANT_ID}/${merchantTransactionId}`;
  const sha256Hash = crypto.createHash("sha256")
    .update(endpoint + PHONEPE_SALT_KEY)
    .digest("hex");
  return sha256Hash + "###" + PHONEPE_SALT_INDEX;
}

// ============================================
// PHONEPE BILLING SERVICE
// ============================================

export class PhonePeBillingService {
  /**
   * Initiate a PhonePe payment (Standard Checkout).
   * Returns the redirect URL for the user to complete payment.
   */
  static async initiatePayment(
    userId: string,
    email: string,
    planType: PlanType,
    planId: PlanId = "pro",
    checkoutPlanId?: string,
    idempotencyKey?: string,
  ): Promise<{
    merchantTransactionId: string;
    redirectUrl: string;
  }> {
    // Check idempotency
    if (idempotencyKey) {
      cleanIdempotencyStore();
      const cached = idempotencyStore.get(idempotencyKey);
      if (cached) {
        log.info("Idempotent hit", { idempotencyKey });
        return cached.result as { merchantTransactionId: string; redirectUrl: string };
      }
    }

    if (!isPhonePeConfigured) {
      throw new BillingError(
        "Payment gateway not configured",
        "PAYMENT_UNAVAILABLE",
        503,
        true,
      );
    }

    const plan = resolveCheckoutPlan({ planType, planId, checkoutPlanId });
    if (!plan) {
      throw new BillingError("Invalid plan type", "MISSING_FIELDS");
    }

    // Generate unique transaction ID
    const merchantTransactionId = `BL_${userId.slice(-8)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    // Build PhonePe Pay API payload
    const payload = {
      merchantId: PHONEPE_MERCHANT_ID,
      merchantTransactionId,
      merchantUserId: userId,
      amount: plan.amountPaise,
      redirectUrl: `${FRONTEND_URL}/payment/callback?txnId=${merchantTransactionId}`,
      redirectMode: "REDIRECT",
      callbackUrl: `${env.FRONTEND_URL?.replace('localhost:5173', 'localhost:3001')}/api/billing/webhooks/phonepe`,
      paymentInstrument: {
        type: "PAY_PAGE",
      },
    };

    const base64Payload = Buffer.from(JSON.stringify(payload)).toString("base64");
    const xVerify = generateXVerify(base64Payload, "/pg/v1/pay");

    try {
      const response = await fetch(`${PHONEPE_API_BASE}/pg/v1/pay`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerify,
        },
        body: JSON.stringify({ request: base64Payload }),
      });

      const result = (await response.json()) as PhonePePayResponse;

      if (!result.success || !result.data?.instrumentResponse?.redirectInfo?.url) {
        log.error("PhonePe pay API failed", {
          code: result.code,
          message: result.message,
          merchantTransactionId,
        });
        throw new BillingError(
          `Payment initiation failed: ${result.message}`,
          "ORDER_CREATION_FAILED",
          502,
          true,
        );
      }

      const redirectUrl = result.data.instrumentResponse.redirectInfo.url;
      const resultData = { merchantTransactionId, redirectUrl };

      // Store for idempotency
      if (idempotencyKey) {
        idempotencyStore.set(idempotencyKey, {
          result: resultData,
          expiresAt: Date.now() + IDEMPOTENCY_TTL,
        });
      }

      log.info("Payment initiated", {
        merchantTransactionId,
        planType: plan.billingCycle,
        planId: plan.planId,
        checkoutPlanId: plan.checkoutPlanId,
        amount: plan.amountPaise,
      });

      return resultData;
    } catch (err) {
      if (err instanceof BillingError) throw err;
      const msg = err instanceof Error ? err.message : "Unknown PhonePe error";
      log.error("PhonePe API call failed", { error: msg, planType });
      throw new BillingError(
        "Payment service temporarily unavailable",
        "ORDER_CREATION_FAILED",
        502,
        true,
      );
    }
  }

  /**
   * Check transaction status with PhonePe S2S API.
   */
  static async checkTransactionStatus(
    merchantTransactionId: string,
  ): Promise<PhonePeStatusResponse> {
    const xVerify = generateStatusXVerify(merchantTransactionId);

    const response = await fetch(
      `${PHONEPE_API_BASE}/pg/v1/status/${PHONEPE_MERCHANT_ID}/${merchantTransactionId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-VERIFY": xVerify,
          "X-MERCHANT-ID": PHONEPE_MERCHANT_ID,
        },
      },
    );

    return (await response.json()) as PhonePeStatusResponse;
  }

  /**
   * Activate a subscription after successful payment verification.
   */
  static async activateSubscription(
    userId: string,
    transactionId: string,
    merchantTransactionId: string,
    plan: BillingPlanConfig,
  ): Promise<void> {
    const targetTier = resolveTierFromPlanId(plan.planId);
    const USE_CLERK = isUsingClerk();

    // Resolve user
    const user = USE_CLERK
      ? await User.findOne({ clerkId: userId }).lean()
      : await UserModel.findById(userId).lean();

    if (!user) {
      throw new BillingError("User not found", "USER_NOT_FOUND", 404);
    }

    const duplicateTxSub = await Subscription.findOne({
      $or: [
        { phonepeTransactionId: transactionId },
        { phonepeMerchantTransactionId: merchantTransactionId },
      ],
    })
      .select('user phonepeTransactionId phonepeMerchantTransactionId')
      .lean();

    if (duplicateTxSub) {
      const duplicateUserId = String(duplicateTxSub.user);
      const currentUserId = String(user._id);
      if (duplicateUserId !== currentUserId) {
        throw new BillingError(
          'Transaction already linked to another account',
          'DUPLICATE_ORDER',
          409,
          false,
        );
      }
      log.info('Duplicate transaction activation skipped', {
        userId,
        transactionId,
        merchantTransactionId,
      });
      return;
    }

    // Guard against duplicate activation
    if (user.tier === "pro" || user.tier === "enterprise") {
      const existingSub = await Subscription.findOne({ user: user._id, status: "active" }).lean();
      if (existingSub?.phonepeTransactionId === transactionId) {
        log.info("Duplicate activation skipped", { userId, transactionId });
        return;
      }
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    // Upsert subscription
    const subscription = await Subscription.findOneAndUpdate(
      { user: user._id },
      {
        $set: {
          phonepeTransactionId: transactionId,
          phonepeMerchantTransactionId: merchantTransactionId,
          planType: plan.checkoutPlanId,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      },
      { upsert: true, new: true },
    );

    // Upgrade user tier
    const previousTier = (user.tier as string) ?? 'free';
    if (USE_CLERK) {
      await User.updateOne({ clerkId: userId }, { $set: { tier: targetTier, subscription: subscription._id } });
    } else {
      await UserModel.updateOne({ _id: userId }, { $set: { subscriptionTier: targetTier } });
    }

    // Write TierChangeLog audit record (Requirement 18.3)
    await logTierChange(
      user._id as import('mongoose').Types.ObjectId,
      previousTier,
      targetTier,
      'phonepe_webhook',
      transactionId,
    );

    log.info("Subscription activated", {
      userId,
      planType: plan.billingCycle,
      planId: plan.planId,
      checkoutPlanId: plan.checkoutPlanId,
      transactionId,
      expiresAt: periodEnd.toISOString(),
    });
  }

  /**
   * Handle PhonePe S2S webhook callback.
   */
  static async handleWebhook(
    payload: { response: string },
    requestId: string,
  ): Promise<{ processed: boolean; event?: string }> {
    // Decode the base64 response
    const decodedResponse = JSON.parse(
      Buffer.from(payload.response, "base64").toString("utf-8"),
    );

    const {
      merchantTransactionId,
      transactionId,
      code,
      amount,
    } = decodedResponse;

    // Dedup
    const eventKey = `${merchantTransactionId}_${transactionId}`;
    try {
      await PaymentWebhookEvent.create({
        gateway: "phonepe",
        eventKey,
        status: "processing",
        metadata: { requestId, merchantTransactionId, transactionId },
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        log.info("Webhook replay skipped", { eventKey, requestId });
        return { processed: false, event: "duplicate" };
      }
      throw err;
    }

    if (code !== "PAYMENT_SUCCESS") {
      log.warn("Non-success webhook", { code, merchantTransactionId, requestId });
      await PaymentWebhookEvent.updateOne(
        { gateway: "phonepe", eventKey },
        {
          $set: {
            status: "processed",
            metadata: {
              requestId,
              merchantTransactionId,
              transactionId,
              code,
            },
          },
        },
      );
      return { processed: true, event: code };
    }

    log.info("Processing webhook payment", {
      merchantTransactionId,
      transactionId,
      amount,
      requestId,
    });

    // Extract userId from merchantTransactionId (format: BL_{userId8chars}_{timestamp}_{random})
    // We need to find the user who initiated this transaction
    // Look up by merchantTransactionId in subscriptions
    const existingSub = await Subscription.findOne({
      phonepeMerchantTransactionId: merchantTransactionId,
    }).lean();

    if (existingSub) {
      // Already processed via verify-payment endpoint
      log.info("Webhook: subscription already active", { merchantTransactionId });
      await PaymentWebhookEvent.updateOne(
        { gateway: "phonepe", eventKey },
        { $set: { status: "processed" } },
      );
      return { processed: true, event: "already_active" };
    }

    // For webhook-only activation (user didn't return to frontend),
    // we need to find the user. The merchantTransactionId contains partial userId.
    // In production, store the mapping in a PendingPayment collection.
    log.warn("Webhook received for unmapped transaction — manual review may be needed", {
      merchantTransactionId,
      transactionId,
    });

    await PaymentWebhookEvent.updateOne(
      { gateway: "phonepe", eventKey },
      {
        $set: {
          status: "processed",
          metadata: {
            requestId,
            merchantTransactionId,
            transactionId,
            code,
            note: "unmapped_transaction_manual_review",
          },
        },
      },
    );

    return { processed: true, event: "PAYMENT_SUCCESS" };
  }
}

// ============================================
// EXPRESS ROUTER
// ============================================

export const billingRouter: IRouter = Router();

/**
 * POST /api/billing/initiate-payment
 * Initiate PhonePe payment and return redirect URL
 */
billingRouter.post(
  "/initiate-payment",
  requireAuth(),
  validateBody(billingInitiateSchema),
  async (req: Request, res: Response) => {
    const requestId = (req as Request & { requestId?: string }).requestId || "unknown";
    try {
      const { userId, email: authEmail } = getAuth(req);
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized", requestId });
        return;
      }

      const { email, planType, planId, checkoutPlanId } = req.body as {
        email: string;
        planType: PlanType;
        planId?: PlanId;
        checkoutPlanId?: string;
      };
      const userEmail = email || authEmail || "";

      // SECURITY: Warn if client attempts to pass amount — it is ignored.
      // Amount is always derived server-side from PLANS[checkoutPlanId].amountPaise.
      if ((req.body as Record<string, unknown>).amount !== undefined) {
        const resolvedPlan = resolveCheckoutPlan({ planType, planId, checkoutPlanId });
        const serverAmount = resolvedPlan?.amountPaise;
        const clientAmount = (req.body as Record<string, unknown>).amount;
        if (clientAmount !== serverAmount) {
          log.warn("Client-provided amount ignored — using server-derived amount", {
            clientAmount,
            serverAmount,
            requestId,
          });
        }
      }

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

      if (!isPhonePeConfigured) {
        res.status(503).json({
          success: false,
          message: "Payment gateway not configured. API keys pending.",
          code: "PAYMENT_UNAVAILABLE",
          requestId,
        });
        return;
      }

      const idempotencyKey = req.headers["x-idempotency-key"] as string | undefined;

      const result = await PhonePeBillingService.initiatePayment(
        userId,
        userEmail,
        planType as PlanType,
        (planId as PlanId | undefined) ?? "pro",
        checkoutPlanId as string | undefined,
        idempotencyKey,
      );

      res.json({
        success: true,
        requestId,
        data: result,
      });
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
      log.error("Initiate payment error", { error: (err as Error).message, requestId });
      res.status(500).json({ success: false, message: "Internal server error", requestId });
    }
  },
);

/**
 * POST /api/billing/create-order (backward compat alias)
 */
billingRouter.post(
  "/create-order",
  requireAuth(),
  validateBody(billingCreateOrderSchema),
  async (req: Request, res: Response) => {
    const requestId = (req as Request & { requestId?: string }).requestId || "unknown";
    try {
      const { userId, email: authEmail } = getAuth(req);
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized", requestId });
        return;
      }

      const { email, planType, planId, checkoutPlanId } = req.body as {
        email?: string;
        planType: PlanType;
        planId?: PlanId;
        checkoutPlanId?: string;
      };
      const userEmail = email || authEmail || "";

      if (!userEmail) {
        res.status(400).json({
          success: false,
          message: "Missing required email",
          requestId,
        });
        return;
      }

      if (BILLING_BYPASS) {
        res.json({
          success: true,
          requestId,
          data: {
            bypassed: true,
            tier: "enterprise",
            amount: 0,
            currency: "INR",
            message: "Billing bypass active: payment is not required.",
          },
        });
        return;
      }

      if (!isPhonePeConfigured) {
        res.status(503).json({
          success: false,
          message: "Payment gateway not configured. API keys pending.",
          code: "PAYMENT_UNAVAILABLE",
          requestId,
        });
        return;
      }

      const idempotencyKey = req.headers["x-idempotency-key"] as string | undefined;

      const result = await PhonePeBillingService.initiatePayment(
        userId,
        userEmail,
        planType as PlanType,
        (planId as PlanId | undefined) ?? "pro",
        checkoutPlanId as string | undefined,
        idempotencyKey,
      );

      const resolvedPlan = resolveCheckoutPlan({
        planType,
        planId,
        checkoutPlanId,
      });

      res.json({
        success: true,
        requestId,
        data: {
          merchantTransactionId: result.merchantTransactionId,
          redirectUrl: result.redirectUrl,
          // Backward compat shape
          amount: resolvedPlan?.amountPaise,
          currency: "INR",
        },
      });
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
      log.error("Create order error", { error: (err as Error).message, requestId });
      res.status(500).json({ success: false, message: "Internal server error", requestId });
    }
  },
);

/**
 * POST /api/billing/verify-payment
 * Verify a PhonePe payment via S2S status check and activate subscription
 */
billingRouter.post(
  "/verify-payment",
  requireAuth(),
  validateBody(billingVerifySchema),
  async (req: Request, res: Response) => {
    const requestId = (req as Request & { requestId?: string }).requestId || "unknown";
    try {
      const { userId } = getAuth(req);
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized", requestId });
        return;
      }

      const { merchantTransactionId, planType, planId, checkoutPlanId } = req.body as {
        merchantTransactionId: string;
        planType?: PlanType;
        planId?: PlanId;
        checkoutPlanId?: string;
      };

      if (BILLING_BYPASS) {
        res.json({
          success: true,
          message: "Billing bypass active. Pro features unlocked.",
          requestId,
          data: {
            tier: "enterprise",
            bypassed: true,
            planType: (planType as PlanType) || "monthly",
            transactionId: merchantTransactionId || "BYPASS",
          },
        });
        return;
      }

      // Check transaction status with PhonePe
      const statusResult = await PhonePeBillingService.checkTransactionStatus(merchantTransactionId);

      if (!statusResult.success || statusResult.data?.state !== "COMPLETED") {
        const state = statusResult.data?.state || "UNKNOWN";
        log.warn("Payment not completed", { merchantTransactionId, state, requestId });
        res.status(402).json({
          success: false,
          message: `Payment ${state.toLowerCase()}. Please try again.`,
          code: "VERIFICATION_FAILED",
          state,
          requestId,
        });
        return;
      }

      // Payment confirmed — activate subscription
      const resolvedPlan = resolveCheckoutPlan({
        planType,
        planId,
        checkoutPlanId,
      }) || resolveCheckoutPlan({ planType: "monthly", planId: "pro" });

      if (!resolvedPlan) {
        res.status(400).json({
          success: false,
          message: "Invalid plan configuration",
          requestId,
        });
        return;
      }

      await PhonePeBillingService.activateSubscription(
        userId,
        statusResult.data.transactionId,
        merchantTransactionId,
        resolvedPlan,
      );

      log.info("Payment verified and subscription activated", {
        userId,
        merchantTransactionId,
        transactionId: statusResult.data.transactionId,
        requestId,
      });

      res.json({
        success: true,
        message: `Payment verified! Welcome to ${resolvedPlan.planId === 'business' ? 'Enterprise' : 'Pro'}.`,
        requestId,
        data: {
          tier: resolveTierFromPlanId(resolvedPlan.planId),
          planType: resolvedPlan.billingCycle,
          planId: resolvedPlan.planId,
          checkoutPlanId: resolvedPlan.checkoutPlanId,
          transactionId: statusResult.data.transactionId,
        },
      });
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
      log.error("Verify payment error", { error: (err as Error).message, requestId });
      res.status(500).json({ success: false, message: "Internal server error", requestId });
    }
  },
);

/**
 * POST /api/billing/webhooks/phonepe
 * PhonePe S2S callback (server-to-server payment confirmation)
 */
billingRouter.post(
  "/webhooks/phonepe",
  async (req: Request, res: Response) => {
    const requestId = (req as Request & { requestId?: string }).requestId || "unknown";
    try {
      const xVerify = req.headers["x-verify"] as string;
      const body = req.body;

      if (!xVerify || !body?.response) {
        res.status(400).json({ message: "Missing X-VERIFY header or response payload" });
        return;
      }

      // Verify webhook signature
      const isValid = verifyWebhookSignature(body.response, xVerify);
      if (!isValid) {
        log.warn("Invalid webhook signature", { requestId });
        res.status(401).json({ message: "Invalid signature" });
        return;
      }

      const result = await PhonePeBillingService.handleWebhook(body, requestId);

      // Always return 200 to prevent PhonePe from retrying on app errors
      res.json({ success: true, ...result });
    } catch (err) {
      log.error("Webhook handler error", { error: (err as Error).message, requestId });
      // Return 200 to prevent retries
      res.json({ success: false, error: "Internal processing error" });
    }
  },
);

/**
 * GET /api/billing/status
 * Get current user's subscription status
 */
billingRouter.get(
  "/status",
  requireAuth(),
  async (req: Request, res: Response) => {
    const requestId = (req as Request & { requestId?: string }).requestId || "unknown";
    try {
      const { userId } = getAuth(req);
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized", requestId });
        return;
      }

      const USE_CLERK = isUsingClerk();
      const user = USE_CLERK
        ? await User.findOne({ clerkId: userId }).lean()
        : await UserModel.findById(userId).lean();

      if (!user) {
        res.json({
          success: true,
          requestId,
          data: {
            tier: BILLING_BYPASS ? "enterprise" : "free",
            active: BILLING_BYPASS,
            daysRemaining: null,
            bypassed: BILLING_BYPASS,
          },
        });
        return;
      }

      if (BILLING_BYPASS) {
        res.json({
          success: true,
          requestId,
          data: {
            tier: "enterprise",
            active: true,
            daysRemaining: null,
            cancelAtPeriodEnd: false,
            bypassed: true,
          },
        });
        return;
      }

      const subscription = await Subscription.findOne({
        user: user._id,
        status: "active",
      }).lean();

      if (!subscription) {
        res.json({
          success: true,
          requestId,
          data: { tier: user.tier || "free", active: false, daysRemaining: null },
        });
        return;
      }

      // Check expiry
      const now = new Date();
      const periodEnd = subscription.currentPeriodEnd
        ? new Date(subscription.currentPeriodEnd)
        : null;

      if (periodEnd && periodEnd < now) {
        // Expired — downgrade
        subscription.status = "expired";
        await subscription.save();
        const previousTier = (user.tier as string) ?? 'pro';
        user.tier = "free";
        await user.save();
        // Write TierChangeLog audit record for expiry (Requirement 18.3)
        await logTierChange(
          user._id as import('mongoose').Types.ObjectId,
          previousTier,
          'free',
          'expiry',
        );
        log.info("Subscription expired, downgraded", { userId });

        res.json({
          success: true,
          requestId,
          data: { tier: "free", active: false, daysRemaining: 0 },
        });
        return;
      }

      const daysRemaining = periodEnd
        ? Math.ceil((periodEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : null;

      res.json({
        success: true,
        requestId,
        data: {
          tier: user.tier || "pro",
          active: true,
          planType: subscription.planType,
          expiresAt: periodEnd?.toISOString(),
          daysRemaining,
          cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        },
      });
    } catch (err) {
      log.error("Status error", { error: (err as Error).message, requestId });
      res.status(500).json({ success: false, message: "Internal server error", requestId });
    }
  },
);

/**
 * GET /api/billing/plans
 * Available pricing plans
 */
billingRouter.get("/plans", (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      plans: [
        {
          id: "pro_monthly",
          name: PLANS.pro_monthly.label,
          price: PLANS.pro_monthly.amountPaise,
          currency: "INR",
          displayPrice: PLANS.pro_monthly.displayPrice,
          interval: "month",
          features: [
            "Unlimited projects",
            "Advanced analysis",
            "All design codes (IS 456, IS 800, IS 1893)",
            "PDF reports",
            "AI design assistant",
            "Priority support",
          ],
        },
        {
          id: "pro_yearly",
          name: PLANS.pro_yearly.label,
          price: PLANS.pro_yearly.amountPaise,
          currency: "INR",
          displayPrice: PLANS.pro_yearly.displayPrice,
          interval: "year",
          savings: "Save 17%",
          features: [
            "Everything in Pro Monthly",
            "2 months free",
            "Locked-in pricing",
          ],
        },
        {
          id: "business_monthly",
          name: PLANS.business_monthly.label,
          price: PLANS.business_monthly.amountPaise,
          currency: "INR",
          displayPrice: PLANS.business_monthly.displayPrice,
          interval: "month",
          features: [
            "Everything in Pro",
            "Team collaboration",
            "Admin dashboard",
            "Priority support",
          ],
        },
        {
          id: "business_yearly",
          name: PLANS.business_yearly.label,
          price: PLANS.business_yearly.amountPaise,
          currency: "INR",
          displayPrice: PLANS.business_yearly.displayPrice,
          interval: "year",
          savings: "Save 17%",
          features: [
            "Everything in Business Monthly",
            "Annual billing discount",
          ],
        },
      ],
      gateway: "phonepe",
      paymentEnabled: isPhonePeConfigured && !BILLING_BYPASS,
      bypassed: BILLING_BYPASS,
    },
  });
});

/**
 * GET /api/billing/transaction-status/:txnId
 * Check PhonePe transaction status (for frontend polling after redirect)
 */
billingRouter.get(
  "/transaction-status/:txnId",
  requireAuth(),
  async (req: Request, res: Response) => {
    const requestId = (req as Request & { requestId?: string }).requestId || "unknown";
    try {
      const { userId } = getAuth(req);
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized", requestId });
        return;
      }

      const { txnId } = req.params;
      if (!txnId) {
        res.status(400).json({ success: false, message: "Missing txnId", requestId });
        return;
      }

      if (BILLING_BYPASS) {
        res.json({
          success: true,
          requestId,
          data: {
            state: "COMPLETED",
            transactionId: txnId,
            amount: 0,
            responseCode: "BYPASS",
            bypassed: true,
          },
        });
        return;
      }

      if (!isPhonePeConfigured) {
        res.status(503).json({
          success: false,
          message: "Payment gateway not configured",
          requestId,
        });
        return;
      }

      const statusResult = await PhonePeBillingService.checkTransactionStatus(txnId);

      res.json({
        success: true,
        requestId,
        data: {
          state: statusResult.data?.state || "UNKNOWN",
          transactionId: statusResult.data?.transactionId,
          amount: statusResult.data?.amount,
          responseCode: statusResult.data?.responseCode,
        },
      });
    } catch (err) {
      log.error("Transaction status error", { error: (err as Error).message, requestId });
      res.status(500).json({ success: false, message: "Internal server error", requestId });
    }
  },
);

export default PhonePeBillingService;
