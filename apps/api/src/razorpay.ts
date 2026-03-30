import Razorpay from "razorpay";
import crypto from "crypto";
import { Router, Request, Response, type IRouter } from "express";
import { requireAuth, getAuth, isUsingClerk } from "./middleware/authMiddleware.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { resolvePlan, resolveTierFromPlanId, type BillingPlanConfig } from "./utils/billingConfig.js";
import { PaymentWebhookEvent, Subscription, User, UserModel } from "./models.js";
import { logTierChange, type TierChangeReason } from "./utils/tierChangeLog.js";

export const razorpayRouter: IRouter = Router();

type RequestWithRawBody = Request & { rawBody?: Buffer };

const getRazorpayInstance = () => {
    return new Razorpay({
      key_id: env.RAZORPAY_KEY_ID || "",
      key_secret: env.RAZORPAY_KEY_SECRET || "",
    });
};

const activateRazorpaySubscription = async (
    userId: string,
    paymentId: string,
    orderId: string,
    plan: BillingPlanConfig,
    reason: TierChangeReason,
) => {
    const useClerk = isUsingClerk();

    const user = useClerk
        ? await User.findOne({ clerkId: userId }).lean()
        : await UserModel.findById(userId).lean();

    if (!user) {
        throw new Error("User not found for Razorpay activation");
    }

    const duplicateTxSub = await Subscription.findOne({
        $or: [
            { razorpayPaymentId: paymentId },
            { razorpayOrderId: orderId },
        ],
    })
        .select("user razorpayPaymentId razorpayOrderId")
        .lean();

    if (duplicateTxSub) {
        const duplicateUserId = String(duplicateTxSub.user);
        const currentUserId = String(user._id);
        if (duplicateUserId !== currentUserId) {
            throw new Error("Razorpay transaction already linked to another account");
        }
        logger.info({ userId, paymentId, orderId }, "Razorpay duplicate activation skipped");
        return;
    }

    const now = new Date();
    const periodEnd = new Date(now.getTime() + plan.durationDays * 24 * 60 * 60 * 1000);

    const subscription = await Subscription.findOneAndUpdate(
        { user: user._id },
        {
            $set: {
                razorpayPaymentId: paymentId,
                razorpayOrderId: orderId,
                planType: plan.checkoutPlanId,
                status: "active",
                currentPeriodStart: now,
                currentPeriodEnd: periodEnd,
                cancelAtPeriodEnd: false,
            },
        },
        { upsert: true, new: true },
    );

    const previousTier = String((user as { tier?: string; subscriptionTier?: string }).tier || (user as { subscriptionTier?: string }).subscriptionTier || "free");
    const targetTier = resolveTierFromPlanId(plan.planId);

    if (useClerk) {
        await User.updateOne(
            { clerkId: userId },
            { $set: { tier: targetTier, subscription: subscription._id } },
        );
    } else {
        await UserModel.updateOne(
            { _id: user._id },
            { $set: { subscriptionTier: targetTier, tier: targetTier } },
        );
    }

    await logTierChange(user._id, previousTier, targetTier, reason, paymentId);
};

razorpayRouter.post("/create-order", requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { tier, billingCycle } = req.body;
        
        if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({ success: false, message: "Razorpay credentials are not configured on the server." });
        }

        const isTestKey = /^rzp_(test)_/i.test(env.RAZORPAY_KEY_ID);
        if (env.NODE_ENV === "production" && isTestKey) {
            logger.error("Razorpay is configured with TEST key in production. Blocking checkout creation.");
            return res.status(503).json({
                success: false,
                message: "Razorpay live mode is not configured. Please contact support.",
            });
        }

        const checkoutId = `${tier}_${billingCycle}` as any;
        const plan = resolvePlan(checkoutId);

        const amountInPaise = plan.amountPaise;
        const razorpay = getRazorpayInstance();

        const order = await razorpay.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt: `rcpt_${userId}_${Math.floor(Date.now() / 1000)}`,
            notes: {
                userId,
                tier,
                billingCycle,
            },
        });

        return res.json({
            success: true,
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: env.RAZORPAY_KEY_ID, // Send key to frontend
        });
    } catch (err: any) {
        logger.error("Razorpay order creation failed:", err);
        const statusCode = typeof err?.statusCode === "number" ? err.statusCode : 500;
        const message = typeof err?.message === "string" && err.message.trim()
          ? err.message
          : "Failed to create Razorpay payment order";
        return res.status(statusCode).json({ success: false, message });
    }
});

razorpayRouter.post("/verify-payment", requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { razorpayOrderId, razorpayPaymentId, razorpaySignature, tier, billingCycle } = req.body;

        if (!razorpayOrderId || !razorpayPaymentId || !razorpaySignature || !tier || !billingCycle) {
            return res.status(400).json({
                success: false,
                message: "Missing required payment fields",
            });
        }

        if (!env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({ success: false, message: "Razorpay secret not configured" });
        }

        const body = razorpayOrderId + "|" + razorpayPaymentId;
        const expectedSignature = crypto
            .createHmac("sha256", env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest("hex");

                const expectedSigBuf = Buffer.from(expectedSignature, "utf8");
                const providedSigBuf = Buffer.from(String(razorpaySignature ?? ""), "utf8");

                const isValidSignature =
                    expectedSigBuf.length === providedSigBuf.length &&
                    crypto.timingSafeEqual(expectedSigBuf, providedSigBuf);

                if (!isValidSignature) {
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }

        const checkoutId = `${tier}_${billingCycle}` as any;
        const plan = resolvePlan(checkoutId);

        if (!plan) {
             return res.status(400).json({ success: false, message: "Invalid plan at verification." });
        }

        const razorpay = getRazorpayInstance();
        const payment = await razorpay.payments.fetch(String(razorpayPaymentId));

        if (!payment || payment.order_id !== String(razorpayOrderId)) {
            return res.status(400).json({ success: false, message: "Payment/order mismatch" });
        }

        if (typeof payment.amount === "number" && payment.amount !== plan.amountPaise) {
            return res.status(400).json({ success: false, message: "Payment amount mismatch" });
        }

        if (payment.currency && payment.currency !== "INR") {
            return res.status(400).json({ success: false, message: "Invalid payment currency" });
        }

        const order = await razorpay.orders.fetch(String(razorpayOrderId));
        if (!order || order.id !== String(razorpayOrderId)) {
            return res.status(400).json({ success: false, message: "Order not found for payment verification" });
        }

        if (typeof order.amount === "number" && order.amount !== plan.amountPaise) {
            return res.status(400).json({ success: false, message: "Order amount mismatch" });
        }

        if (order.currency && order.currency !== "INR") {
            return res.status(400).json({ success: false, message: "Invalid order currency" });
        }

        if (payment.status !== "captured" || !payment.captured) {
            return res.status(409).json({ success: false, message: `Payment is not captured yet (${payment.status})` });
        }

        await activateRazorpaySubscription(
            userId,
            razorpayPaymentId,
            razorpayOrderId,
            plan,
            "razorpay_verify",
        );
        
        logger.info(`User ${userId} successfully upgraded to ${tier} via Razorpay!`);
        
        return res.json({ success: true, message: "Payment verified successfully" });
    } catch (err: any) {
        logger.error("Razorpay verification failed:", err);
                const statusCode = typeof err?.statusCode === "number" ? err.statusCode : 500;
                const message = typeof err?.message === "string" && err.message.trim()
                    ? err.message
                    : "Payment verification failed";
                return res.status(statusCode).json({ success: false, message });
    }
});

razorpayRouter.post("/webhook", async (req: RequestWithRawBody, res: Response) => {
    try {
        const webhookSecret = env.RAZORPAY_WEBHOOK_SECRET;
        if (!webhookSecret) {
            logger.error("Razorpay webhook secret not configured");
            return res.status(500).json({ success: false, message: "Webhook secret not configured" });
        }

        const signature = String(req.headers["x-razorpay-signature"] || "");
        if (!signature) {
            return res.status(400).json({ success: false, message: "Missing x-razorpay-signature header" });
        }

        const rawPayload = req.rawBody?.toString("utf8") || JSON.stringify(req.body || {});
        const expectedSignature = crypto
            .createHmac("sha256", webhookSecret)
            .update(rawPayload)
            .digest("hex");

        const expectedSigBuf = Buffer.from(expectedSignature, "utf8");
        const providedSigBuf = Buffer.from(signature, "utf8");
        const isValidSignature =
            expectedSigBuf.length === providedSigBuf.length &&
            crypto.timingSafeEqual(expectedSigBuf, providedSigBuf);

        if (!isValidSignature) {
            logger.warn("Razorpay webhook signature mismatch");
            return res.status(401).json({ success: false, message: "Invalid webhook signature" });
        }

        const event = String(req.body?.event || "");
        const paymentEntity = req.body?.payload?.payment?.entity;
        const paymentId = String(paymentEntity?.id || "");
        const orderId = String(paymentEntity?.order_id || "");

        if (!paymentId) {
            return res.status(200).json({ success: true, processed: false, reason: "missing_payment_id" });
        }

        const eventKey = paymentId;
        try {
            await PaymentWebhookEvent.create({
                gateway: "razorpay",
                eventKey,
                status: "processing",
                metadata: {
                    event,
                    orderId,
                },
            });
        } catch (err: any) {
            if (err?.code === 11000) {
                return res.status(200).json({ success: true, processed: false, reason: "duplicate" });
            }
            throw err;
        }

        if (event !== "payment.captured") {
            await PaymentWebhookEvent.updateOne(
                { gateway: "razorpay", eventKey },
                { $set: { status: "processed", metadata: { event, skipped: true } } },
            );
            return res.status(200).json({ success: true, processed: true, skipped: true });
        }

        if (!orderId) {
            await PaymentWebhookEvent.updateOne(
                { gateway: "razorpay", eventKey },
                { $set: { status: "failed", metadata: { event, reason: "missing_order_id" } } },
            );
            return res.status(200).json({ success: true, processed: false, reason: "missing_order_id" });
        }

        const razorpay = getRazorpayInstance();
        const order = await razorpay.orders.fetch(orderId);
        const notes = order?.notes || {};

        const userId = String(notes.userId || "");
        const tier = String(notes.tier || "").toLowerCase();
        const billingCycle = String(notes.billingCycle || "").toLowerCase();

        const checkoutId = `${tier}_${billingCycle}` as any;
        const plan = resolvePlan(checkoutId);

        if (!userId || !plan) {
            await PaymentWebhookEvent.updateOne(
                { gateway: "razorpay", eventKey },
                {
                    $set: {
                        status: "failed",
                        metadata: {
                            event,
                            reason: "invalid_order_notes",
                            userId,
                            tier,
                            billingCycle,
                        },
                    },
                },
            );
            return res.status(200).json({ success: true, processed: false, reason: "invalid_order_notes" });
        }

        const paymentAmount = Number(paymentEntity?.amount ?? 0);
        const paymentCurrency = String(paymentEntity?.currency || "");
        const paymentStatus = String(paymentEntity?.status || "").toLowerCase();

        if (paymentStatus !== "captured") {
            await PaymentWebhookEvent.updateOne(
                { gateway: "razorpay", eventKey },
                { $set: { status: "failed", metadata: { event, reason: "payment_not_captured", paymentStatus } } },
            );
            return res.status(200).json({ success: true, processed: false, reason: "payment_not_captured" });
        }

        if (paymentAmount !== plan.amountPaise) {
            await PaymentWebhookEvent.updateOne(
                { gateway: "razorpay", eventKey },
                { $set: { status: "failed", metadata: { event, reason: "payment_amount_mismatch", paymentAmount, expectedAmount: plan.amountPaise } } },
            );
            return res.status(200).json({ success: true, processed: false, reason: "payment_amount_mismatch" });
        }

        if (paymentCurrency !== "INR") {
            await PaymentWebhookEvent.updateOne(
                { gateway: "razorpay", eventKey },
                { $set: { status: "failed", metadata: { event, reason: "payment_currency_mismatch", paymentCurrency } } },
            );
            return res.status(200).json({ success: true, processed: false, reason: "payment_currency_mismatch" });
        }

        if (typeof order?.amount === "number" && order.amount !== plan.amountPaise) {
            await PaymentWebhookEvent.updateOne(
                { gateway: "razorpay", eventKey },
                { $set: { status: "failed", metadata: { event, reason: "order_amount_mismatch", orderAmount: order.amount, expectedAmount: plan.amountPaise } } },
            );
            return res.status(200).json({ success: true, processed: false, reason: "order_amount_mismatch" });
        }

        if (order?.currency && order.currency !== "INR") {
            await PaymentWebhookEvent.updateOne(
                { gateway: "razorpay", eventKey },
                { $set: { status: "failed", metadata: { event, reason: "order_currency_mismatch", orderCurrency: order.currency } } },
            );
            return res.status(200).json({ success: true, processed: false, reason: "order_currency_mismatch" });
        }

        await activateRazorpaySubscription(
            userId,
            paymentId,
            orderId,
            plan,
            "razorpay_webhook",
        );

        await PaymentWebhookEvent.updateOne(
            { gateway: "razorpay", eventKey },
            {
                $set: {
                    status: "processed",
                    metadata: {
                        event,
                        userId,
                        tier,
                        billingCycle,
                        orderId,
                        paymentId,
                    },
                },
            },
        );

        return res.status(200).json({ success: true, processed: true });
    } catch (err: any) {
        logger.error("Razorpay webhook processing failed:", err);
        return res.status(500).json({ success: false, message: "Webhook processing failed" });
    }
});
