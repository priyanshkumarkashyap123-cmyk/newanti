 we wii# Implementation Plan: BeamLab Improvement Roadmap

## Overview

Tasks are ordered by priority: P0 (revenue-blocking) → P1 (user-facing bugs) → P2 (technical debt). Each task is independently executable and references specific requirements and design properties.

## Tasks

---

## P0 — Revenue-Blocking

- [ ] 1. Create `apps/web/src/config/tierConfig.ts` — single TIER_CONFIG source of truth
  - Define a single `TIER_CONFIG` object that merges `TIER_FEATURES` (from `useSubscription.tsx`) and `TIER_LIMITS` (from `useTierAccess.ts`) into one record keyed by `'free' | 'pro' | 'enterprise'`
  - Free tier must have `pdfExport: false`, `aiAssistant: false`, `maxProjects: 3`, `maxNodes: 10`, `maxMembers: 15`, `maxAnalysisPerDay: 3`, `canSaveProjects: false`, `canExportCleanPDF: false`
  - Export `TIER_CONFIG` and a `TierConfigEntry` type; do not import from either hook file (no circular deps)
  - _Requirements: 1.5, 2.5_

  - [ ]* 1.1 Write property test for Property 2: canAccess consistency
    - **Property 2: canAccess consistency across hooks**
    - For any tier T, `deriveLimitsFromTier(T)` must deep-equal `TIER_CONFIG[T]`
    - Use `fc.constantFrom('free', 'pro', 'enterprise')`, 100 runs
    - **Validates: Requirements 2.2, 2.5**

- [ ] 2. Refactor `useTierAccess.ts` to read from SubscriptionContext
  - Remove the `useEffect` that calls `GET /api/user/limits`; replace with `const { subscription } = useSubscription()`
  - Map `subscription.tier` → `TierAccess` shape using `TIER_CONFIG` from task 1
  - Keep the `TIER_LIMITS` export as a re-export of `TIER_CONFIG` for backward compatibility with any existing callers
  - _Requirements: 2.3, 2.4_

- [ ] 3. Fix `canAccess()` in `useSubscription.tsx` to use stale-while-revalidate
  - Replace the current `if (subscription.isLoading) return false` guard with a `cachedTier()` lookup (already defined in the file) so the cached tier is used during loading
  - When no cached tier exists (`cachedTier()` returns `'free'`), keep returning the free-tier decision (most restrictive)
  - Import `TIER_CONFIG` from task 1 and replace the inline `TIER_FEATURES` record with `TIER_CONFIG`
  - _Requirements: 4.1, 4.2_

  - [ ]* 3.1 Write property test for Property 3: canAccess stale-while-revalidate
    - **Property 3: canAccess stale-while-revalidate**
    - For any feature F and any cached tier T in localStorage, when `isLoading=true`, `canAccess(F)` must equal `TIER_CONFIG[T][F]`
    - Use `fc.constantFrom` for tier and feature keys, 100 runs
    - **Validates: Requirements 4.1, 4.2**

  - [ ]* 3.2 Write property test for Property 1: billing bypass off → tier passthrough
    - **Property 1: Billing bypass off → tier passthrough**
    - For any tier T and feature F, when `billingBypass=false`, `computeCanAccess(T, F, false)` must equal `TIER_CONFIG[T][F]`
    - Use `fc.constantFrom` for tier and feature, 100 runs
    - **Validates: Requirements 1.1, 1.4, 2.1**

- [ ] 4. Fix `apps/api/src/routes/userRoutes.ts` — replace hardcoded features object with tier-derived values
  - In the `GET /user/subscription` handler, replace the hardcoded `features` object (`pdfExport: true`, `aiAssistant: true`, etc.) with values derived from `TIER_LIMITS[accessTier]`
  - Map `TIER_LIMITS` fields to the `features` response shape: `maxProjects`, `pdfExport`, `aiAssistant`, `advancedDesignCodes`, `teamMembers`, `prioritySupport`, `apiAccess`
  - Confirm `TEMP_UNLOCK_ALL` defaults to `false` — the existing `process.env['TEMP_UNLOCK_ALL'] === 'true'` already does this; add a comment confirming the safe default
  - _Requirements: 1.2, 1.3, 1.5, 1.6_

- [ ] 5. Update `apps/api/src/utils/billingConfig.ts` — add business plan entries
  - Replace `PHONEPE_PLAN_PRICING` (keyed by `'monthly' | 'yearly'`) with a new `BILLING_PLANS` record keyed by `BillingPlanId = 'pro_monthly' | 'pro_yearly' | 'business_monthly' | 'business_yearly'`
  - Add `business_monthly: { amountPaise: 199900, label: 'Business Monthly', durationDays: 30, tier: 'enterprise' }` and `business_yearly: { amountPaise: 1999900, label: 'Business Annual', durationDays: 365, tier: 'enterprise' }`
  - Add `resolvePlan(planId: string)` that throws `HttpError(400, ...)` for unknown IDs; keep `resolvePlanAmount` and `resolvePlanDuration` as thin wrappers over `resolvePlan`
  - _Requirements: 3.1, 3.2, 3.4_

  - [ ]* 5.1 Write property test for Property 4: valid plan IDs resolve to non-zero amount
    - **Property 4: All valid plan IDs resolve to a non-zero amount**
    - For any planId in `{pro_monthly, pro_yearly, business_monthly, business_yearly}`, `resolvePlan(planId).amountPaise > 0` and `.durationDays > 0`
    - Use `fc.constantFrom` over the four valid IDs, 100 runs
    - **Validates: Requirements 3.1, 3.2**

  - [ ]* 5.2 Write property test for Property 5: invalid plan IDs return HTTP 400
    - **Property 5: Invalid plan IDs return HTTP 400**
    - For any string not in the valid set, `resolvePlan(s)` must throw an error with status 400
    - Use `fc.string().filter(s => !validIds.includes(s))`, 100 runs
    - **Validates: Requirements 3.4**

- [ ] 6. Update PhonePe payment route to use `resolvePlan()` and handle all 4 plan IDs
  - Locate the PhonePe checkout initiation route (search for `phonepe` in `apps/api/src/routes/`)
  - Replace any direct `PHONEPE_PLAN_PRICING[planType]` lookups with `resolvePlan(planId)` from task 5
  - Ensure the route accepts `planId` as `'pro_monthly' | 'pro_yearly' | 'business_monthly' | 'business_yearly'` and sets `user.tier` to `resolvePlan(planId).tier` on successful webhook
  - _Requirements: 3.1, 3.3, 3.5_

- [ ] 7. Wire `UpgradeModal` to `canAccess()` — show modal when free-tier user hits a gated feature
  - In each component that renders a gated feature button/action, call `canAccess(feature)` from `useSubscription()`; if it returns `false`, attach an `onClick` handler that opens `UpgradeModal` instead of executing the action
  - Ensure `UpgradeModal` receives the `feature` name and sources plan pricing from `pricing.ts` `PRICING_INR` / `PRICING_LABELS`
  - Add a `data-gated` attribute to gated interactive elements for testability
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

  - [ ]* 7.1 Write property test for Property 10: UpgradeModal shown for all gated features
    - **Property 10: UpgradeModal shown for all gated features**
    - For any feature key F where `TIER_CONFIG.free[F]` is `false` or `0`, clicking the gated element with `tier='free'` must render a dialog with role `dialog` and name matching `/upgrade/i`
    - Use `fc.constantFrom(...gatedFeatureKeys)`, 100 runs
    - **Validates: Requirements 5.1, 5.3**

- [ ] 8. Checkpoint — P0 billing & subscription
  - Ensure all tests pass, ask the user if questions arise.

---

## P1 — User-Facing Bugs

- [ ] 9. Create `apps/web/src/hooks/useAnalysis.ts` — unified analysis hook
  - Define `AnalysisResult` interface with `{ success, displacements, reactions, memberForces, backend: 'wasm'|'rust'|'python', computeTimeMs }`
  - Implement `routeAnalysis(model, analysisType, wasmRunner?)` with routing logic: `nodeCount < 500 && type === 'static' && wasmRunner` → WASM; `rustApi.isAvailable()` → Rust; else → Python job queue with 2-minute timeout
  - Implement `useAnalysis(options?)` hook returning `{ result, isLoading, error, backend, analyze }`
  - Normalize results from all three backends to `AnalysisResult` before returning
  - _Requirements: 9.1, 9.2, 9.3, 9.4_

  - [ ]* 9.1 Write property test for Property 6: analysis routing by node count
    - **Property 6: Analysis routing by node count**
    - For any `nodeCount` in `[1, 499]` with `analysisType='static'` and a mock WASM runner, `routeAnalysis` must return `backend === 'wasm'`
    - For any `nodeCount >= 500` with Rust available, must return `backend === 'rust'`
    - Use `fc.integer({ min: 1, max: 499 })` and `fc.integer({ min: 500, max: 5000 })`, 100 runs each
    - **Validates: Requirements 9.2, 9.3**

  - [ ]* 9.2 Write property test for Property 7: analysis result shape invariant
    - **Property 7: Analysis result shape invariant**
    - For any valid `AnalysisModel`, the result from `routeAnalysis` must contain `displacements`, `reactions`, `memberForces`, `backend` (string), and `computeTimeMs` (number)
    - Use `fc.record({ nodeCount: fc.integer({ min: 1, max: 1000 }) })` to build models, 100 runs
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4**

- [ ] 10. Update `rustApi.ts` `smartAnalyze` to accept injected `wasmRunner`
  - Change the `smartAnalyze` signature to accept `options: { wasmRunner?: () => Promise<unknown> }` instead of dynamically importing `localAnalysis`
  - Remove the `await import('./localAnalysis')` call inside `smartAnalyze`; use `options.wasmRunner?.()` instead
  - Update the JSDoc comment to document the new parameter
  - _Requirements: 9.5_

- [ ] 11. Migrate callers of `advancedAnalysis.ts` and `localAnalysis.ts` to `useAnalysis`
  - Search for all imports of `advancedAnalysis` and `localAnalysis` across `apps/web/src/`
  - Replace each call site with `const { analyze } = useAnalysis({ wasmRunner })` and call `analyze(model, type)`
  - Add `@deprecated` JSDoc to both `advancedAnalysis.ts` and `localAnalysis.ts` after migration
  - _Requirements: 9.6_

- [ ] 12. Checkpoint — analysis pipeline
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 13. Split `LandingPage.tsx` into section components with lazy loading
  - [ ] 13.1 Extract `HeroSection` to `apps/web/src/components/landing/HeroSection.tsx`
    - Move hero content (headline, CTA buttons, hero image/animation) out of `LandingPage.tsx`
    - _Requirements: 6.1_

  - [ ] 13.2 Extract `TrustBar` to `apps/web/src/components/landing/TrustBar.tsx`
    - Move trust indicators / logo bar content
    - _Requirements: 6.1_

  - [ ] 13.3 Extract `FeaturesSection` to `apps/web/src/components/landing/FeaturesSection.tsx`
    - Move features grid/cards content
    - _Requirements: 6.1_

  - [ ] 13.4 Extract `PricingSection` to `apps/web/src/components/landing/PricingSection.tsx`
    - Move pricing cards content; source plan data from `pricing.ts`
    - _Requirements: 6.1_

  - [ ] 13.5 Extract `FAQSection` to `apps/web/src/components/landing/FAQSection.tsx`
    - Move FAQ accordion content
    - _Requirements: 6.1_

  - [ ] 13.6 Rewrite `LandingPage.tsx` as orchestrator (< 150 lines)
    - Lazy-load `FeaturesSection`, `PricingSection`, `FAQSection` via `React.lazy` + `Suspense`
    - Eager-load `HeroSection` and `TrustBar`
    - Conditionally render `ReviewsSection` only when `SHOW_REVIEWS` is `true`
    - _Requirements: 6.2, 6.3, 6.4_

- [ ] 14. Add `isFavorited` and `deletedAt` fields to `IProject` and `ProjectSchema`
  - Add `isFavorited: boolean` (default `false`) and `deletedAt: Date | null` (default `null`) to the `IProject` interface in `apps/api/src/models.ts`
  - Add corresponding Mongoose schema fields with the same defaults
  - Add a compound index `{ owner: 1, deletedAt: 1 }` for efficient soft-delete queries
  - _Requirements: 7.3, 7.4, 7.6_

- [ ] 15. Add project API endpoints: favorite toggle, soft-delete, permanent delete
  - Add `PATCH /api/projects/:id/favorite` — toggle `isFavorited` on the project document; verify ownership before update
  - Add `DELETE /api/projects/:id` — soft-delete: set `deletedAt = new Date()`; verify ownership
  - Add `DELETE /api/projects/:id/permanent` — hard-delete: `Project.deleteOne()`; verify `deletedAt` is set first (prevent accidental permanent delete of active projects)
  - Update the default `GET /api/projects` query to add `{ deletedAt: null }` filter
  - _Requirements: 7.3, 7.4, 7.5, 7.6_

  - [ ]* 15.1 Write property test for Property 8: favorites filter
    - **Property 8: Favorites tab shows only favorited projects**
    - For any array of projects with mixed `isFavorited` and `deletedAt` values, `filterFavorites(projects)` must return only items where `isFavorited === true && deletedAt === null`
    - Use `fc.array(fc.record({ isFavorited: fc.boolean(), deletedAt: fc.option(fc.date(), { nil: null }) }))`, 100 runs
    - **Validates: Requirements 7.1**

  - [ ]* 15.2 Write property test for Property 9: default view excludes soft-deleted projects
    - **Property 9: Default view excludes soft-deleted projects**
    - For any array of projects with mixed `deletedAt` values, `filterActiveProjects(projects)` must return only items where `deletedAt === null`
    - Use `fc.array(fc.record({ deletedAt: fc.option(fc.date(), { nil: null }) }))`, 100 runs
    - **Validates: Requirements 7.2, 7.6**

- [ ] 16. Wire Dashboard Favorites and Trash tabs to the new API endpoints
  - In `apps/web/src/pages/Dashboard.tsx`, update the Favorites tab to call `GET /api/projects?favorited=true` (or filter client-side from the loaded project list using `isFavorited`)
  - Update the Trash tab to call `GET /api/projects?deleted=true`
  - Wire the favorite toggle button on each project card to `PATCH /api/projects/:id/favorite`
  - Wire the delete action to `DELETE /api/projects/:id` (soft) and add a "Delete permanently" action in the Trash tab to `DELETE /api/projects/:id/permanent`
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 17. Fix `EnhancedPricingPage.tsx` to source plan IDs from `pricing.ts` CHECKOUT_PLAN_IDS
  - Search for hardcoded plan ID strings (`'pro_monthly'`, `'business_monthly'`, etc.) in `EnhancedPricingPage.tsx`
  - Replace each with `CHECKOUT_PLAN_IDS[planId][billingCycle]` from `apps/web/src/config/pricing.ts`
  - Ensure the checkout button calls the PhonePe initiation endpoint with the resolved plan ID
  - Display inline error message (no navigation) when the API call fails
  - _Requirements: 8.1, 8.2, 8.3_

- [ ] 18. Checkpoint — P1 user-facing bugs
  - Ensure all tests pass, ask the user if questions arise.

---

## P2 — Technical Debt

- [ ] 19. Remove deprecated Razorpay payment components after import audit
  - Run a codebase-wide search for imports of `RazorpayPayment`, `RazorpayCustom`, and `PhonePePayment` (the old component, not the active one)
  - If zero active import references remain, delete `RazorpayPayment.tsx` and `RazorpayCustom.tsx`
  - Update `PaymentGatewaySelector.tsx` to reference only the active PhonePe payment component
  - _Requirements: 10.1, 10.2, 10.3_

- [ ] 20. Merge duplicate component directories
  - [ ] 20.1 Merge `components/collaborators/` into `components/collaboration/`
    - Move all files from `collaborators/` into `collaboration/`; update all import paths across `apps/web/src/`
    - _Requirements: 11.2_

  - [ ] 20.2 Merge `components/reporting/` into `components/reports/`
    - Move all files from `reporting/` into `reports/`; update all import paths
    - _Requirements: 11.3_

  - [ ] 20.3 Move `UserDashboard.tsx` to `components/dashboard/UserDashboard.tsx`
    - Update the import in any page or index file that references the root-level `UserDashboard.tsx`
    - _Requirements: 11.1_

- [ ] 21. Write migration script `scripts/migrate-legacy-payment-data.ts`
  - Create a `LegacyPaymentData` Mongoose model with fields: `originalSubscriptionId`, `userId`, `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `razorpayPaymentId`, `razorpayOrderId`, `migratedAt`
  - Query all `Subscription` documents where any legacy field is non-null
  - For each, upsert a `LegacyPaymentData` record (idempotent on `originalSubscriptionId`)
  - After archiving, `$unset` the five legacy fields from each subscription document
  - Print a summary: total processed, total archived, total skipped, any failures
  - _Requirements: 12.1_

- [ ] 22. Remove deprecated Stripe/Razorpay fields from `ISubscription` and `SubscriptionSchema`
  - After confirming the migration script has been run (check for `LegacyPaymentData` records), remove `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId`, `razorpayPaymentId`, `razorpayOrderId` from the `ISubscription` interface
  - Remove the corresponding fields from `SubscriptionSchema` in `apps/api/src/models.ts`
  - Make `phonepeTransactionId` optional (already `sparse: true`; ensure the interface reflects `phonepeTransactionId?: string`)
  - _Requirements: 12.2, 12.3, 12.4_

- [ ] 23. Create `DUAL_AUTH_DEPRECATION.md` documenting migration path from in-house auth to Clerk
  - Document current state: which routes use Clerk (`USE_CLERK=true`) vs. in-house `UserModel`
  - Document the `getEffectiveTier` dual-lookup pattern and the `tier` virtual field on `UserModel`
  - List migration steps: (1) ensure all new users go through Clerk, (2) backfill `clerkId` on existing `UserModel` records, (3) remove `UserModel` routes, (4) remove `UserModel` schema
  - Document the invariant from Requirement 13.2: tier updates must be applied to both models while both are active
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 24. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- P0 tasks must be completed before enabling billing in production (set `TEMP_UNLOCK_ALL=false` and `PAYMENT_CONFIG.billingBypass=false`)
- Property tests use [fast-check](https://github.com/dubzzz/fast-check) with a minimum of 100 runs each
- Each property test references the property number from `design.md` for traceability
- The migration script (task 21) must be run before task 22; running task 22 first will cause data loss
