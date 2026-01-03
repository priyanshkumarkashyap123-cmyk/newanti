import * as crypto from "crypto";
import { Router } from "express";
import { User, Subscription } from "./models.js";
import { createRequire } from "module";
const require2 = createRequire(import.meta.url);
const Razorpay = require2("razorpay");
const RAZORPAY_KEY_ID = process.env["RAZORPAY_KEY_ID"] ?? "";
const RAZORPAY_KEY_SECRET = process.env["RAZORPAY_KEY_SECRET"] ?? "";
const RAZORPAY_WEBHOOK_SECRET = process.env["RAZORPAY_WEBHOOK_SECRET"] ?? "";
let razorpay = null;
if (RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
  razorpay = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET
  });
  console.log("\u2705 Razorpay initialized");
} else {
  console.warn("\u26A0\uFE0F Missing Razorpay credentials - payment features disabled");
}
const PLANS = {
  PRO_MONTHLY: process.env["RAZORPAY_PRO_MONTHLY_PLAN_ID"] ?? "plan_xxx",
  PRO_YEARLY: process.env["RAZORPAY_PRO_YEARLY_PLAN_ID"] ?? "plan_yyy",
  ENTERPRISE_MONTHLY: process.env["RAZORPAY_ENTERPRISE_MONTHLY_PLAN_ID"] ?? "plan_zzz"
};
class RazorpayBillingService {
  /**
   * Create a Razorpay subscription
   */
  static async createSubscription(userId, email, planId, planType = "monthly") {
    let user = await User.findOne({ clerkId: userId });
    if (!user) {
      user = await User.create({
        clerkId: userId,
        email,
        tier: "free"
      });
    }
    const selectedPlanId = planId ?? (planType === "yearly" ? PLANS.PRO_YEARLY : PLANS.PRO_MONTHLY);
    if (!razorpay) {
      throw new Error("Razorpay is not configured. Please set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET environment variables.");
    }
    const subscription = await razorpay.subscriptions.create({
      plan_id: selectedPlanId,
      total_count: planType === "yearly" ? 1 : 12,
      customer_notify: 1,
      notes: {
        userId,
        email
      }
    });
    await Subscription.findOneAndUpdate(
      { user: user._id },
      {
        stripeCustomerId: subscription.id,
        // Reusing field for Razorpay
        stripeSubscriptionId: subscription.id,
        status: "incomplete"
      },
      { upsert: true, new: true }
    );
    return {
      subscriptionId: subscription.id,
      shortUrl: subscription.short_url
    };
  }
  /**
   * Verify Razorpay payment signature
   */
  static verifyPaymentSignature(paymentId, subscriptionId, signature) {
    const body = paymentId + "|" + subscriptionId;
    const expectedSignature = crypto.createHmac("sha256", RAZORPAY_KEY_SECRET).update(body).digest("hex");
    return expectedSignature === signature;
  }
  /**
   * Verify webhook signature (HMAC-SHA256)
   */
  static verifyWebhookSignature(body, signature) {
    const expectedSignature = crypto.createHmac("sha256", RAZORPAY_WEBHOOK_SECRET).update(body).digest("hex");
    return expectedSignature === signature;
  }
  /**
   * Handle webhook events
   */
  static async handleWebhook(event, payload) {
    console.log(`\u{1F4E9} Razorpay webhook: ${event}`);
    switch (event) {
      case "subscription.charged":
        await this.handleSubscriptionCharged(payload);
        return { success: true, message: "Subscription charged processed" };
      case "subscription.activated":
        await this.handleSubscriptionActivated(payload);
        return { success: true, message: "Subscription activated" };
      case "subscription.completed":
        await this.handleSubscriptionCompleted(payload);
        return { success: true, message: "Subscription completed" };
      case "subscription.cancelled":
        await this.handleSubscriptionCancelled(payload);
        return { success: true, message: "Subscription cancelled" };
      case "payment.failed":
        await this.handlePaymentFailed(payload);
        return { success: true, message: "Payment failure recorded" };
      default:
        return { success: true, message: `Unhandled event: ${event}` };
    }
  }
  /**
   * Handle subscription.charged - UPDATE USER TO PRO
   */
  static async handleSubscriptionCharged(payload) {
    const subscriptionId = payload.subscription?.entity?.id;
    if (!subscriptionId) return;
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: subscriptionId
    });
    if (!subscription) {
      console.log(`Subscription ${subscriptionId} not found in database`);
      return;
    }
    subscription.status = "active";
    if (payload.subscription?.entity?.current_end) {
      subscription.currentPeriodEnd = new Date(payload.subscription.entity.current_end * 1e3);
    }
    await subscription.save();
    const user = await User.findById(subscription.user);
    if (user) {
      user.tier = "pro";
      await user.save();
      console.log(`\u2705 User ${user.clerkId} upgraded to PRO via Razorpay`);
    }
  }
  /**
   * Handle subscription activated
   */
  static async handleSubscriptionActivated(payload) {
    const subscriptionId = payload.subscription?.entity?.id;
    if (!subscriptionId) return;
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: subscriptionId
    });
    if (!subscription) return;
    subscription.status = "active";
    await subscription.save();
  }
  /**
   * Handle subscription completed
   */
  static async handleSubscriptionCompleted(payload) {
    const subscriptionId = payload.subscription?.entity?.id;
    if (!subscriptionId) return;
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: subscriptionId
    });
    if (!subscription) return;
    subscription.status = "canceled";
    await subscription.save();
    const user = await User.findById(subscription.user);
    if (user) {
      user.tier = "free";
      await user.save();
      console.log(`\u{1F4E4} User ${user.clerkId} subscription completed, downgraded to FREE`);
    }
  }
  /**
   * Handle subscription cancelled
   */
  static async handleSubscriptionCancelled(payload) {
    const subscriptionId = payload.subscription?.entity?.id;
    if (!subscriptionId) return;
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: subscriptionId
    });
    if (!subscription) return;
    subscription.status = "canceled";
    await subscription.save();
    const user = await User.findById(subscription.user);
    if (user) {
      user.tier = "free";
      await user.save();
      console.log(`\u{1F4E4} User ${user.clerkId} subscription cancelled`);
    }
  }
  /**
   * Handle payment failed
   */
  static async handlePaymentFailed(payload) {
    const subscriptionId = payload.subscription?.entity?.id;
    if (!subscriptionId) return;
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: subscriptionId
    });
    if (!subscription) return;
    subscription.status = "past_due";
    await subscription.save();
    console.log(`\u26A0\uFE0F Payment failed for subscription ${subscriptionId}`);
  }
}
import { requireAuth, getAuth } from "./middleware/authMiddleware.js";
const razorpayRouter = Router();
razorpayRouter.post("/create-subscription", requireAuth(), async (req, res) => {
  try {
    const { email, planId, planType } = req.body;
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    if (!email) {
      res.status(400).json({ success: false, message: "Missing email" });
      return;
    }
    const result = await RazorpayBillingService.createSubscription(
      userId,
      email,
      planId,
      planType
    );
    res.json({
      success: true,
      subscriptionId: result.subscriptionId,
      shortUrl: result.shortUrl,
      keyId: RAZORPAY_KEY_ID
      // Frontend needs this to open checkout
    });
  } catch (error) {
    console.error("Create subscription error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, message });
  }
});
razorpayRouter.post("/verify-payment", requireAuth(), async (req, res) => {
  try {
    const { razorpay_payment_id, razorpay_subscription_id, razorpay_signature } = req.body;
    const { userId } = getAuth(req);
    if (!userId) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    if (!razorpay_payment_id || !razorpay_subscription_id || !razorpay_signature) {
      res.status(400).json({ success: false, message: "Missing payment details" });
      return;
    }
    const isValid = RazorpayBillingService.verifyPaymentSignature(
      razorpay_payment_id,
      razorpay_subscription_id,
      razorpay_signature
    );
    if (!isValid) {
      res.status(400).json({ success: false, message: "Invalid signature" });
      return;
    }
    if (userId) {
      const user = await User.findOne({ clerkId: userId });
      if (user) {
        user.tier = "pro";
        await user.save();
      }
    }
    res.json({ success: true, message: "Payment verified successfully" });
  } catch (error) {
    console.error("Verify payment error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, message });
  }
});
razorpayRouter.post("/webhooks/razorpay", async (req, res) => {
  const signature = req.headers["x-razorpay-signature"];
  if (!signature) {
    res.status(400).json({ message: "Missing x-razorpay-signature header" });
    return;
  }
  try {
    const body = typeof req.body === "string" ? req.body : JSON.stringify(req.body);
    const isValid = RazorpayBillingService.verifyWebhookSignature(body, signature);
    if (!isValid) {
      res.status(400).json({ message: "Invalid webhook signature" });
      return;
    }
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const event = payload.event;
    const result = await RazorpayBillingService.handleWebhook(event, payload.payload);
    res.json(result);
  } catch (error) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ message });
  }
});
var razorpay_default = RazorpayBillingService;
export {
  RazorpayBillingService,
  razorpay_default as default,
  razorpayRouter
};
//# sourceMappingURL=razorpay.js.map
