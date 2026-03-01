import { Router, Request, Response } from "express";
import { Consent } from "../models.js";
import mongoose from "mongoose";
import { requireAuth, getAuth } from "../middleware/authMiddleware.js";
import { validateBody, recordConsentSchema } from "../middleware/validation.js";

const router: Router = Router();

// POST /api/consent/record — requires authentication
router.post("/record", requireAuth(), validateBody(recordConsentSchema), async (req: Request, res: Response) => {
  try {
    // Fail silently if DB is not connected
    if (mongoose.connection.readyState !== 1) {
      console.warn("[Consent] Database disconnected, skipping consent record");
      return res.ok({ message: "Consent acknowledged (DB offline)" });
    }

    // Use authenticated userId from Clerk, not from body
    const auth = getAuth(req);
    const userId = auth.userId;
    const { consentType, termsVersion, userAgent } = req.body;
    // Extract IP from request if not provided in body
    const ipAddress =
      req.body.ipAddress ||
      req.ip ||
      req.headers["x-forwarded-for"] ||
      "unknown";

    if (!userId || !consentType) {
      return res.fail('VALIDATION_ERROR', 'Missing required fields: userId (from auth) and consentType are required', 400);
    }

    const newConsent = new Consent({
      userId,
      consentType,
      ipAddress: Array.isArray(ipAddress) ? ipAddress[0] : ipAddress,
      termsVersion,
      userAgent,
      acceptedAt: new Date(),
    });

    await newConsent.save();

    console.log(`[Consent] Recorded ${consentType} consent for user ${userId}`);

    return res.ok({ message: "Consent recorded successfully", consent: newConsent });
  } catch (error) {
    console.error("Error recording consent:", error);
    return res.fail('INTERNAL_ERROR', 'Internal server error');
  }
});

export default router;
