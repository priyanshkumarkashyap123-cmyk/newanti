import * as crypto from "crypto";
import express, { Router } from "express";
import { User, Subscription } from "./models.js";
import { createRequire } from "module";
import { env } from "./config/env.js";
const require2 = createRequire(import.meta.url);
const Razorpay = require2("razorpay");
const RAZORPAY_KEY_ID = env.RAZORPAY_KEY_ID ?? "";
const RAZORPAY_KEY_SECRET = env.RAZORPAY_KEY_SECRET ?? "";
const RAZORPAY_WEBHOOK_SECRET = env.RAZORPAY_WEBHOOK_SECRET ?? "";
let razorpay = null;
if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET
  });
  console.log("\u2705 Razorpay initialized (Orders mode)");
} else {
  console.warn("\u26A0\uFE0F Missing Razorpay credentials - payment features disabled");
}
const PRICING = {
  PRO_MONTHLY: {
    amount: 99900,
    // ₹999
    currency: "INR",
    description: "BeamLab Pro - Monthly",
    durationDays: 30
  },
  PRO_YEARLY: {
    amount: 999900,
    // ₹9,999
    currency: "INR",
    description: "BeamLab Pro - Annual",
    durationDays: 365
  }
};
class RazorpayBillingService {
  /**
   * Create a Razorpay order for a one-time payment
   */
  static async createOrder(userId, email, planType = "monthly") {
    let user = await User.findOne({ clerkId: userId });
    if (!user) {
      user = await User.create({
        clerkId: userId,
        email,
        tier: "free"
      });
    }
    if (!razorpay) {
      console.warn("\u26A0\uFE0F Razorpay not configured - returning 503");
      throw new Error("PAYMENT_SERVICE_UNAVAILABLE");
    }
    const pricing = planType === "yearly" ? PRICING.PRO_YEARLY : PRICING.PRO_MONTHLY;
    const order = await razorpay.orders.create({
      amount: pricing.amount,
      currency: pricing.currency,
      receipt: `beamlab_${userId}_${Date.now()}`,
      notes: {
        userId,
        email,
        planType,
        description: pricing.description
      }
    });
    console.log(
      `\u2705 Razorpay order created: ${order.id} for user ${userId} (${planType})`
    );
    return {
      orderId: order.id,
      amount: pricing.amount,
      currency: pricing.currency,
      keyId: RAZORPAY_KEY_ID
    };
  }
  /**
   * Verify Razorpay payment signature (order flow)
   * Signature = HMAC-SHA256(order_id + "|" + payment_id, key_secret)
   */
  static verifyPaymentSignature(orderId, paymentId, signature) {
    const body = orderId + "|" + paymentId;
    const expectedSignature = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(body).digest("hex");
    return expectedSignature === signature;
  }
  /**
   * Verify webhook signature (HMAC-SHA256)
   */
  static verifyWebhookSignature(body, signature) {
    if (!RAZORPAY_WEBHOOK_SECRET) {
      console.warn(
        "\u26A0\uFE0F RAZORPAY_WEBHOOK_SECRET not set, skipping webhook verification"
      );
      return false;
    }
    const expectedSignature = crypto.createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");
    return expectedSignature === signature;
  }
  /**
   * Activate user subscription after payment verification
   */
  static async activateSubscription(userId, paymentId, orderId, planType = "monthly") {
    const user = await User.findOne({ clerkId: userId });
    if (!user) {
      throw new Error("USER_NOT_FOUND");
    }
    const pricing = planType === "yearly" ? PRICING.PRO_YEARLY : PRICING.PRO_MONTHLY;
    const now = /* @__PURE__ */ new Date();
    const periodEnd = new Date(
      now.getTime() + pricing.durationDays * 24 * 60 * 60 * 1e3
    );
    await Subscription.findOneAndUpdate(
      { user: user._id },
      {
        razorpayPaymentId: paymentId,
        razorpayOrderId: orderId,
        planType,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false
      },
      { upsert: true, new: true }
    );
    user.tier = "pro";
    await user.save();
    console.log(
      `\u2705 User ${userId} upgraded to PRO (${planType}) until ${periodEnd.toISOString()}`
    );
  }
  /**
   * Handle webhook events
   */
  static async handleWebhook(event, payload) {
    console.log(`\u{1F4E9} Razorpay webhook: ${event}`);
    switch (event) {
      case "payment.captured": {
        const payment = payload.payment?.entity;
        if (!payment?.id || !payment?.order_id) {
          return { success: false, message: "Missing payment/order info" };
        }
        const notes = payment.notes || {};
        const userId = notes.userId;
        const planType = notes.planType || "monthly";
        if (userId) {
          await this.activateSubscription(
            userId,
            payment.id,
            payment.order_id,
            planType
          );
          return {
            success: true,
            message: "Payment captured and user upgraded"
          };
        }
        return {
          success: true,
          message: "Payment captured (no userId in notes)"
        };
      }
      case "payment.failed": {
        const payment = payload.payment?.entity;
        console.log(
          `\u26A0\uFE0F Payment failed: ${payment?.id} for order ${payment?.order_id}`
        );
        return { success: true, message: "Payment failure recorded" };
      }
      case "order.paid": {
        const order = payload.order?.entity;
        const notes = order?.notes || {};
        const userId = notes.userId;
        const planType = notes.planType || "monthly";
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
import { requireAuth, getAuth } from "./middleware/authMiddleware.js";
const razorpayRouter = Router();
razorpayRouter.post(
  "/create-order",
  requireAuth(),
  async (req, res) => {
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
          message: "Payment service is currently unavailable. Please try again later."
        });
        return;
      }
      const result = await RazorpayBillingService.createOrder(
        userId,
        email,
        planType
      );
      res.json({
        success: true,
        orderId: result.orderId,
        amount: result.amount,
        currency: result.currency,
        keyId: result.keyId
      });
    } catch (error) {
      console.error("Create order error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      if (message === "PAYMENT_SERVICE_UNAVAILABLE") {
        res.status(503).json({
          success: false,
          message: "Payment service is currently unavailable. Please try again later."
        });
        return;
      }
      res.status(500).json({ success: false, message });
    }
  }
);
razorpayRouter.post(
  "/create-subscription",
  requireAuth(),
  async (req, res) => {
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
          message: "Payment service is currently unavailable. Please try again later."
        });
        return;
      }
      const result = await RazorpayBillingService.createOrder(
        userId,
        email,
        planType
      );
      res.json({
        success: true,
        subscriptionId: result.orderId,
        orderId: result.orderId,
        amount: result.amount,
        currency: result.currency,
        keyId: result.keyId
      });
    } catch (error) {
      console.error("Create subscription/order error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, message });
    }
  }
);
razorpayRouter.post(
  "/verify-payment",
  requireAuth(),
  async (req, res) => {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        planType = "monthly"
      } = req.body;
      const { userId } = getAuth(req);
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        res.status(400).json({
          success: false,
          message: "Missing payment details (order_id, payment_id, signature)"
        });
        return;
      }
      const isValid = RazorpayBillingService.verifyPaymentSignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );
      if (!isValid) {
        res.status(400).json({ success: false, message: "Invalid payment signature" });
        return;
      }
      await RazorpayBillingService.activateSubscription(
        userId,
        razorpay_payment_id,
        razorpay_order_id,
        planType
      );
      res.json({
        success: true,
        message: "Payment verified and account upgraded to Pro!"
      });
    } catch (error) {
      console.error("Verify payment error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ success: false, message });
    }
  }
);
razorpayRouter.post(
  "/webhooks/razorpay",
  // Use express.raw() to get the exact raw body bytes for HMAC signature verification.
  // Without this, JSON.stringify(req.body) may produce different byte ordering than what Razorpay signed.
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const signature = req.headers["x-razorpay-signature"];
    if (!signature) {
      res.status(400).json({ message: "Missing x-razorpay-signature header" });
      return;
    }
    try {
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf8") : typeof req.body === "string" ? req.body : JSON.stringify(req.body);
      const isValid = RazorpayBillingService.verifyWebhookSignature(
        rawBody,
        signature
      );
      if (!isValid) {
        res.status(400).json({ message: "Invalid webhook signature" });
        return;
      }
      const payload = JSON.parse(rawBody);
      const event = payload.event;
      const result = await RazorpayBillingService.handleWebhook(
        event,
        payload.payload
      );
      res.json(result);
    } catch (error) {
      console.error("Webhook error:", error);
      const message = error instanceof Error ? error.message : "Unknown error";
      res.status(400).json({ message });
    }
  }
);
razorpayRouter.get(
  "/status",
  requireAuth(),
  async (req, res) => {
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
            active: false
          }
        });
        return;
      }
      res.json({
        success: true,
        data: {
          tier: user.tier || "free",
          active: true,
          expiresAt: subscription.currentPeriodEnd,
          planType: subscription.planType || "monthly"
        }
      });
    } catch (error) {
      console.error("Get billing status error:", error);
      res.status(500).json({ success: false, message: "Internal error" });
    }
  }
);
var razorpay_default = RazorpayBillingService;
export {
  RazorpayBillingService,
  razorpay_default as default,
  razorpayRouter
};
//# sourceMappingURL=razorpay.js.map
