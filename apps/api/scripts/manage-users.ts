
import path from 'path';
import mongoose from 'mongoose';
import { User, UserModel, connectDB, disconnectDB } from '../src/models.js';

// Ensure MONGODB_URI is set or warn
if (!process.env.MONGODB_URI) {
    console.warn('⚠️  MONGODB_URI not set. Defaulting to localhost.');
}

const validTiers = ['free', 'pro', 'enterprise'];

async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    if (!command) {
        console.log(`
Usage:
  npx tsx scripts/manage-users.ts list [limit]
  npx tsx scripts/manage-users.ts set-tier <email> <tier>

Examples:
  npx tsx scripts/manage-users.ts list 20
  npx tsx scripts/manage-users.ts set-tier user@example.com pro
        `);
        process.exit(0);
    }

    try {
        await connectDB();
        console.log('');

        if (command === 'list') {
            const limit = parseInt(args[1] || '20', 10);
            await listUsers(limit);
        } else if (command === 'set-tier') {
            const email = args[1];
            const tier = args[2];

            if (!email || !tier) {
                console.error('❌ Error: Email and tier are required.');
                process.exit(1);
            }

            if (!validTiers.includes(tier.toLowerCase())) {
                console.error(`❌ Error: Invalid tier. Allowed: ${validTiers.join(', ')}`);
                process.exit(1);
            }

            await setUserTier(email, tier.toLowerCase());
        } else {
            console.error(`❌ Unknown command: ${command}`);
        }

    } catch (error) {
        console.error('❌ Fatal Error:', error);
    } finally {
        await disconnectDB();
        process.exit(0);
    }
}

async function listUsers(limit: number) {
    console.log(`📋 Listing up to ${limit} users...\n`);

    // Fetch from both collections
    const clerkUsers = await User.find().sort({ createdAt: -1 }).limit(limit);
    const localUsers = await UserModel.find().sort({ createdAt: -1 }).limit(limit);

    console.log('--- CLERK USERS (Verified) ---');
    if (clerkUsers.length === 0) console.log('No users found.');
    clerkUsers.forEach(u => {
        console.log(`ID: ${u._id} | Email: ${u.email.padEnd(30)} | Tier: ${u.tier.toUpperCase().padEnd(10)} | Last Login: ${u.lastLogin ? u.lastLogin.toISOString().split('T')[0] : 'Never'}`);
    });

    console.log('\n--- LOCAL USERS (In-House) ---');
    if (localUsers.length === 0) console.log('No users found.');
    localUsers.forEach(u => {
        console.log(`ID: ${u._id} | Email: ${u.email.padEnd(30)} | Tier: ${u.subscriptionTier.toUpperCase().padEnd(10)} | Role: ${u.role}`);
    });
}

async function setUserTier(email: string, tier: string) {
    console.log(`⚙️  Updating user ${email} to ${tier.toUpperCase()}...\n`);
    let updated = false;

    // 1. Try updating Clerk User
    const clerkUser = await User.findOne({ email });
    if (clerkUser) {
        clerkUser.tier = tier as any;
        await clerkUser.save();
        console.log(`✅ [Clerk User] Updated tier for ${email}`);
        updated = true;
    }

    // 2. Try updating Local User
    const localUser = await UserModel.findOne({ email });
    if (localUser) {
        localUser.subscriptionTier = tier as any;
        // Also update role if it's enterprise, just in case
        if (tier === 'enterprise') localUser.role = 'enterprise';
        await localUser.save();
        console.log(`✅ [Local User] Updated tier for ${email}`);
        updated = true;
    }

    if (!updated) {
        console.warn(`⚠️  User with email '${email}' not found in any database collection.`);
    } else {
        console.log(`\n🎉 Success! User permissions updated.`);
    }
}

main();
