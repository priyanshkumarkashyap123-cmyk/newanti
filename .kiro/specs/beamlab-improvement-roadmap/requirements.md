# Requirements Document

## Introduction

BeamLab Ultimate is a professional structural engineering SaaS platform. This document captures the improvement roadmap across five areas: subscription & billing activation, UI/UX overhaul, analysis pipeline unification, component consolidation, and data model cleanup. Requirements are prioritized as P0 (revenue-blocking), P1 (user-facing bugs), and P2 (technical debt).

## Glossary

- **BillingBypass**: The `PAYMENT_CONFIG.billingBypass` flag (client) and `TEMP_UNLOCK_ALL` env var (server) that currently grant all users enterprise-tier access for free.
- **TierAccess_Hook**: The `useTierAccess` hook in `apps/web/src/hooks/useTierAccess.ts` that calls `/api/user/limits`.
- **Subscription_Hook**: The `useSubscription` hook/provider in `apps/web/src/hooks/useSubscription.tsx` that calls `/api/user/subscription`.
- **BillingConfig**: The backend billing configuration in `apps/api/src/utils/billingConfig.ts`.
- **UpgradeModal**: The `UpgradeModal.tsx` component that presents upgrade prompts to users.
- **Analysis_Router**: The unified analysis entry point that routes requests to the correct solver backend.
- **WASM_Solver**: The in-browser WebAssembly finite-element solver for small 2D models.
- **Rust_API**: The Axum-based Rust backend (port 8080) for medium-to-large structural analysis.
- **Python_API**: The FastAPI-based Python backend (port 8000) for design checks and job queuing.
- **Node_API**: The Express 5 Node.js backend (port 3001) for auth, user management, and billing.
- **Clerk**: The primary JWT-based authentication provider.
- **User_Model**: The Mongoose `User` schema tied to Clerk (`clerkId` field).
- **UserModel_Schema**: The Mongoose `UserModel` schema for the legacy in-house auth system.
- **Subscription_Schema**: The Mongoose `Subscription` schema storing payment transaction data.
- **PhonePe**: The active payment gateway for Indian market billing.
- **LandingPage**: The `apps/web/src/pages/LandingPage.tsx` monolith (1895 lines).
- **Dashboard**: The `apps/web/src/pages/Dashboard.tsx` page component (1145 lines).


## Requirements

---

### Requirement 1 [P0]: Disable Billing Bypass and Enforce Tier Gating

**User Story:** As a business owner, I want the billing bypass flags removed so that free-tier users are restricted to free-tier features and revenue can be collected from paid plans.

#### Acceptance Criteria

1. WHEN `PAYMENT_CONFIG.billingBypass` is `false`, THE TierAccess_Hook SHALL return the tier fetched from `/api/user/limits` without overriding it to `enterprise`.
2. WHEN `TEMP_UNLOCK_ALL` environment variable is absent or set to `false`, THE Node_API SHALL return the user's actual stored tier from the database on `/api/user/limits` and `/api/user/subscription`.
3. THE Node_API SHALL default `TEMP_UNLOCK_ALL` to `false` when the environment variable is not set.
4. WHEN `PAYMENT_CONFIG.billingBypass` is `false`, THE Subscription_Hook SHALL return the user's actual tier from the backend rather than overriding the context value to `enterprise`.
5. THE Subscription_Hook SHALL return `features` values that match the tier returned by the backend, not a hardcoded all-unlocked object.
6. WHEN `TEMP_UNLOCK_ALL` is `false` and a user's stored tier is `free`, THE Node_API `/api/user/subscription` endpoint SHALL return `pdfExport: false` and `aiAssistant: false` in the features object.

---

### Requirement 2 [P0]: Unify Subscription Hooks into a Single Source of Truth

**User Story:** As a developer, I want a single subscription hook so that all components receive consistent tier and feature data without conflicting states.

#### Acceptance Criteria

1. THE Subscription_Hook SHALL be the sole authoritative source of tier and feature access for all UI components.
2. WHEN a component calls `canAccess(feature)`, THE Subscription_Hook SHALL return the access decision based on the tier fetched from `/api/user/subscription`.
3. THE TierAccess_Hook SHALL delegate its tier resolution to the Subscription_Hook context rather than making an independent `/api/user/limits` API call.
4. WHEN both hooks are present in the same component tree, THE System SHALL NOT make duplicate concurrent requests to both `/api/user/limits` and `/api/user/subscription`.
5. THE Subscription_Hook `TIER_FEATURES` definition SHALL be consistent with the `TIER_LIMITS` definition in `useTierAccess.ts` — free tier SHALL have `pdfExport: false`, `aiAssistant: false`, and finite numeric limits for nodes, members, and projects.

---

### Requirement 3 [P0]: Fix Business Plan Backend Mapping

**User Story:** As a paying customer, I want the business plan checkout to complete successfully so that I am upgraded to the correct tier after payment.

#### Acceptance Criteria

1. WHEN a user initiates checkout with plan ID `business_monthly` or `business_yearly`, THE Node_API SHALL resolve the correct PhonePe amount and duration for the business plan.
2. THE BillingConfig SHALL define a `business` plan entry alongside the existing `pro` plan with its own `amountPaise` and `durationDays` values.
3. WHEN a PhonePe webhook is received for a `business` plan transaction, THE Node_API SHALL set the user's tier to `pro` (or a new `business` tier if introduced) in the database.
4. IF a checkout plan ID does not match any entry in BillingConfig, THEN THE Node_API SHALL return HTTP 400 with a descriptive error message rather than silently failing.
5. THE `pricing.ts` frontend plan IDs (`pro_monthly`, `pro_yearly`, `business_monthly`, `business_yearly`) SHALL each have a corresponding handler in the Node_API payment route.

---

### Requirement 4 [P1]: Fix canAccess() Loading Flash

**User Story:** As a user, I want feature access to appear stable on page load so that UI elements do not flicker between locked and unlocked states.

#### Acceptance Criteria

1. WHEN `subscription.isLoading` is `true` and a cached tier exists in localStorage, THE Subscription_Hook `canAccess()` SHALL return the access decision based on the cached tier rather than returning `false`.
2. WHEN no cached tier exists and `subscription.isLoading` is `true`, THE Subscription_Hook `canAccess()` SHALL return `false` to default to the most restrictive state.
3. WHEN the backend returns a tier that differs from the cached tier, THE Subscription_Hook SHALL update the UI without causing a full component remount.
4. THE Subscription_Hook SHALL expose an `isRevalidating` flag that components can use to show a subtle loading indicator without hiding content.

---

### Requirement 5 [P0]: Implement Upgrade Paywall UX

**User Story:** As a product manager, I want upgrade prompts to appear when free-tier users attempt to access paid features so that users are guided to subscribe.

#### Acceptance Criteria

1. WHEN `canAccess(feature)` returns `false` and a user interacts with a gated feature, THE UpgradeModal SHALL be displayed with the relevant feature name and upgrade CTA.
2. WHEN `PAYMENT_CONFIG.billingBypass` is `false`, THE UpgradeModal SHALL be reachable through normal user interaction with gated features.
3. THE UpgradeModal SHALL display the correct pricing for the pro and business plans sourced from `pricing.ts`.
4. WHEN a user clicks the upgrade CTA in the UpgradeModal, THE System SHALL navigate to the pricing page or initiate the PhonePe checkout flow.
5. WHEN a user's tier is `free`, THE Dashboard SHALL display an upgrade banner with the current plan name and a link to the pricing page.

---

### Requirement 6 [P1]: Split LandingPage Monolith

**User Story:** As a developer, I want the landing page split into focused components so that the codebase is maintainable and the page loads efficiently.

#### Acceptance Criteria

1. THE LandingPage SHALL be refactored into at minimum these separate components: `HeroSection`, `TrustBar`, `FeaturesSection`, `PricingSection`, and `FAQSection`.
2. WHEN the LandingPage is rendered, THE System SHALL lazy-load `FeaturesSection`, `PricingSection`, and `FAQSection` using React `lazy` and `Suspense`.
3. THE LandingPage file SHALL contain no more than 150 lines after the refactor, delegating all section rendering to the extracted components.
4. WHEN `SHOW_REVIEWS` is `false`, THE LandingPage SHALL omit the reviews section entirely rather than rendering a hidden placeholder.

---

### Requirement 7 [P1]: Fix Dashboard Placeholder Tabs

**User Story:** As a user, I want the Favorites and Trash sidebar tabs to work so that I can organize my projects.

#### Acceptance Criteria

1. WHEN a user clicks the Favorites tab, THE Dashboard SHALL display only projects that have been marked as favorites.
2. WHEN a user clicks the Trash tab, THE Dashboard SHALL display only projects that have been soft-deleted.
3. THE Node_API SHALL expose a `PATCH /api/projects/:id/favorite` endpoint that toggles the `isFavorited` boolean on a project document.
4. THE Node_API SHALL expose a `DELETE /api/projects/:id` endpoint that performs a soft-delete by setting `deletedAt` on the project document rather than removing it.
5. THE Node_API SHALL expose a `DELETE /api/projects/:id/permanent` endpoint that permanently removes a soft-deleted project.
6. WHEN a project is soft-deleted, THE Dashboard projects list SHALL exclude it from the default "My Projects" view.

---

### Requirement 8 [P1]: Fix EnhancedPricingPage Business Plan Checkout

**User Story:** As a user on the pricing page, I want clicking "Subscribe" for the business plan to initiate a valid checkout so that I can complete my purchase.

#### Acceptance Criteria

1. WHEN a user selects the business plan and clicks the checkout button, THE System SHALL call the PhonePe checkout initiation endpoint with the correct `business_monthly` or `business_yearly` plan ID.
2. THE EnhancedPricingPage SHALL source plan IDs exclusively from `pricing.ts` `CHECKOUT_PLAN_IDS` rather than hardcoding strings.
3. IF the checkout initiation API call fails, THEN THE EnhancedPricingPage SHALL display a user-readable error message without navigating away.

---

### Requirement 9 [P1]: Unify Analysis Pipeline into a Single Entry Point

**User Story:** As a developer, I want a single `useAnalysis` hook so that components do not need to know which backend to call for a given analysis type.

#### Acceptance Criteria

1. THE Analysis_Router SHALL expose a single `useAnalysis` hook that accepts an `AnalysisModel` and `analysisType` and returns a result, loading state, and error.
2. WHEN `useAnalysis` is called with a model containing fewer than 500 nodes and `analysisType` is `static`, THE Analysis_Router SHALL route the request to the WASM_Solver.
3. WHEN `useAnalysis` is called with a model containing 500 or more nodes, THE Analysis_Router SHALL route the request to the Rust_API.
4. WHEN the Rust_API is unavailable, THE Analysis_Router SHALL fall back to the Python_API job queue without requiring any change in the calling component.
5. THE `smartAnalyze` function in `rustApi.ts` SHALL NOT import from `localAnalysis.ts` directly; instead it SHALL receive the WASM runner as an injected dependency to eliminate the circular dependency risk.
6. THE `apps/web/src/api/advancedAnalysis.ts` and `apps/web/src/api/localAnalysis.ts` modules SHALL be deprecated and their callers migrated to `useAnalysis` before removal.

---

### Requirement 10 [P2]: Remove Deprecated Razorpay Payment Components

**User Story:** As a developer, I want deprecated Razorpay components removed so that the codebase does not contain dead code that confuses future contributors.

#### Acceptance Criteria

1. THE System SHALL remove `PhonePePayment.tsx`, `RazorpayPayment.tsx`, `RazorpayCustom.tsx` from `apps/web/src/components/` after verifying no active import references remain.
2. THE `PaymentGatewaySelector.tsx` component SHALL be updated to reference only the active PhonePe payment flow.
3. WHEN a search is performed for `RazorpayPayment` or `RazorpayCustom` imports across the codebase, THE System SHALL return zero results after the cleanup.

---

### Requirement 11 [P2]: Merge Duplicate Dashboard and Collaboration Directories

**User Story:** As a developer, I want duplicate component directories merged so that there is a clear, single location for each concern.

#### Acceptance Criteria

1. THE `components/dashboard/` directory and `UserDashboard.tsx` component SHALL be consolidated so that dashboard-related sub-components live in one location.
2. THE `components/collaboration/` and `components/collaborators/` directories SHALL be merged into a single `components/collaboration/` directory.
3. THE `components/reports/` and `components/reporting/` directories SHALL be merged into a single `components/reports/` directory.
4. WHEN the consolidation is complete, THE System SHALL have no duplicate component definitions for the same UI concern.

---

### Requirement 12 [P2]: Complete Stripe and Razorpay Data Migration

**User Story:** As a developer, I want the deprecated Stripe and Razorpay fields removed from the Subscription schema so that the data model reflects the current PhonePe-only payment stack.

#### Acceptance Criteria

1. THE System SHALL provide a one-time migration script that copies any non-null `stripeCustomerId`, `stripeSubscriptionId`, `razorpayPaymentId`, and `razorpayOrderId` values into a separate `legacyPaymentData` archive collection before removal.
2. AFTER the migration script has been run, THE Subscription_Schema SHALL remove the `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `razorpayPaymentId`, and `razorpayOrderId` fields.
3. THE `ISubscription` TypeScript interface SHALL be updated to remove the deprecated fields after migration.
4. THE `phonepeTransactionId` field in the Subscription_Schema SHALL be made optional (sparse) to match `phonepeMerchantTransactionId`, since a subscription record may be created before the transaction ID is confirmed.

---

### Requirement 13 [P2]: Normalize Dual-Auth User Models

**User Story:** As a developer, I want a documented deprecation path for the in-house auth system so that the team can plan the migration to Clerk as the sole auth provider.

#### Acceptance Criteria

1. THE System SHALL document in a `DUAL_AUTH_DEPRECATION.md` file the current state of both auth systems, which routes use each, and the migration steps required to remove `UserModel_Schema`.
2. WHILE both auth systems are active, THE Node_API SHALL ensure that any tier update applied to a Clerk `User_Model` record is also applied to the corresponding `UserModel_Schema` record for the same email address.
3. THE `UserModel_Schema` `tier` virtual field SHALL remain in sync with `subscriptionTier` at all times — WHEN `subscriptionTier` is updated via a direct MongoDB write, THE System SHALL also update the `tier` alias field.
4. WHEN a new user authenticates via Clerk for the first time, THE Node_API SHALL NOT create a duplicate `UserModel_Schema` record for that user.


---

### Requirement 14 [P1]: Add Request Body Validation to Express Routes

**User Story:** As a developer, I want all Express POST/PATCH routes to validate their request bodies so that malformed payloads are rejected with descriptive errors rather than causing unhandled exceptions or silent data corruption.

#### Acceptance Criteria

1. ALL POST and PATCH routes in `apps/api/src/routes/` SHALL validate `req.body` against a Zod schema before executing handler logic.
2. WHEN a request body fails validation, THE Node_API SHALL return HTTP 400 with a JSON body containing `{ error: 'VALIDATION_ERROR', fields: [...] }` listing each invalid field and its error message.
3. THE payment initiation route SHALL validate that `planId` is one of the four known plan IDs before calling `resolvePlan()`.
4. THE project creation route SHALL validate that `name` is a non-empty string with a maximum length of 200 characters.
5. THE user registration route SHALL validate that `email` is a valid email address format and `displayName` is a non-empty string.

---

### Requirement 15 [P0]: Enforce Payment Webhook Idempotency

**User Story:** As a business owner, I want PhonePe webhook deliveries to be idempotent so that a user is never upgraded multiple times or billed twice due to duplicate webhook delivery.

#### Acceptance Criteria

1. WHEN a PhonePe webhook is received, THE Node_API SHALL check whether a `Subscription` document with the same `phonepeMerchantTransactionId` already exists before processing.
2. IF a duplicate `phonepeMerchantTransactionId` is detected, THE Node_API SHALL return HTTP 200 (to prevent PhonePe retries) without modifying any user or subscription record.
3. THE Node_API SHALL use a MongoDB `findOneAndUpdate` with `upsert: false` (or equivalent atomic operation) to prevent race conditions when two webhook deliveries arrive simultaneously for the same transaction.
4. THE `phonepeMerchantTransactionId` field in `SubscriptionSchema` SHALL have a unique sparse index to enforce uniqueness at the database level.

---

### Requirement 16 [P0]: Verify Payment Amount Server-Side

**User Story:** As a business owner, I want the payment amount derived exclusively from the server-side billing config so that a user cannot manipulate the checkout amount by modifying the frontend request.

#### Acceptance Criteria

1. THE PhonePe checkout initiation route SHALL derive the `amount` field exclusively from `BILLING_PLANS[planId].amountPaise` and SHALL NOT accept an `amount` field from the client request body.
2. IF the client request includes an `amount` field, THE Node_API SHALL ignore it and use the server-derived value.
3. THE checkout initiation route SHALL log a warning when the client-provided amount (if present) differs from the server-derived amount.

---

### Requirement 17 [P2]: Add Tier Change Audit Log

**User Story:** As a developer, I want every tier change recorded in an audit log so that billing disputes can be investigated with a complete history of upgrades, downgrades, and expirations.

#### Acceptance Criteria

1. WHEN a user's tier changes for any reason (PhonePe webhook, manual admin update, subscription expiry), THE Node_API SHALL write a record to a `TierChangeLog` collection containing: `userId`, `fromTier`, `toTier`, `reason` (e.g., `'phonepe_webhook'`, `'admin'`, `'expiry'`), `timestamp`, and `transactionId` (if applicable).
2. THE `TierChangeLog` collection SHALL be append-only — records SHALL NOT be updated or deleted.
3. THE Node_API SHALL expose a `GET /api/admin/users/:id/tier-history` endpoint (admin-only, protected by an `isAdmin` middleware check) that returns the full tier change history for a user.

---

### Requirement 18 [P2]: Add Health Check Endpoints to All Backend Services

**User Story:** As a DevOps engineer, I want health check endpoints on all backend services so that load balancers and container orchestrators can verify service liveness and readiness.

#### Acceptance Criteria

1. THE Rust_API SHALL expose a `GET /health` endpoint returning `{ "status": "ok", "version": "<semver>" }` with HTTP 200.
2. THE Python_API SHALL expose a `GET /health` endpoint returning `{ "status": "ok", "version": "<semver>" }` with HTTP 200.
3. THE Node_API SHALL expose a `GET /health` endpoint returning `{ "status": "ok", "version": "<semver>", "db": "connected" | "disconnected" }` with HTTP 200 when healthy and HTTP 503 when the database is unreachable.
4. WHEN any health check endpoint is called, THE System SHALL NOT require authentication.

---

### Requirement 19 [P2]: Fix Rust API Compiler Warnings

**User Story:** As a developer, I want the Rust API to compile with zero warnings so that real issues are not masked by noise and CI pipelines remain clean.

#### Acceptance Criteria

1. THE Rust_API SHALL compile with zero warnings when built with `cargo build --release`.
2. THE `apps/rust-api/src/lib.rs` SHALL include `#![deny(warnings)]` to prevent future warning accumulation.
3. All snake_case naming warnings SHALL be resolved by renaming the offending identifiers or adding `#[allow(non_snake_case)]` with a justification comment where renaming would break an external API contract.

---

### Requirement 20 [P1]: Add FastAPI Input Validation on Analysis Endpoints

**User Story:** As a developer, I want the Python analysis endpoints to validate incoming structural models so that malformed inputs are rejected before reaching the FEA solver, preventing crashes and OOM errors.

#### Acceptance Criteria

1. THE Python_API analysis endpoints SHALL validate all incoming `StructuralModel` payloads using Pydantic `@validator` decorators before passing them to the FEA solver.
2. THE validation SHALL reject models where any node coordinate exceeds ±10,000 m, returning HTTP 422 with a field-level error.
3. THE validation SHALL reject models where any load magnitude exceeds 1×10⁹ kN, returning HTTP 422 with a field-level error.
4. THE validation SHALL reject models where a member references a node ID that does not exist in the `nodes` list, returning HTTP 422 with a field-level error.
5. THE validation SHALL reject models where an unknown section profile name is provided, returning HTTP 422 listing the unknown profile name.
6. THE Node_API analysis proxy SHALL enforce a per-tier model size limit before forwarding to the Python_API: free tier ≤ 100 nodes, pro tier ≤ 2,000 nodes, enterprise tier ≤ 10,000 nodes; exceeding the limit returns HTTP 400 with `MODEL_TOO_LARGE`.

---

### Requirement 21 [P2]: Fix FastAPI CORS Configuration for Production

**User Story:** As a security engineer, I want the FastAPI CORS policy restricted to the production frontend domain so that cross-origin requests from unauthorized origins are blocked in production.

#### Acceptance Criteria

1. THE Python_API SHALL read allowed origins from an `ALLOWED_ORIGINS` environment variable rather than using a hardcoded wildcard `"*"`.
2. WHEN `ALLOWED_ORIGINS` is not set, THE Python_API SHALL default to `["http://localhost:5173"]` for local development only.
3. THE production deployment configuration SHALL set `ALLOWED_ORIGINS` to the production frontend domain.

