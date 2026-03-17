# Dual Auth Deprecation Plan

## Current State

BeamLab currently operates with two parallel authentication systems:

### 1. Clerk (Primary — Active)
- **Model**: `User` (Mongoose, `apps/api/src/models.ts`)
- **Identifier**: `clerkId` (string, indexed)
- **Routes using Clerk**: All routes when `USE_CLERK=true` (default in production)
- **Auth middleware**: `requireAuth()` in `apps/api/src/middleware/authMiddleware.ts`
- **Tier field**: `User.tier` (direct field)

### 2. In-House Auth (Legacy — Deprecated)
- **Model**: `UserModel` (Mongoose, `apps/api/src/models.ts`)
- **Identifier**: MongoDB `_id`
- **Routes using in-house auth**: All routes when `USE_CLERK=false`
- **Auth middleware**: JWT-based, `apps/api/src/routes/authRoutes.ts`
- **Tier field**: `UserModel.subscriptionTier` (with `tier` virtual alias)

## Dual-Lookup Pattern

The `getEffectiveTier` function in `models.ts` handles master user elevation for both systems:

```typescript
export function getEffectiveTier(email: string | null | undefined, actualTier: 'free' | 'pro' | 'enterprise'): 'free' | 'pro' | 'enterprise' {
  if (isMasterUser(email)) return 'enterprise';
  return actualTier;
}
```

Routes that update user tier (e.g., admin upgrade, PhonePe webhook) must update **both** models while both are active:

```typescript
// Invariant (Requirement 13.2): tier updates must be applied to both models
await User.updateOne({ clerkId: userId }, { $set: { tier } });           // Clerk model
await UserModel.updateOne({ email }, { $set: { subscriptionTier: tier } }); // In-house model
```

## `UserModel.tier` Virtual Field

The `UserModel` schema has a virtual `tier` field that aliases `subscriptionTier`:

```typescript
UserModelSchema.virtual('tier')
  .get(function() { return this.subscriptionTier; })
  .set(function(val) { this.subscriptionTier = val; });
```

**Invariant (Requirement 13.3)**: When `subscriptionTier` is updated via direct MongoDB write, the `tier` virtual is automatically in sync (it reads from `subscriptionTier`).

## Migration Steps

### Phase 1: Ensure all new users go through Clerk (Current)
- `USE_CLERK=true` in production
- New user registrations create `User` (Clerk model) records only
- In-house auth routes remain active for existing users

### Phase 2: Backfill `clerkId` on existing `UserModel` records
- For each `UserModel` record, find the corresponding Clerk user by email
- Set `User.clerkId` to the Clerk user ID
- Verify tier consistency between both models

### Phase 3: Remove `UserModel` routes
- Disable in-house auth routes (`/api/auth/register`, `/api/auth/login`, etc.)
- Set `USE_CLERK=true` permanently (remove the env var check)
- Keep `UserModel` schema temporarily for data access

### Phase 4: Remove `UserModel` schema
- After confirming all users have migrated to Clerk
- Remove `UserModel`, `RefreshTokenModel`, `VerificationCodeModel` from `models.ts`
- Remove `apps/api/src/routes/authRoutes.ts` (in-house auth routes)
- Remove `USE_CLERK` env var checks throughout the codebase

## New User Invariant (Requirement 13.4)

When a new user authenticates via Clerk for the first time, the system creates a `User` record (Clerk model) but must NOT create a duplicate `UserModel` record. This is enforced by:

1. The Clerk webhook handler only creates `User` records
2. In-house auth registration is disabled when `USE_CLERK=true`

## Files to Remove After Migration

- `apps/api/src/routes/authRoutes.ts` — in-house auth routes
- `apps/api/src/razorpay.ts` — deprecated payment gateway
- `apps/api/src/razorpay.custom.ts` — deprecated payment gateway helper
- `UserModel`, `RefreshTokenModel`, `VerificationCodeModel` from `models.ts`

## Environment Variables

| Variable | Current | After Migration |
|---|---|---|
| `USE_CLERK` | `true` (production) | Remove (always Clerk) |
| `JWT_SECRET` | Required for in-house auth | Remove |
| `CLERK_SECRET_KEY` | Required | Required |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Required | Required |
