# 04 — Data, Auth, Session, and Billing Specification

_Last updated: 24 March 2026_

## 1. Data persistence overview

Primary persistence is MongoDB through Mongoose models (`apps/api/src/models.ts`).

Core collections/entities:

- User (`User`)
- Project (`Project`)
- Subscription (`Subscription`)
- In-house auth user (`UserModel`)
- Refresh tokens (`RefreshToken`)
- Additional activity/consent/session/audit/job collections via route/service modules

## 2. Core entity specifications

## 2.1 User entity

Key fields:

- identity: `clerkId`, `email`, profile names/avatar
- commercial: `tier` (`free|pro|enterprise`), `subscription`
- usage: `totalAnalysisRuns`, `dailyAnalysisCount`, `storageUsedBytes`, project/member/node counters
- lifecycle: `lastLogin`, `lastActiveAt`, `activityLog[]`
- session/device: `activeDevices`, `activeAnalysisDeviceId`

Indexes include:

- `clerkId` unique
- email unique
- tier and activity timestamps

## 2.2 Project entity

Key fields:

- `name`, `description`, `thumbnail`
- `data` (structural model JSON blob)
- ownership: `owner`, `collaborators[]`
- visibility: `isPublic`
- UX lifecycle: `isFavorited`, `deletedAt` (soft delete)

Indexes include owner/date, owner/delete-state, and text search on name/description.

## 2.3 Subscription entity

Key fields:

- `user` (unique per user)
- provider identifiers (PhonePe/Razorpay + legacy migration fields)
- `status` (`active|canceled|past_due|trialing|incomplete|expired`)
- billing periods (`currentPeriodStart`, `currentPeriodEnd`)

## 3. Auth architecture

Dual-mode auth supported by Node gateway:

1. Clerk mode (`USE_CLERK=true`)
2. In-house JWT mode (fallback/internal mode)

Protected APIs use `requireAuth()` and route-level middleware.

## 4. Session and device model

Session lifecycle is represented via:

- frontend boot hooks (`useDeviceSession`, `useUserRegistration`)
- backend `sessionRoutes` and user activity/device references
- API-level session endpoints under `/api/session*`

## 5. Quotas and tier gating

Quota/tier affects:

- maximum model sizes for analysis requests
- compute-unit deductions on successful analysis
- feature availability in premium workflows

Tier-sensitive controls are enforced server-side.

## 6. Billing and payment contracts

Primary payment path families:

- `/api/billing*` (PhonePe-oriented billing orchestration)
- `/api/payments/razorpay*` and `/api/billing/razorpay*`

Lifecycle:

1. create order
2. complete payment UI flow
3. verify signature/payment
4. update subscription state + user tier visibility

## 7. Compliance and consent

Consent records and audit endpoints exist under:

- `/api/consent*`
- `/api/audit*`

These should remain immutable/log-oriented for legal traceability.

## 8. Data quality requirements

1. IDs/foreign references must remain consistent (`user -> subscription -> project`).
2. Soft-deleted projects must be excluded from normal user listings by default.
3. Subscription status transitions must be auditable.
4. Auth mode switching must not break user/project resolution.
5. Validation schema changes must be versioned and tested for backward compatibility.
