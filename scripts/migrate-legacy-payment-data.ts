/**
 * migrate-legacy-payment-data.ts
 *
 * One-time migration script to archive deprecated Stripe/Razorpay fields
 * from the Subscription collection into a separate LegacyPaymentData collection.
 *
 * Usage:
 *   npx ts-node scripts/migrate-legacy-payment-data.ts
 *
 * IMPORTANT: Run this script BEFORE removing the deprecated fields from the schema (Task 22).
 * Running Task 22 first will cause data loss.
 *
 * The script is idempotent — re-running it will not duplicate LegacyPaymentData records.
 */

import mongoose, { Schema, Document, Types } from 'mongoose';

// ============================================
// LEGACY PAYMENT DATA MODEL
// ============================================

export interface ILegacyPaymentData extends Document {
  originalSubscriptionId: Types.ObjectId;
  userId: Types.ObjectId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  migratedAt: Date;
}

const LegacyPaymentDataSchema = new Schema<ILegacyPaymentData>({
  originalSubscriptionId: {
    type: Schema.Types.ObjectId,
    required: true,
    unique: true, // idempotent: upsert on this field
    index: true,
  },
  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  stripeCustomerId: { type: String, sparse: true },
  stripeSubscriptionId: { type: String, sparse: true },
  stripePriceId: { type: String },
  razorpayPaymentId: { type: String, sparse: true },
  razorpayOrderId: { type: String, sparse: true },
  migratedAt: { type: Date, default: Date.now },
}, {
  timestamps: false,
  collection: 'legacypaymentdata',
});

const LegacyPaymentData = mongoose.model<ILegacyPaymentData>('LegacyPaymentData', LegacyPaymentDataSchema);

// ============================================
// SUBSCRIPTION MODEL (minimal, for migration)
// ============================================

interface ISubscriptionLegacy {
  _id: Types.ObjectId;
  user: Types.ObjectId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
}

const SubscriptionSchema = new Schema({
  user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  stripeCustomerId: { type: String, sparse: true },
  stripeSubscriptionId: { type: String, sparse: true },
  stripePriceId: { type: String },
  razorpayPaymentId: { type: String, sparse: true },
  razorpayOrderId: { type: String, sparse: true },
}, { strict: false });

const Subscription = mongoose.model('Subscription', SubscriptionSchema);

// ============================================
// MIGRATION FUNCTION
// ============================================

async function migrate(): Promise<void> {
  const MONGODB_URI = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/beamlab';

  console.log('[Migration] Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('[Migration] Connected.');

  // Find all subscriptions with any legacy field
  const subs = await Subscription.find({
    $or: [
      { stripeCustomerId: { $exists: true, $ne: null } },
      { stripeSubscriptionId: { $exists: true, $ne: null } },
      { stripePriceId: { $exists: true, $ne: null } },
      { razorpayPaymentId: { $exists: true, $ne: null } },
      { razorpayOrderId: { $exists: true, $ne: null } },
    ],
  }).lean() as ISubscriptionLegacy[];

  console.log(`[Migration] Found ${subs.length} subscriptions with legacy payment fields.`);

  let totalProcessed = 0;
  let totalArchived = 0;
  let totalSkipped = 0;
  const failures: string[] = [];

  for (const sub of subs) {
    totalProcessed++;
    try {
      // Upsert LegacyPaymentData (idempotent on originalSubscriptionId)
      await LegacyPaymentData.findOneAndUpdate(
        { originalSubscriptionId: sub._id },
        {
          $setOnInsert: {
            originalSubscriptionId: sub._id,
            userId: sub.user,
            stripeCustomerId: sub.stripeCustomerId,
            stripeSubscriptionId: sub.stripeSubscriptionId,
            stripePriceId: sub.stripePriceId,
            razorpayPaymentId: sub.razorpayPaymentId,
            razorpayOrderId: sub.razorpayOrderId,
            migratedAt: new Date(),
          },
        },
        { upsert: true, new: true },
      );
      totalArchived++;
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Migration] Failed to archive subscription ${sub._id}: ${errMsg}`);
      failures.push(String(sub._id));
    }
  }

  // Remove legacy fields from all subscriptions (only those successfully archived)
  if (totalArchived > 0) {
    console.log(`[Migration] Removing legacy fields from ${totalArchived} subscriptions...`);
    await Subscription.updateMany(
      {
        $or: [
          { stripeCustomerId: { $exists: true } },
          { stripeSubscriptionId: { $exists: true } },
          { stripePriceId: { $exists: true } },
          { razorpayPaymentId: { $exists: true } },
          { razorpayOrderId: { $exists: true } },
        ],
      },
      {
        $unset: {
          stripeCustomerId: 1,
          stripeSubscriptionId: 1,
          stripePriceId: 1,
          razorpayPaymentId: 1,
          razorpayOrderId: 1,
        },
      },
    );
  }

  // Summary
  console.log('\n[Migration] ===== SUMMARY =====');
  console.log(`  Total processed: ${totalProcessed}`);
  console.log(`  Total archived:  ${totalArchived}`);
  console.log(`  Total skipped:   ${totalSkipped}`);
  console.log(`  Failures:        ${failures.length}`);
  if (failures.length > 0) {
    console.log(`  Failed IDs: ${failures.join(', ')}`);
  }
  console.log('[Migration] ===== DONE =====\n');

  await mongoose.disconnect();
}

// Run migration
migrate().catch((err) => {
  console.error('[Migration] Fatal error:', err);
  process.exit(1);
});
