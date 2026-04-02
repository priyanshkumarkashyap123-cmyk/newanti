/**
 * tierChangeLog.ts — Helper for writing tier change audit log entries.
 *
 * Call logTierChange whenever a user's tier changes for any reason.
 * The TierChangeLog collection is append-only.
 */

import { Types } from 'mongoose';
import { TierChangeLog } from '../models/index.js';
import { logger } from './logger.js';

export type TierChangeReason =
  | 'phonepe_webhook'
  | 'razorpay_verify'
  | 'razorpay_webhook'
  | 'admin'
  | 'expiry'
  | 'manual';

/**
 * Log a tier change to the TierChangeLog collection.
 *
 * @param userId - MongoDB ObjectId of the user
 * @param fromTier - Previous tier
 * @param toTier - New tier
 * @param reason - Reason for the change
 * @param transactionId - Optional PhonePe transaction ID
 */
export async function logTierChange(
  userId: Types.ObjectId | string,
  fromTier: string,
  toTier: string,
  reason: TierChangeReason,
  transactionId?: string,
): Promise<void> {
  try {
    await TierChangeLog.create({
      userId: typeof userId === 'string' ? new Types.ObjectId(userId) : userId,
      fromTier,
      toTier,
      reason,
      timestamp: new Date(),
      ...(transactionId ? { transactionId } : {}),
    });
    logger.info({ userId, fromTier, toTier, reason, transactionId }, '[TierChangeLog] Tier change recorded');
  } catch (err) {
    // Non-fatal: log the error but don't block the tier change
    logger.error({ err, userId, fromTier, toTier, reason }, '[TierChangeLog] Failed to record tier change');
  }
}
