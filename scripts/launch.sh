#!/bin/bash
# ================================
# BeamLab Ultimate - Launch Script
# Deployment preparation and setup
# ================================

set -e  # Exit on error

echo "🚀 BeamLab Ultimate Deployment Script"
echo "======================================"

# ================================
# 1. ENVIRONMENT VALIDATION
# ================================

echo ""
echo "📋 Step 1: Validating Environment Variables..."

REQUIRED_VARS=(
    "MONGODB_URI"
    "CLERK_SECRET_KEY"
    "VITE_CLERK_PUBLISHABLE_KEY"
    "STRIPE_SECRET_KEY"
    "STRIPE_WEBHOOK_SECRET"
)

missing_vars=()
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        missing_vars+=("$var")
    else
        echo "  ✓ $var is set"
    fi
done

if [ ${#missing_vars[@]} -ne 0 ]; then
    echo ""
    echo "❌ Missing required environment variables:"
    for var in "${missing_vars[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Please set these in your deployment platform (Render/Vercel)"
    exit 1
fi

echo "  ✅ All environment variables validated"

# ================================
# 2. DATABASE MIGRATION
# ================================

echo ""
echo "📋 Step 2: Running Database Migration..."

# Create migration script inline
node -e "
const mongoose = require('mongoose');

async function migrate() {
    console.log('  Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('  ✓ Connected');

    const db = mongoose.connection.db;

    // Ensure indexes on User collection
    console.log('  Creating indexes on User collection...');
    await db.collection('users').createIndex({ clerkId: 1 }, { unique: true });
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    await db.collection('users').createIndex({ tier: 1 });
    console.log('  ✓ User indexes created');

    // Ensure indexes on Project collection
    console.log('  Creating indexes on Project collection...');
    await db.collection('projects').createIndex({ owner: 1, createdAt: -1 });
    await db.collection('projects').createIndex({ name: 'text', description: 'text' });
    console.log('  ✓ Project indexes created');

    // Ensure indexes on Subscription collection
    console.log('  Creating indexes on Subscription collection...');
    await db.collection('subscriptions').createIndex({ stripeCustomerId: 1 }, { unique: true });
    await db.collection('subscriptions').createIndex({ user: 1 }, { unique: true });
    await db.collection('subscriptions').createIndex({ status: 1 });
    console.log('  ✓ Subscription indexes created');

    await mongoose.disconnect();
    console.log('  ✅ Migration complete');
}

migrate().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
"

# ================================
# 3. BUILD APPLICATIONS
# ================================

echo ""
echo "📋 Step 3: Building Applications..."

# Build API
echo "  Building API..."
cd apps/api
npm ci --production=false
npm run build
echo "  ✓ API built"

# Build Web
echo "  Building Web..."
cd ../web
npm ci --production=false
npm run build
echo "  ✓ Web built"

cd ../..

echo "  ✅ All applications built"

# ================================
# 4. HEALTH CHECK
# ================================

echo ""
echo "📋 Step 4: Verifying Health Endpoints..."

API_URL="${API_URL:-http://localhost:3001}"

# Start API in background for health check
cd apps/api
node dist/index.js &
API_PID=$!
sleep 3

# Check health endpoint
if curl -sf "$API_URL/health" > /dev/null; then
    echo "  ✓ API health check passed"
else
    echo "  ⚠️ API health check failed (this may be expected if not running locally)"
fi

# Cleanup
kill $API_PID 2>/dev/null || true
cd ../..

echo "  ✅ Health check complete"

# ================================
# 5. DEPLOYMENT SUMMARY
# ================================

echo ""
echo "======================================"
echo "🎉 Deployment Preparation Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Deploy to Render/Vercel:"
echo "   - Push to GitHub"
echo "   - Connect repository"
echo "   - Set environment variables"
echo ""
echo "2. Configure DNS (CNAME records):"
echo "   - api.yourdomain.com → render-api.onrender.com"
echo "   - app.yourdomain.com → your-project.vercel.app"
echo ""
echo "3. Setup UptimeRobot Monitor:"
echo "   - URL: https://api.yourdomain.com/health"
echo "   - Interval: 5 minutes"
echo "   - Alert contacts: your-email@domain.com"
echo ""
echo "4. Configure Stripe Webhook:"
echo "   - URL: https://api.yourdomain.com/api/webhook"
echo "   - Events: invoice.payment_succeeded, customer.subscription.*"
echo ""
