import Razorpay from "razorpay";
import crypto from "crypto";
import { Router, Request, Response, type IRouter } from "express";
import { requireAuth, getAuth } from "./middleware/authMiddleware.js";
import { env } from "./config/env.js";
import { logger } from "./utils/logger.js";
import { resolvePlan } from "./utils/billingConfig.js";
import { PhonePeBillingService } from "./phonepe.js";

export const razorpayRouter: IRouter = Router();

const getRazorpayInstance = () => {
    return new Razorpay({
      key_id: env.RAZORPAY_KEY_ID || "",
      key_secret: env.RAZORPAY_KEY_SECRET || "",
    });
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

        const checkoutId = `${tier}_${billingCycle}` as any;
        const plan = resolvePlan(checkoutId);
        
        if (!plan) {
            return res.status(400).json({ success: false, message: `Invalid plan: ${tier} ${billingCycle}` });
        }

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
        return res.status(500).json({ success: false, message: "Failed to create Razorpay payment order" });
    }
});

razorpayRouter.post("/verify-payment", requireAuth(), async (req: Request, res: Response) => {
    try {
        const { userId } = getAuth(req);
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { razorpayOrderId, razorpayPaymentId, razorpaySignature, tier, billingCycle } = req.body;

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

        // Activate the subscription using the exact same logic PhonePe uses!
        await PhonePeBillingService.activateSubscription(
            userId,
            razorpayPaymentId,
            razorpayOrderId,
            plan
        );
        
        logger.info(`User ${userId} successfully upgraded to ${tier} via Razorpay!`);
        
        return res.json({ success: true, message: "Payment verified successfully" });
    } catch (err: any) {
        logger.error("Razorpay verification failed:", err);
        return res.status(500).json({ success: false, message: "Payment verification failed" });
    }
});
