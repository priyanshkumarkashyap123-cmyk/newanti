/**
 * Migration: Harden billing idempotency and transaction uniqueness
 *
 * - Adds persistent webhook event lock collection/index
 * - Deduplicates historical subscription transaction IDs (PhonePe/Razorpay)
 * - Creates unique partial indexes for transaction identifiers
 */

import type mongoose from 'mongoose';
import type { MigrationModule } from './runner.js';

export const description = 'Harden billing idempotency with webhook event locks and unique transaction indexes';

async function ensureCollection(db: mongoose.Connection, collName: string): Promise<void> {
  const collections = await db.db!.listCollections({ name: collName }).toArray();
  if (collections.length === 0) {
    await db.db!.createCollection(collName);
  }
}

async function ensureIndex(
  db: mongoose.Connection,
  collName: string,
  key: Record<string, number>,
  options: Record<string, unknown> = {},
): Promise<void> {
  const existing = await db.collection(collName).listIndexes().toArray();
  const found = existing.find((idx) => JSON.stringify(idx.key) === JSON.stringify(key));
  if (found) {
    console.log(`Index on ${collName} ${JSON.stringify(key)} already exists as ${found.name}, skipping`);
    return;
  }
  await db.collection(collName).createIndex(key, options);
}

async function dedupeSubscriptionField(
  db: mongoose.Connection,
  field: 'phonepeTransactionId' | 'phonepeMerchantTransactionId' | 'razorpayPaymentId' | 'razorpayOrderId',
): Promise<void> {
  const coll = db.collection('subscriptions');

  const duplicateValues = await coll
    .aggregate<{ _id: string; count: number }>([
      {
        $match: {
          [field]: { $exists: true, $type: 'string', $ne: '' },
        },
      },
      {
        $group: {
          _id: `$${field}`,
          count: { $sum: 1 },
        },
      },
      {
        $match: {
          count: { $gt: 1 },
        },
      },
    ])
    .toArray();

  for (const dup of duplicateValues) {
    const docs = await coll
      .find({ [field]: dup._id })
      .project<{ _id: mongoose.Types.ObjectId }>({ _id: 1 })
      .sort({ _id: 1 })
      .toArray();

    if (docs.length <= 1) continue;

    const toUnset = docs.slice(1).map((d) => d._id);
    await coll.updateMany(
      { _id: { $in: toUnset } },
      { $unset: { [field]: '' } },
    );

    console.log(`Deduped ${field}="${dup._id}"; kept 1, unset ${toUnset.length}`);
  }
}

export const up = async (db: mongoose.Connection): Promise<void> => {
  // 1) Persistent webhook event locks
  await ensureCollection(db, 'paymentwebhookevents');
  await ensureIndex(
    db,
    'paymentwebhookevents',
    { gateway: 1, eventKey: 1 },
    {
      unique: true,
      name: 'idx_paymentwebhookevents_gateway_eventkey_unique',
    },
  );
  await ensureIndex(
    db,
    'paymentwebhookevents',
    { createdAt: 1 },
    {
      expireAfterSeconds: 60 * 60 * 24 * 30, // 30 days
      name: 'idx_paymentwebhookevents_ttl_30d',
    },
  );

  // 2) Deduplicate existing transaction IDs before creating unique indexes
  await dedupeSubscriptionField(db, 'phonepeTransactionId');
  await dedupeSubscriptionField(db, 'phonepeMerchantTransactionId');
  await dedupeSubscriptionField(db, 'razorpayPaymentId');
  await dedupeSubscriptionField(db, 'razorpayOrderId');

  // 3) Unique partial indexes (safe with historical sparse/null data)
  await ensureIndex(
    db,
    'subscriptions',
    { phonepeTransactionId: 1 },
    {
      unique: true,
      partialFilterExpression: {
        phonepeTransactionId: { $exists: true, $type: 'string', $ne: '' },
      },
      name: 'idx_subscriptions_phonepe_txn_unique',
    },
  );
  await ensureIndex(
    db,
    'subscriptions',
    { phonepeMerchantTransactionId: 1 },
    {
      unique: true,
      partialFilterExpression: {
        phonepeMerchantTransactionId: { $exists: true, $type: 'string', $ne: '' },
      },
      name: 'idx_subscriptions_phonepe_merchant_txn_unique',
    },
  );
  await ensureIndex(
    db,
    'subscriptions',
    { razorpayPaymentId: 1 },
    {
      unique: true,
      partialFilterExpression: {
        razorpayPaymentId: { $exists: true, $type: 'string', $ne: '' },
      },
      name: 'idx_subscriptions_razorpay_payment_unique',
    },
  );
  await ensureIndex(
    db,
    'subscriptions',
    { razorpayOrderId: 1 },
    {
      unique: true,
      partialFilterExpression: {
        razorpayOrderId: { $exists: true, $type: 'string', $ne: '' },
      },
      name: 'idx_subscriptions_razorpay_order_unique',
    },
  );
};

export const down = async (db: mongoose.Connection): Promise<void> => {
  const tryDrop = async (coll: string, name: string) => {
    try {
      await db.collection(coll).dropIndex(name);
    } catch {
      /* ignore */
    }
  };

  await tryDrop('subscriptions', 'idx_subscriptions_phonepe_txn_unique');
  await tryDrop('subscriptions', 'idx_subscriptions_phonepe_merchant_txn_unique');
  await tryDrop('subscriptions', 'idx_subscriptions_razorpay_payment_unique');
  await tryDrop('subscriptions', 'idx_subscriptions_razorpay_order_unique');
  await tryDrop('paymentwebhookevents', 'idx_paymentwebhookevents_gateway_eventkey_unique');
  await tryDrop('paymentwebhookevents', 'idx_paymentwebhookevents_ttl_30d');
};

export default { description, up, down } satisfies MigrationModule;
