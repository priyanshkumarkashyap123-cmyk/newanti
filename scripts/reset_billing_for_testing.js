#!/usr/bin/env node
/**
 * reset_billing_for_testing.js
 *
 * Downgrade all 'pro' or 'enterprise' users to 'free' and remove subscriptions
 * so you can test as a normal user. This is destructive: it modifies user tiers
 * and deletes Subscription documents. Run only when you mean to.
 *
 * Usage: NODE_ENV=production node scripts/reset_billing_for_testing.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

// Load .env.deploy if present in repo root
const envPath = path.resolve(process.cwd(), '.env.deploy');
dotenv.config({ path: envPath });

const MONGODB_URI = process.env.MONGODB_URL || process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URL not set in environment (.env.deploy expected)');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const User = mongoose.model('User', new mongoose.Schema({ email: String, tier: String }, { strict: false }));
  const UserModel = mongoose.model('UserModel', new mongoose.Schema({ email: String, subscriptionTier: String }, { strict: false }));
  const Subscription = mongoose.model('Subscription', new mongoose.Schema({}, { strict: false }), 'subscriptions');

  // Find counts
  const proCount = await User.countDocuments({ tier: { $in: ['pro', 'enterprise'] } });
  const inhousePro = await UserModel.countDocuments({ subscriptionTier: { $in: ['pro', 'enterprise'] } });
  const subsCount = await Subscription.countDocuments({ status: { $in: ['active', 'trialing', 'past_due'] } });

  console.log(`Users with tier pro/enterprise (Clerk users): ${proCount}`);
  console.log(`In-house users with subscriptionTier pro/enterprise: ${inhousePro}`);
  console.log(`Subscriptions active/trialing/past_due: ${subsCount}`);

  // Downgrade Clerk users
  const res1 = await User.updateMany({ tier: { $in: ['pro', 'enterprise'] } }, { $set: { tier: 'free' }, $unset: { subscription: '' } });
  console.log(`Clerk users downgraded: ${res1.nModified || res1.modifiedCount || 0}`);

  // Downgrade in-house users
  const res2 = await UserModel.updateMany({ subscriptionTier: { $in: ['pro', 'enterprise'] } }, { $set: { subscriptionTier: 'free' } });
  console.log(`In-house users downgraded: ${res2.nModified || res2.modifiedCount || 0}`);

  // Delete subscription documents (destructive)
  const res3 = await Subscription.deleteMany({ status: { $in: ['active', 'trialing', 'past_due'] } });
  console.log(`Subscriptions removed: ${res3.deletedCount || 0}`);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
