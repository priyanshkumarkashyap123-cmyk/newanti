import { Router, Request, Response } from "express";
import { Consent } from "../models/index.js";
import mongoose from "mongoose";
import { requireAuth, getAuth } from "../middleware/authMiddleware.js";
import { validateBody, recordConsentSchema } from "../middleware/validation.js";
import { asyncHandler, HttpError } from "../utils/asyncHandler.js";
import { logger } from "../utils/logger.js";

const router: Router = Router();

// POST /api/consent/record — requires authentication
router.post("/record", requireAuth(), validateBody(recordConsentSchema), asyncHandler(async (req: Request, res: Response) => {
    // Fail silently if DB is not connected
    if (mongoose.connection.readyState !== 1) {
      logger.warn("[Consent] Database disconnected, skipping consent record");
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
      throw new HttpError(400, "Missing required fields: userId (from auth) and consentType are required");
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

    logger.info(`[Consent] Recorded ${consentType} consent for user ${userId}`);

    return res.ok({ message: "Consent recorded successfully", consent: newConsent });
}));

export default router;
