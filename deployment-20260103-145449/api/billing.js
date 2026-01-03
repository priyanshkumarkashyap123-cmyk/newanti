import Stripe from "stripe";
import { Router } from "express";
import { User, Subscription } from "./models.js";
const STRIPE_SECRET_KEY = process.env["STRIPE_SECRET_KEY"] ?? "";
const STRIPE_WEBHOOK_SECRET = process.env["STRIPE_WEBHOOK_SECRET"] ?? "";
const FRONTEND_URL = process.env["FRONTEND_URL"] ?? "http://localhost:5173";
if (!STRIPE_SECRET_KEY) {
  console.warn("\u26A0\uFE0F Missing STRIPE_SECRET_KEY environment variable");
}
const stripe = new Stripe(STRIPE_SECRET_KEY);
const PRICES = {
  PRO_MONTHLY: process.env["STRIPE_PRO_MONTHLY_PRICE_ID"] ?? "price_xxx",
  PRO_YEARLY: process.env["STRIPE_PRO_YEARLY_PRICE_ID"] ?? "price_yyy",
  ENTERPRISE_MONTHLY: process.env["STRIPE_ENTERPRISE_MONTHLY_PRICE_ID"] ?? "price_zzz"
};
class BillingService {
  /**
   * Create a Stripe checkout session
   */
  static async createCheckoutSession(userId, email, priceId, successUrl, cancelUrl) {
    let user = await User.findOne({ clerkId: userId });
    let customerId;
    if (user?.subscription) {
      const subscription = await Subscription.findById(user.subscription);
      customerId = subscription?.stripeCustomerId ?? "";
    }
    if (!customerId) {
      const customer = await stripe.customers.create({
        email,
        metadata: { clerkId: userId }
      });
      customerId = customer.id;
    }
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      success_url: successUrl ?? `${FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl ?? `${FRONTEND_URL}/billing/canceled`,
      metadata: {
        clerkId: userId
      },
      subscription_data: {
        metadata: {
          clerkId: userId
        }
      }
    });
    return session;
  }
  /**
   * Handle Stripe webhook events
   */
  static async handleWebhook(payload, signature) {
    let event;
    try {
      event = stripe.webhooks.constructEvent(
        payload,
        signature,
        STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error("Webhook signature verification failed:", err);
      throw new Error("Invalid webhook signature");
    }
    switch (event.type) {
      case "checkout.session.completed":
        await this.handleCheckoutComplete(event.data.object);
        break;
      case "invoice.payment_succeeded":
        await this.handlePaymentSuccess(event.data.object);
        break;
      case "invoice.payment_failed":
        await this.handlePaymentFailed(event.data.object);
        break;
      case "customer.subscription.updated":
        await this.handleSubscriptionUpdate(event.data.object);
        break;
      case "customer.subscription.deleted":
        await this.handleSubscriptionCanceled(event.data.object);
        break;
    }
    return { received: true, event: event.type };
  }
  /**
   * Handle checkout session completion
   */
  static async handleCheckoutComplete(session) {
    const clerkId = session.metadata?.["clerkId"];
    if (!clerkId) return;
    const user = await User.findOne({ clerkId });
    if (!user) return;
    const subscription = await Subscription.findOneAndUpdate(
      { user: user._id },
      {
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        status: "active"
      },
      { upsert: true, new: true }
    );
    user.subscription = subscription._id;
    user.tier = "pro";
    await user.save();
    console.log(`\u2705 User ${clerkId} upgraded to PRO`);
  }
  /**
   * Handle successful payment - UPDATE TIER TO PRO
   */
  static async handlePaymentSuccess(invoice) {
    const customerId = invoice.customer;
    const subscription = await Subscription.findOne({ stripeCustomerId: customerId });
    if (!subscription) return;
    subscription.status = "active";
    if (invoice.lines.data[0]?.period) {
      subscription.currentPeriodStart = new Date(invoice.lines.data[0].period.start * 1e3);
      subscription.currentPeriodEnd = new Date(invoice.lines.data[0].period.end * 1e3);
    }
    await subscription.save();
    const user = await User.findById(subscription.user);
    if (user && user.tier !== "enterprise") {
      user.tier = "pro";
      await user.save();
      console.log(`\u2705 Payment succeeded for user ${user.clerkId}, tier set to PRO`);
    }
  }
  /**
   * Handle failed payment
   */
  static async handlePaymentFailed(invoice) {
    const customerId = invoice.customer;
    const subscription = await Subscription.findOne({ stripeCustomerId: customerId });
    if (!subscription) return;
    subscription.status = "past_due";
    await subscription.save();
    console.log(`\u26A0\uFE0F Payment failed for customer ${customerId}`);
  }
  /**
   * Handle subscription update
   */
  static async handleSubscriptionUpdate(stripeSub) {
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: stripeSub.id
    });
    if (!subscription) return;
    const stripeData = stripeSub;
    subscription.status = stripeData.status;
    subscription.cancelAtPeriodEnd = stripeData.cancel_at_period_end;
    if (stripeData.current_period_end) {
      subscription.currentPeriodEnd = new Date(stripeData.current_period_end * 1e3);
    }
    await subscription.save();
  }
  /**
   * Handle subscription cancellation
   */
  static async handleSubscriptionCanceled(stripeSub) {
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: stripeSub.id
    });
    if (!subscription) return;
    subscription.status = "canceled";
    await subscription.save();
    const user = await User.findById(subscription.user);
    if (user) {
      user.tier = "free";
      await user.save();
      console.log(`\u{1F4E4} User ${user.clerkId} downgraded to FREE`);
    }
  }
  /**
   * Get customer portal URL
   */
  static async createPortalSession(customerId) {
    return stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${FRONTEND_URL}/settings`
    });
  }
}
const billingRouter = Router();
billingRouter.post("/checkout", async (req, res) => {
  try {
    const { userId, email, priceId, plan } = req.body;
    if (!userId || !email) {
      res.status(400).json({ success: false, message: "Missing userId or email" });
      return;
    }
    const selectedPriceId = priceId ?? (plan === "yearly" ? PRICES.PRO_YEARLY : PRICES.PRO_MONTHLY);
    const session = await BillingService.createCheckoutSession(
      userId,
      email,
      selectedPriceId
    );
    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error("Checkout error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, message });
  }
});
billingRouter.post("/webhook", async (req, res) => {
  const signature = req.headers["stripe-signature"];
  if (!signature) {
    res.status(400).json({ message: "Missing stripe-signature header" });
    return;
  }
  try {
    const result = await BillingService.handleWebhook(
      req.body,
      signature
    );
    res.json(result);
  } catch (error) {
    console.error("Webhook error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(400).json({ message });
  }
});
billingRouter.post("/portal", async (req, res) => {
  try {
    const { userId } = req.body;
    const user = await User.findOne({ clerkId: userId }).populate("subscription");
    if (!user?.subscription) {
      res.status(404).json({ success: false, message: "No subscription found" });
      return;
    }
    const subscription = await Subscription.findById(user.subscription);
    if (!subscription) {
      res.status(404).json({ success: false, message: "Subscription not found" });
      return;
    }
    const session = await BillingService.createPortalSession(subscription.stripeCustomerId);
    res.json({
      success: true,
      url: session.url
    });
  } catch (error) {
    console.error("Portal error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ success: false, message });
  }
});
var billing_default = BillingService;
export {
  BillingService,
  billingRouter,
  billing_default as default
};
//# sourceMappingURL=billing.js.map
