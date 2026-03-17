# Full-Stack Improvement Plan — BeamLab Platform
**Date:** March 17, 2026  
**Reviewer:** Senior Full-Stack Engineering Perspective (35 years experience)  
**Scope:** Frontend (React/TypeScript), Backend (Node.js/Express, FastAPI, Rust/Axum), Infrastructure

---

## Executive Summary

BeamLab is a technically ambitious platform with a solid core. The monorepo structure, multi-backend architecture, and WASM solver are well-conceived. However, the codebase shows signs of rapid growth without sufficient architectural governance: duplicate hooks, billing bypass flags left in production, 1900-line monolith components, and calculation errors that would fail a code review at any structural engineering firm.

This document prioritizes improvements by business impact and engineering risk.

---

## Section 1: Revenue-Blocking Issues (Fix This Week)

### 1.1 Billing Bypass is Live in Production

The `PAYMENT_CONFIG.billingBypass` flag and `TEMP_UNLOCK_ALL` env var grant all users enterprise access for free. This is documented in the requirements spec (Req 1) but not yet fixed. Every day this runs is lost revenue.

**Files:** `apps/web/src/config/payment.ts`, `apps/api/src/middleware/tierGating.ts`

**Fix:** Remove bypass flags, enforce tier from DB. See requirements.md Req 1–5 for full spec.

### 1.2 Business Plan Checkout is Broken

`business_monthly` / `business_yearly` plan IDs have no handler in the Node.js payment route. Clicking "Subscribe" on the business plan silently fails or returns HTTP 400.

**Fix:** Add business plan to `billingConfig.ts` with correct `amountPaise` and `durationDays`.

---

## Section 2: Frontend Architecture

### 2.1 Component Monoliths

| File | Lines | Problem |
|------|-------|---------|
| `apps/web/src/pages/LandingPage.tsx` | 1895 | Single file, no lazy loading |
| `apps/web/src/pages/Dashboard.tsx` | 1145 | Mixed concerns |
| `apps/web/src/components/structural/StructuralAnalysisPanel.tsx` | ~800 | Too many responsibilities |

**Impact:** Slow initial bundle, impossible to test individual sections, merge conflicts on every PR.

**Fix:** Split per requirements Req 6. Use React.lazy + Suspense for below-fold sections. Target: no component file > 300 lines.

### 2.2 Duplicate Hooks Creating Race Conditions

`useTierAccess` and `useSubscription` both call different endpoints (`/api/user/limits` and `/api/user/subscription`) and maintain independent state. Components that use both will show inconsistent UI during the window between the two responses.

**Fix:** Per Req 2 — `useTierAccess` should delegate to `useSubscription` context. Single source of truth.

### 2.3 Analysis Routing is Fragmented

Three separate analysis paths exist with no unified interface:
- `apps/web/src/api/localAnalysis.ts` — WASM solver
- `apps/web/src/api/rustApi.ts` — Rust API
- `apps/web/src/api/advancedAnalysis.ts` — Python API

Components import from all three directly. When the Rust API is down, components don't automatically fall back.

**Fix:** Per Req 9 — implement `useAnalysis` hook with routing logic and automatic fallback.

### 2.4 Dead Code — Razorpay Components

`RazorpayPayment.tsx`, `RazorpayCustom.tsx`, `PhonePePayment.tsx` (old version) are imported nowhere but exist in the bundle. Dead code increases bundle size and confuses new developers.

**Fix:** Per Req 10 — remove after verifying zero imports.

### 2.5 Missing Error Boundaries

The 3D canvas (Three.js) and WASM solver can throw uncaught exceptions that crash the entire React tree. There are no `ErrorBoundary` components wrapping these high-risk areas.

**Fix:** Wrap `<StructuralCanvas>`, `<AnalysisPanel>`, and `<AIArchitectPanel>` in error boundaries with graceful fallback UI.

### 2.6 No Loading Skeleton for Analysis Results

Analysis results appear all at once after a 2–5 second wait. Users see a blank panel with no indication of progress.

**Fix:** Add skeleton loaders for SFD/BMD charts and results tables. Show progress steps from the solver's `steps` array in real-time via WebSocket or SSE.

---

## Section 3: Backend — Node.js API

### 3.1 Dual Auth System is a Maintenance Liability

Two user models (`User` for Clerk, `UserModel` for legacy in-house auth) exist in parallel. Tier updates must be applied to both. Any bug in the sync logic causes users to see wrong tier data.

**Fix:** Per Req 13 — document deprecation path, enforce sync, plan migration timeline.

### 3.2 No Request Validation Middleware

Express routes accept raw `req.body` without schema validation. A malformed payload can cause unhandled exceptions or silent data corruption.

**Fix:** Add `zod` or `joi` schema validation middleware on all POST/PATCH routes. Return 400 with descriptive errors on validation failure.

### 3.3 Missing Idempotency on Payment Webhooks

PhonePe webhooks can be delivered multiple times. If the webhook handler doesn't check for duplicate `transactionId`, a user could be upgraded multiple times or a subscription record created twice.

**Fix:** Add `transactionId` uniqueness check before processing webhook. Use MongoDB `findOneAndUpdate` with `upsert: false` to prevent duplicates.

### 3.4 No Rate Limiting on Analysis Endpoints

The `/api/analyze` and `/api/ai-architect` endpoints have no rate limiting beyond the quota system. A single user can exhaust server resources with rapid requests.

**Fix:** Add `express-rate-limit` with per-user limits (e.g., 10 analysis requests/minute for free tier, 60 for pro).

### 3.5 Soft Delete Not Implemented

Dashboard "Trash" tab is a placeholder (Req 7). Projects are hard-deleted. There is no `deletedAt` field on the project schema.

**Fix:** Add `deletedAt: Date` (sparse index) to project schema. Update all project queries to filter `deletedAt: null`. Add `DELETE /api/projects/:id` (soft) and `DELETE /api/projects/:id/permanent` endpoints.

---

## Section 4: Backend — Python FastAPI

### 4.1 Calculation Errors (See CALCULATION_AUDIT_REPORT.md)

Five critical formula errors documented separately. These are the highest-priority fixes in the Python backend.

### 4.2 No Input Validation on Analysis Endpoints

The FastAPI endpoints accept analysis models without validating:
- Node coordinate ranges (prevent 1000m spans)
- Member connectivity (prevent disconnected structures)
- Load magnitudes (prevent 1e12 kN loads)
- Section profile names (prevent unknown sections crashing the solver)

**Fix:** Add Pydantic validators with `@validator` decorators. Return 422 with field-level errors.

### 4.3 Synchronous FEA in Request Handler

The FEA solver runs synchronously in the FastAPI request handler. For large models (500+ nodes), this blocks the event loop for 5–30 seconds, making the server unresponsive to other requests.

**Fix:** Move FEA to a Celery/RQ background task. Return a job ID immediately. Frontend polls `/api/jobs/{id}` for status. This is partially implemented (job queue exists) but not consistently used.

### 4.4 No Caching of Section Properties

Section database lookups (`section_database.py`) are called on every analysis request. For repeated analyses with the same sections, this is redundant.

**Fix:** Cache section properties in a module-level dict (already partially done) and add Redis caching for cross-process sharing.

### 4.5 Missing CORS Configuration for Production

The FastAPI app likely has `allow_origins=["*"]` for development. This must be restricted to the production frontend domain before launch.

---

## Section 5: Backend — Rust API (Axum)

### 5.1 Formula Audit Complete — No Critical Issues

Per `docs/FORMULA_AUDIT_COMPLETE.md`, all critical formulas in the Rust API have been fixed and tested. 69 tests passing.

### 5.2 33 Compiler Warnings

The Rust API has 33 non-critical warnings (snake_case naming). While non-blocking, these should be cleaned up to maintain code quality and avoid masking future real warnings.

**Fix:** Run `cargo fix` and address naming warnings. Add `#![deny(warnings)]` to `lib.rs` to prevent future accumulation.

### 5.3 No Health Check Endpoint

The Rust API has no `/health` endpoint. Load balancers and container orchestrators (ECS, K8s) need this for liveness/readiness probes.

**Fix:** Add `GET /health` returning `{"status": "ok", "version": "x.y.z"}`.

---

## Section 6: Data Model

### 6.1 Deprecated Payment Fields in Subscription Schema

`stripeCustomerId`, `stripeSubscriptionId`, `razorpayPaymentId`, `razorpayOrderId` are in the schema but unused. They add noise to every document and confuse new developers.

**Fix:** Per Req 12 — run migration script to archive non-null values, then remove fields.

### 6.2 No Audit Log for Tier Changes

When a user's tier changes (upgrade, downgrade, expiry), there is no audit trail. This makes it impossible to debug billing disputes.

**Fix:** Add a `TierChangeLog` collection: `{ userId, fromTier, toTier, reason, timestamp, transactionId }`. Write to it on every tier change.

### 6.3 Project Schema Missing Collaboration Fields

The project schema has no `sharedWith` or `collaborators` array. The collaboration UI exists but has no backend support.

**Fix:** Add `collaborators: [{ userId, role: 'viewer' | 'editor', addedAt }]` to project schema. Add `POST /api/projects/:id/collaborators` endpoint.

---

## Section 7: Infrastructure & DevOps

### 7.1 No CI/CD Pipeline for Calculation Tests

Formula errors (like the ones found in this audit) would be caught by automated tests. Currently there are no Python unit tests for the solver formulas.

**Fix:** Add pytest tests for:
- Simply supported beam with UDL: verify reactions, max moment, max deflection against known formulas
- Cantilever with point load: verify tip deflection = PL³/3EI
- UVL load: verify reactions against hand calculation

### 7.2 Environment Variable Management

`.env`, `.env.production`, `.env.deploy` all exist with overlapping keys. There is no single source of truth for required environment variables.

**Fix:** Create `.env.schema` (or use `zod` env validation) that documents all required variables with types and defaults. Fail fast on startup if required vars are missing.

### 7.3 No Database Migration Strategy

Schema changes (adding `deletedAt`, removing Stripe fields) are applied manually. There is no migration framework.

**Fix:** Add `migrate-mongo` for MongoDB schema migrations. Version-control all migrations. Run migrations as part of deployment pipeline.

### 7.4 Bundle Size Not Monitored

Three.js, WASM, and the structural analysis libraries make the frontend bundle large. There is no bundle size budget or monitoring.

**Fix:** Add `bundlesize` or `size-limit` to CI. Set budget: main bundle < 500KB gzipped, Three.js chunk < 300KB.

---

## Section 8: Security

### 8.1 No CSRF Protection on State-Changing Endpoints

Express API has no CSRF token validation. While JWT-based auth mitigates some risk, state-changing endpoints (payment initiation, project deletion) should have CSRF protection.

**Fix:** Add `csurf` middleware or use SameSite cookie attributes.

### 8.2 Payment Amount Not Verified Server-Side

If the frontend sends the payment amount to the backend, a user could manipulate it. The backend must derive the amount from the plan ID, not accept it from the client.

**Fix:** Verify: `amount = BILLING_CONFIG[planId].amountPaise` — never trust client-provided amounts.

### 8.3 Structural Model Size Not Limited

A user could submit a model with 100,000 nodes to the analysis endpoint, causing OOM or CPU exhaustion. There is no size limit on analysis requests.

**Fix:** Add middleware that rejects models with > 10,000 nodes (free tier: 100, pro: 2000, enterprise: 10,000).

---

## Priority Matrix

| Priority | Item | Effort | Impact |
|----------|------|--------|--------|
| P0 | Remove billing bypass | 1 day | Revenue |
| P0 | Fix business plan checkout | 0.5 day | Revenue |
| P0 | Fix calculation errors (5 critical) | 2 days | Correctness |
| P0 | Fix deprecated Gemini model | 0.5 day | AI feature |
| P1 | Add model validation (AI Architect) | 2 days | Reliability |
| P1 | Unify subscription hooks | 1 day | UX |
| P1 | Implement soft delete | 1 day | UX |
| P1 | Add request validation (FastAPI) | 1 day | Reliability |
| P1 | Split LandingPage monolith | 2 days | Performance |
| P1 | Add error boundaries | 0.5 day | Reliability |
| P2 | Add solver unit tests | 3 days | Quality |
| P2 | Remove deprecated payment components | 0.5 day | Cleanliness |
| P2 | Migrate deprecated DB fields | 1 day | Cleanliness |
| P2 | Add health check endpoints | 0.5 day | Ops |
| P2 | Fix 33 Rust warnings | 1 day | Quality |
