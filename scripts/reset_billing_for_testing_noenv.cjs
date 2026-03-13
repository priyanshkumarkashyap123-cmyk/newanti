#!/usr/bin/env node
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const envPath = path.resolve(repoRoot, '.env.deploy');
if (!fs.existsSync(envPath)) {
  console.error('.env.deploy not found in repository root; aborting.');
  process.exit(1);
}

const data = fs.readFileSync(envPath, 'utf8');
const lines = data.split(/\r?\n/);
const env = {};
for (const l of lines) {
  if (!l || l.trim().startsWith('#')) continue;
  const idx = l.indexOf('=');
  if (idx === -1) continue;
  const k = l.substring(0, idx).trim();
  const v = l.substring(idx + 1);
  env[k] = v;
}

const MONGODB_URI = env.MONGODB_URL || env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URL not set in .env.deploy; aborting.');
  process.exit(1);
}

async function main() {
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  const User = mongoose.model('User', new mongoose.Schema({}, { strict: false }), 'users');
  const UserModel = mongoose.model('UserModel', new mongoose.Schema({}, { strict: false }), 'usermodels');
  const Subscription = mongoose.model('Subscription', new mongoose.Schema({}, { strict: false }), 'subscriptions');

  const proCount = await User.countDocuments({ tier: { $in: ['pro', 'enterprise'] } });
  const inhousePro = await UserModel.countDocuments({ subscriptionTier: { $in: ['pro', 'enterprise'] } });
  const subsCount = await Subscription.countDocuments({ status: { $in: ['active', 'trialing', 'past_due'] } });

  console.log(`Found: clerk-pro=${proCount}, inhouse-pro=${inhousePro}, subs=${subsCount}`);

  const res1 = await User.updateMany({ tier: { $in: ['pro', 'enterprise'] } }, { $set: { tier: 'free' }, $unset: { subscription: '' } });
  console.log(`Clerk users downgraded: ${res1.modifiedCount || res1.nModified || 0}`);

  const res2 = await UserModel.updateMany({ subscriptionTier: { $in: ['pro', 'enterprise'] } }, { $set: { subscriptionTier: 'free' } });
  console.log(`In-house users downgraded: ${res2.modifiedCount || res2.nModified || 0}`);

  const res3 = await Subscription.deleteMany({ status: { $in: ['active', 'trialing', 'past_due'] } });
  console.log(`Subscriptions removed: ${res3.deletedCount || 0}`);

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
