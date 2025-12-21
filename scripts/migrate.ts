/**
 * Database Migration Script
 * Creates indexes and ensures schema consistency
 */

import mongoose from 'mongoose';

const MONGODB_URI = process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017/beamlab';

async function migrate(): Promise<void> {
    console.log('🗄️  BeamLab Database Migration');
    console.log('==============================');
    console.log('');

    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✓ Connected to:', MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@'));

    const db = mongoose.connection.db;
    if (!db) {
        throw new Error('Database connection failed');
    }

    // ================================
    // USER COLLECTION
    // ================================
    console.log('\n📋 User Collection:');

    await db.collection('users').createIndex(
        { clerkId: 1 },
        { unique: true, name: 'idx_user_clerkId' }
    );
    console.log('  ✓ Index: clerkId (unique)');

    await db.collection('users').createIndex(
        { email: 1 },
        { unique: true, name: 'idx_user_email' }
    );
    console.log('  ✓ Index: email (unique)');

    await db.collection('users').createIndex(
        { tier: 1 },
        { name: 'idx_user_tier' }
    );
    console.log('  ✓ Index: tier');

    // ================================
    // PROJECT COLLECTION
    // ================================
    console.log('\n📋 Project Collection:');

    await db.collection('projects').createIndex(
        { owner: 1, createdAt: -1 },
        { name: 'idx_project_owner_created' }
    );
    console.log('  ✓ Index: owner + createdAt (compound)');

    await db.collection('projects').createIndex(
        { name: 'text', description: 'text' },
        { name: 'idx_project_search' }
    );
    console.log('  ✓ Index: name + description (text search)');

    await db.collection('projects').createIndex(
        { isPublic: 1 },
        { name: 'idx_project_public' }
    );
    console.log('  ✓ Index: isPublic');

    // ================================
    // SUBSCRIPTION COLLECTION
    // ================================
    console.log('\n📋 Subscription Collection:');

    await db.collection('subscriptions').createIndex(
        { stripeCustomerId: 1 },
        { unique: true, name: 'idx_sub_stripeCustomer' }
    );
    console.log('  ✓ Index: stripeCustomerId (unique)');

    await db.collection('subscriptions').createIndex(
        { user: 1 },
        { unique: true, name: 'idx_sub_user' }
    );
    console.log('  ✓ Index: user (unique)');

    await db.collection('subscriptions').createIndex(
        { status: 1 },
        { name: 'idx_sub_status' }
    );
    console.log('  ✓ Index: status');

    await db.collection('subscriptions').createIndex(
        { currentPeriodEnd: 1 },
        { name: 'idx_sub_periodEnd' }
    );
    console.log('  ✓ Index: currentPeriodEnd');

    // ================================
    // SUMMARY
    // ================================
    console.log('\n==============================');
    console.log('✅ Migration complete!');
    console.log('');

    // List all indexes
    const collections = ['users', 'projects', 'subscriptions'];
    for (const col of collections) {
        const indexes = await db.collection(col).indexes();
        console.log(`${col}: ${indexes.length} indexes`);
    }

    await mongoose.disconnect();
    console.log('\n📤 Disconnected from MongoDB');
}

// Run migration
migrate()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error('\n❌ Migration failed:', err);
        process.exit(1);
    });
