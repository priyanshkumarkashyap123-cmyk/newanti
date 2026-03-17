# Design Document: BeamLab Improvement Roadmap

## Overview

This document describes the technical design for the BeamLab Ultimate improvement roadmap. The work spans five areas:

1. **Subscription & Billing Activation** — remove billing bypass flags, unify the two subscription hooks, fix the business plan backend mapping, and implement upgrade paywall UX.
2. **Analysis Pipeline Unification** — introduce a single `useAnalysis` hook that routes to WASM, Rust, or Python based on model size and availability.
3. **UI/UX Overhaul** — split the LandingPage monolith, fix Dashboard placeholder tabs (Favorites, Trash).
4. **Component Consolidation** — remove dead Razorpay components, merge duplicate directories.
5. **Data Model Cleanup** — migrate deprecated Stripe/Razorpay fields, normalize dual-auth models.

All changes are backward-compatible during the transition period. No breaking API changes are introduced without a migration path.

---

## Architecture

### Current State

```
┌─────────────────────────────────────────────────────────────┐
│  apps/web (React SPA, Vite, TypeScript)                     │
│                                                             │
│  useTierAccess ──► GET /api/user/limits                     │
│  useSubscription ──► GET /api/user/subscription             │
│  (two independent API calls, potential drift)               │
│                                                             │
│  LandingPage.tsx (1895 lines, monolith)                     │
│  Dashboard.tsx (1145 lines, placeholder tabs)               │
│                                                             │
│  analysis.ts ──► WASM only                                  │
│  rustApi.smartAnalyze ──► imports localAnalysis directly    │
│  (circular dependency risk)                                 │
└─────────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────┐      ┌──────────────────────┐
│  apps/api        │      │  apps/rust-api        │
│  (Express 5,     │      │  (Axum, port 8080)    │
│   port 3001)     │      └──────────────────────┘
│                  │               │
│  TEMP_UNLOCK_ALL │      ┌──────────────────────┐
│  defaults to     │      │  apps/backend-python  │
│  'true' (bug)    │      │  (FastAPI, port 8000) │
│                  │      └──────────────────────┘
│  billingConfig   │
│  missing business│
│  plan entry      │
└─────────────────┘
```

### Target State

```
┌─────────────────────────────────────────────────────────────┐
│  apps/web                                                   │
│                                                             │
│  SubscriptionProvider (single source of truth)             │
│    └─► GET /api/user/subscription (one call)               │
│  useTierAccess ──► reads SubscriptionContext (no API call)  │
│                                                             │
│  useAnalysis hook (unified entry point)                     │
│    ├─► WASM (nodeCount < 500, static)                       │
│    ├─► Rust API (nodeCount >= 500)                          │
│    └─► Python job queue (Rust unavailable)                  │
│                                                             │
│  LandingPage.tsx (< 150 lines, orchestrator)               │
│    ├─► HeroSection, TrustBar (eager)                        │
│    └─► FeaturesSection, PricingSection, FAQSection (lazy)  │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│  apps/api        │
│                  │
│  TEMP_UNLOCK_ALL │
│  defaults false  │
│                  │
│  billingConfig   │
│  has pro +       │
│  business plans  │
│                  │
│  TIER_CONFIG     │
│  (single source) │
└─────────────────┘
```

---

## Components and Interfaces

### 1. Subscription System Unification

#### `TIER_CONFIG` — Single Source of Truth

A new `TIER_CONFIG` object replaces the split between `TIER_FEATURES` (in `useSubscription.tsx`) and `TIER_LIMITS` (in `useTierAccess.ts`). Both hooks read from this single definition.

```typescript
// apps/web/src/config/tierConfig.ts
export const TIER_CONFIG = {
  free: {
    // Feature flags (SubscriptionFeatures)
    maxProjects: 3,
    pdfExport: false,
    aiAssistant: false,
    advancedDesignCodes: false,
    teamMembers: 1,
    prioritySupport: false,
    apiAccess: false,
    // Numeric limits (TierLimits)
    maxNodes: 10,
    maxMembers: 15,
    maxAnalysisPerDay: 3,
    maxPdfExportsPerDay: 1,
    canSaveProjects: false,
    canExportCleanPDF: false,
    hasDesignCodes: false,
    hasAIFeatures: false,
    hasAdvancedAnalysis: false,
  },
  pro: { /* ... */ },
  enterprise: { /* ... */ },
} as const;
```

#### `useTierAccess` — Thin Adapter

After the refactor, `useTierAccess` reads from `SubscriptionContext` instead of calling `/api/user/limits`:

```typescript
export function useTierAccess(): TierAccess {
  const { subscription } = useSubscription(); // reads context, no API call
  const tier = subscription.tier;
  return {
    tier,
    isFree: tier === 'free',
    isPro: tier === 'pro' || tier === 'enterprise',
    isEnterprise: tier === 'enterprise',
    isLoading: subscription.isLoading,
    limits: TIER_CONFIG[tier],
    // ...
  };
}
```

#### `canAccess()` During Loading — Stale-While-Revalidate

```typescript
canAccess(feature: keyof SubscriptionFeatures): boolean {
  if (TEMP_UNLOCK_ALL) return true;
  // Use cached tier during loading to prevent flash
  const effectiveTier = subscription.isLoading
    ? cachedTier()   // from localStorage, defaults to 'free' if absent
    : subscription.tier;
  const value = TIER_CONFIG[effectiveTier][feature];
  return typeof value === 'boolean' ? value : value !== 0;
}
```

#### Backend: `TEMP_UNLOCK_ALL` Default Fix

In `apps/api/src/routes/userRoutes.ts`, the current code reads:
```typescript
const TEMP_UNLOCK_ALL = process.env['TEMP_UNLOCK_ALL'] === 'true';
```
This already defaults to `false` when the env var is absent. The fix is to audit all locations where the hardcoded `features` object returns `pdfExport: true` regardless of tier, and replace them with tier-derived values from `TIER_LIMITS`.

#### Backend: `billingConfig.ts` Business Plan

```typescript
// apps/api/src/utils/billingConfig.ts
export type BillingPlanId = 'pro_monthly' | 'pro_yearly' | 'business_monthly' | 'business_yearly';

export const BILLING_PLANS: Record<BillingPlanId, {
  amountPaise: number;
  label: string;
  durationDays: number;
  tier: 'pro' | 'enterprise';
}> = {
  pro_monthly:      { amountPaise: 99900,   label: 'Pro Monthly',      durationDays: 30,  tier: 'pro' },
  pro_yearly:       { amountPaise: 999900,  label: 'Pro Annual',       durationDays: 365, tier: 'pro' },
  business_monthly: { amountPaise: 199900,  label: 'Business Monthly', durationDays: 30,  tier: 'enterprise' },
  business_yearly:  { amountPaise: 1999900, label: 'Business Annual',  durationDays: 365, tier: 'enterprise' },
};

export function resolvePlan(planId: string): typeof BILLING_PLANS[BillingPlanId] {
  const plan = BILLING_PLANS[planId as BillingPlanId];
  if (!plan) throw new HttpError(400, `Unknown plan ID: ${planId}`);
  return plan;
}
```

---

### 2. Analysis Pipeline Unification

#### `useAnalysis` Hook

New file: `apps/web/src/hooks/useAnalysis.ts`

```typescript
export interface UseAnalysisOptions {
  wasmRunner?: () => Promise<AnalysisResult>; // injected dependency
}

export function useAnalysis(options: UseAnalysisOptions = {}) {
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [backend, setBackend] = useState<'wasm' | 'rust' | 'python' | null>(null);

  const analyze = useCallback(async (
    model: AnalysisModel,
    analysisType: AnalysisType = 'static'
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const { result, backend } = await routeAnalysis(model, analysisType, options.wasmRunner);
      setResult(result);
      setBackend(backend);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analysis failed');
    } finally {
      setIsLoading(false);
    }
  }, [options.wasmRunner]);

  return { result, isLoading, error, backend, analyze };
}
```

#### Routing Logic

```typescript
async function routeAnalysis(
  model: AnalysisModel,
  analysisType: AnalysisType,
  wasmRunner?: () => Promise<AnalysisResult>
): Promise<{ result: AnalysisResult; backend: 'wasm' | 'rust' | 'python' }> {
  const nodeCount = model.nodes.length;

  // Route 1: WASM for small static models
  if (nodeCount < 500 && analysisType === 'static' && wasmRunner) {
    const result = await wasmRunner();
    return { result, backend: 'wasm' };
  }

  // Route 2: Rust API for large models
  const rustAvailable = await rustApi.isAvailable();
  if (rustAvailable) {
    const result = await rustApi.analyzeStatic(model);
    return { result: normalizeResult(result), backend: 'rust' };
  }

  // Route 3: Python job queue fallback
  const result = await submitAndPollPythonJob(model, analysisType);
  return { result, backend: 'python' };
}
```

#### Circular Dependency Elimination

`rustApi.ts`'s `smartAnalyze` currently does:
```typescript
const { runLocalAnalysis } = await import("./localAnalysis"); // circular risk
```

After the refactor, `smartAnalyze` accepts a `wasmRunner` parameter:
```typescript
async smartAnalyze(
  model: AnalysisModel,
  analysisType: AnalysisType,
  options: { wasmRunner?: () => Promise<unknown> } = {}
): Promise<{ result: unknown; backend: string; timeMs: number }>
```

The caller (`useAnalysis`) injects the WASM runner, breaking the circular dependency.

#### Result Shape Normalization

All three backends return results that are normalized to a common `AnalysisResult` shape before being returned from `useAnalysis`. This ensures the result structure is identical regardless of backend.

```typescript
export interface AnalysisResult {
  success: boolean;
  displacements: Record<string, DisplacementVector>;
  reactions: Record<string, ReactionVector>;
  memberForces: Record<string, MemberForceData>;
  backend: 'wasm' | 'rust' | 'python';
  computeTimeMs: number;
}
```

---

### 3. LandingPage Split

#### Component Extraction

| Component | Lines (est.) | Load Strategy |
|---|---|---|
| `HeroSection` | ~200 | Eager |
| `TrustBar` | ~50 | Eager |
| `FeaturesSection` | ~300 | Lazy |
| `PricingSection` | ~400 | Lazy |
| `FAQSection` | ~150 | Lazy |

#### LandingPage Orchestrator

```typescript
// apps/web/src/pages/LandingPage.tsx  (< 150 lines)
const FeaturesSection = lazy(() => import('../components/landing/FeaturesSection'));
const PricingSection  = lazy(() => import('../components/landing/PricingSection'));
const FAQSection      = lazy(() => import('../components/landing/FAQSection'));

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <TrustBar />
      <Suspense fallback={<SectionSkeleton />}>
        <FeaturesSection />
      </Suspense>
      <Suspense fallback={<SectionSkeleton />}>
        <PricingSection />
      </Suspense>
      {SHOW_REVIEWS && <ReviewsSection />}
      <Suspense fallback={<SectionSkeleton />}>
        <FAQSection />
      </Suspense>
    </>
  );
}
```

---

### 4. Dashboard Tabs

#### `IProject` Schema Changes

```typescript
// apps/api/src/models.ts — IProject additions
export interface IProject extends Document {
  // ... existing fields ...
  isFavorited: boolean;      // new
  deletedAt: Date | null;    // new (soft-delete)
}
```

#### New API Endpoints

| Method | Path | Behavior |
|---|---|---|
| `PATCH` | `/api/projects/:id/favorite` | Toggle `isFavorited` boolean |
| `DELETE` | `/api/projects/:id` | Soft-delete: set `deletedAt = new Date()` |
| `DELETE` | `/api/projects/:id/permanent` | Hard-delete: `Project.deleteOne()` |

Default "My Projects" query adds `{ deletedAt: null }` filter.

---

### 5. Component Consolidation

#### Directory Merges

| From | To | Action |
|---|---|---|
| `components/collaborators/` | `components/collaboration/` | Move files, update imports |
| `components/reporting/` | `components/reports/` | Move files, update imports |
| `UserDashboard.tsx` (root) | `components/dashboard/UserDashboard.tsx` | Move, update imports |
| `RazorpayPayment.tsx` | — | Delete after import audit |
| `RazorpayCustom.tsx` | — | Delete after import audit |

---

## Data Models

### `Subscription` Schema — After Migration

```typescript
export interface ISubscription extends Document {
  user: Types.ObjectId;
  phonepeTransactionId?: string;          // optional (sparse)
  phonepeMerchantTransactionId?: string;  // optional (sparse)
  planType?: string;
  status: 'active' | 'canceled' | 'past_due' | 'trialing' | 'incomplete' | 'expired';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
  updatedAt: Date;
  // Removed: stripeCustomerId, stripeSubscriptionId, stripePriceId,
  //          razorpayPaymentId, razorpayOrderId
}
```

### `LegacyPaymentData` Archive Collection

```typescript
export interface ILegacyPaymentData extends Document {
  originalSubscriptionId: Types.ObjectId;
  userId: Types.ObjectId;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  migratedAt: Date;
}
```

### Migration Script (one-time)

```typescript
// scripts/migrate-legacy-payment-data.ts
async function migrate() {
  const subs = await Subscription.find({
    $or: [
      { stripeCustomerId: { $exists: true, $ne: null } },
      { razorpayPaymentId: { $exists: true, $ne: null } },
    ]
  });

  for (const sub of subs) {
    await LegacyPaymentData.create({
      originalSubscriptionId: sub._id,
      userId: sub.user,
      stripeCustomerId: sub.stripeCustomerId,
      stripeSubscriptionId: sub.stripeSubscriptionId,
      stripePriceId: sub.stripePriceId,
      razorpayPaymentId: sub.razorpayPaymentId,
      razorpayOrderId: sub.razorpayOrderId,
      migratedAt: new Date(),
    });
  }

  await Subscription.updateMany({}, {
    $unset: {
      stripeCustomerId: 1, stripeSubscriptionId: 1, stripePriceId: 1,
      razorpayPaymentId: 1, razorpayOrderId: 1,
    }
  });
}
```

### `IProject` Schema — After Dashboard Tab Changes

```typescript
export interface IProject extends Document {
  name: string;
  description?: string;
  thumbnail?: string;
  data: Record<string, unknown>;
  owner: Types.ObjectId;
  collaborators?: Types.ObjectId[];
  isPublic: boolean;
  isFavorited: boolean;      // added
  deletedAt: Date | null;    // added
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Billing bypass off → tier passthrough

*For any* user with a stored tier T ∈ {free, pro, enterprise}, when `PAYMENT_CONFIG.billingBypass` is `false` and the backend returns tier T, both `useTierAccess` and `useSubscription` SHALL return tier T without modification.

**Validates: Requirements 1.1, 1.4, 2.1**

---

### Property 2: canAccess consistency across hooks

*For any* feature F and any tier T, `canAccess(F)` called via `useSubscription` SHALL return the same boolean as reading `TIER_CONFIG[T][F]` directly, and `useTierAccess.limits` SHALL equal `TIER_CONFIG[T]`.

**Validates: Requirements 2.2, 2.5**

---

### Property 3: canAccess stale-while-revalidate

*For any* feature F and any cached tier T stored in localStorage, when `subscription.isLoading` is `true`, `canAccess(F)` SHALL return `TIER_CONFIG[T][F]` (the cached decision) rather than `false`.

**Validates: Requirements 4.1, 4.2**

---

### Property 4: All valid plan IDs resolve to a non-zero amount

*For any* plan ID in {pro_monthly, pro_yearly, business_monthly, business_yearly}, `resolvePlan(planId).amountPaise` SHALL be greater than zero and `resolvePlan(planId).durationDays` SHALL be greater than zero.

**Validates: Requirements 3.1, 3.2**

---

### Property 5: Invalid plan IDs return HTTP 400

*For any* string that is not a member of {pro_monthly, pro_yearly, business_monthly, business_yearly}, calling the checkout initiation endpoint with that plan ID SHALL return HTTP 400.

**Validates: Requirements 3.4**

---

### Property 6: Analysis routing by node count

*For any* `AnalysisModel` with `nodeCount < 500` and `analysisType === 'static'`, when a WASM runner is available, `useAnalysis` SHALL route to the WASM backend (result.backend === 'wasm').

*For any* `AnalysisModel` with `nodeCount >= 500`, when the Rust API is available, `useAnalysis` SHALL route to the Rust backend (result.backend === 'rust').

**Validates: Requirements 9.2, 9.3**

---

### Property 7: Analysis result shape invariant

*For any* valid `AnalysisModel`, the result returned by `useAnalysis` SHALL always conform to the `AnalysisResult` interface (containing `displacements`, `reactions`, `memberForces`, `backend`, `computeTimeMs`) regardless of which backend processed the request.

**Validates: Requirements 9.1, 9.2, 9.3, 9.4**

---

### Property 8: Favorites tab shows only favorited projects

*For any* collection of projects with mixed `isFavorited` values, the Favorites tab query SHALL return only projects where `isFavorited === true` and `deletedAt === null`.

**Validates: Requirements 7.1**

---

### Property 9: Default view excludes soft-deleted projects

*For any* collection of projects with mixed `deletedAt` values, the default "My Projects" query SHALL return only projects where `deletedAt === null`.

**Validates: Requirements 7.2, 7.6**

---

### Property 10: UpgradeModal shown for all gated features

*For any* feature F where `TIER_CONFIG.free[F]` is `false` or `0`, when a free-tier user interacts with a UI element gating feature F, the UpgradeModal SHALL be rendered.

**Validates: Requirements 5.1, 5.3**

---

## Error Handling

### Subscription Fetch Failures

- On network error or non-2xx response: retry up to 3 times with exponential back-off (1s, 2s, 4s).
- On 401/403: do not retry; immediately default to `free` tier.
- After all retries exhausted: default to `free` tier (most restrictive, secure default).
- The `isRevalidating` flag remains `true` while a background refresh is in-flight, allowing components to show a subtle indicator without hiding content.

### Analysis Routing Failures

- WASM failure: log warning, fall through to Rust API.
- Rust API failure: log warning, fall through to Python job queue.
- Python job queue timeout (> 2 minutes): throw `AnalysisTimeoutError` with a user-readable message.
- All backends unavailable: surface a clear error to the user with a retry button.

### Billing / Checkout Failures

- Unknown plan ID: return HTTP 400 with `{ error: "Unknown plan ID: <id>", validPlanIds: [...] }`.
- PhonePe initiation failure: return HTTP 502 with the upstream error message; the frontend displays it inline without navigating away.
- Webhook for unknown transaction: return HTTP 200 (to prevent PhonePe retries) but log the anomaly.

### Data Migration Failures

- Migration script is idempotent: re-running it will not duplicate `LegacyPaymentData` records (uses `upsert` on `originalSubscriptionId`).
- If a subscription document fails to migrate, the script logs the `_id` and continues; a summary report is printed at the end.

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. Unit tests cover specific examples, integration points, and error conditions. Property-based tests verify universal correctness across all inputs.

### Property-Based Testing Library

- **Frontend (TypeScript/React)**: [fast-check](https://github.com/dubzzz/fast-check)
- **Backend (Node.js)**: [fast-check](https://github.com/dubzzz/fast-check)
- Minimum **100 iterations** per property test.

### Property Test Implementations

Each property from the Correctness Properties section maps to exactly one property-based test.

**Tag format**: `Feature: beamlab-improvement-roadmap, Property {N}: {property_text}`

```typescript
// Property 1: Billing bypass off → tier passthrough
// Feature: beamlab-improvement-roadmap, Property 1: billing bypass off → tier passthrough
it('canAccess returns tier-derived value when billingBypass=false', () => {
  fc.assert(fc.property(
    fc.constantFrom('free', 'pro', 'enterprise'),
    fc.constantFrom('pdfExport', 'aiAssistant', 'advancedDesignCodes', 'apiAccess'),
    (tier, feature) => {
      const expected = TIER_CONFIG[tier][feature];
      const result = computeCanAccess(tier, feature, /* billingBypass= */ false);
      return result === expected;
    }
  ), { numRuns: 100 });
});

// Property 2: canAccess consistency across hooks
// Feature: beamlab-improvement-roadmap, Property 2: canAccess consistency
it('useTierAccess.limits equals TIER_CONFIG[tier]', () => {
  fc.assert(fc.property(
    fc.constantFrom('free', 'pro', 'enterprise'),
    (tier) => {
      const limits = deriveLimitsFromTier(tier);
      return JSON.stringify(limits) === JSON.stringify(TIER_CONFIG[tier]);
    }
  ), { numRuns: 100 });
});

// Property 4: All valid plan IDs resolve to non-zero amount
// Feature: beamlab-improvement-roadmap, Property 4: valid plan IDs resolve
it('all valid plan IDs have positive amount and duration', () => {
  fc.assert(fc.property(
    fc.constantFrom('pro_monthly', 'pro_yearly', 'business_monthly', 'business_yearly'),
    (planId) => {
      const plan = resolvePlan(planId);
      return plan.amountPaise > 0 && plan.durationDays > 0;
    }
  ), { numRuns: 100 });
});

// Property 5: Invalid plan IDs return HTTP 400
// Feature: beamlab-improvement-roadmap, Property 5: invalid plan IDs → 400
it('unknown plan IDs throw HttpError 400', () => {
  fc.assert(fc.property(
    fc.string().filter(s => !['pro_monthly','pro_yearly','business_monthly','business_yearly'].includes(s)),
    (planId) => {
      expect(() => resolvePlan(planId)).toThrow(HttpError);
      expect(() => resolvePlan(planId)).toThrow('400');
    }
  ), { numRuns: 100 });
});

// Property 6: Analysis routing by node count
// Feature: beamlab-improvement-roadmap, Property 6: analysis routing
it('models < 500 nodes route to WASM when available', () => {
  fc.assert(fc.property(
    fc.integer({ min: 1, max: 499 }),
    async (nodeCount) => {
      const model = buildModel(nodeCount);
      const { backend } = await routeAnalysis(model, 'static', mockWasmRunner);
      return backend === 'wasm';
    }
  ), { numRuns: 100 });
});

// Property 7: Analysis result shape invariant
// Feature: beamlab-improvement-roadmap, Property 7: result shape invariant
it('result always conforms to AnalysisResult interface', () => {
  fc.assert(fc.property(
    fc.record({ nodeCount: fc.integer({ min: 1, max: 1000 }) }),
    async ({ nodeCount }) => {
      const model = buildModel(nodeCount);
      const result = await routeAnalysis(model, 'static', mockWasmRunner);
      return (
        'displacements' in result.result &&
        'reactions' in result.result &&
        'memberForces' in result.result &&
        typeof result.backend === 'string' &&
        typeof result.timeMs === 'number'
      );
    }
  ), { numRuns: 100 });
});

// Property 8: Favorites tab shows only favorited projects
// Feature: beamlab-improvement-roadmap, Property 8: favorites filter
it('favorites query returns only isFavorited=true projects', () => {
  fc.assert(fc.property(
    fc.array(fc.record({
      isFavorited: fc.boolean(),
      deletedAt: fc.option(fc.date(), { nil: null }),
    })),
    (projects) => {
      const result = filterFavorites(projects);
      return result.every(p => p.isFavorited === true && p.deletedAt === null);
    }
  ), { numRuns: 100 });
});

// Property 9: Default view excludes soft-deleted projects
// Feature: beamlab-improvement-roadmap, Property 9: soft-delete exclusion
it('default view excludes soft-deleted projects', () => {
  fc.assert(fc.property(
    fc.array(fc.record({
      deletedAt: fc.option(fc.date(), { nil: null }),
    })),
    (projects) => {
      const result = filterActiveProjects(projects);
      return result.every(p => p.deletedAt === null);
    }
  ), { numRuns: 100 });
});

// Property 10: UpgradeModal shown for all gated features
// Feature: beamlab-improvement-roadmap, Property 10: upgrade modal gating
it('UpgradeModal renders for every feature gated on free tier', () => {
  fc.assert(fc.property(
    fc.constantFrom(...Object.keys(TIER_CONFIG.free).filter(k => !TIER_CONFIG.free[k])),
    (feature) => {
      const { container } = render(<GatedFeatureButton feature={feature} tier="free" />);
      fireEvent.click(container.querySelector('[data-gated]')!);
      return screen.queryByRole('dialog', { name: /upgrade/i }) !== null;
    }
  ), { numRuns: 100 });
});
```

### Unit Tests

Unit tests focus on:
- Specific examples: `TEMP_UNLOCK_ALL` default behavior, business plan webhook tier assignment, Rust→Python fallback path.
- Integration points: `SubscriptionProvider` mounting, `useTierAccess` reading from context.
- Edge cases: empty localStorage cache during loading, analysis timeout after 2 minutes.

Avoid writing unit tests that duplicate what property tests already cover (e.g., do not write individual unit tests for each tier/feature combination — the property test handles that).

### Migration Script Tests

The migration script is tested with a seeded in-memory MongoDB instance (using `mongodb-memory-server`):
- Verify `LegacyPaymentData` records are created for all subscriptions with non-null legacy fields.
- Verify the migration is idempotent (running twice produces the same result).
- Verify subscriptions with no legacy fields are not touched.

---

## Additional Components and Interfaces

### 6. Request Body Validation

#### `validateBody` Middleware Factory

```typescript
// apps/api/src/middleware/validateBody.ts
import { ZodSchema, ZodError } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const fields = (result.error as ZodError).errors.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ error: 'VALIDATION_ERROR', fields });
    }
    req.body = result.data; // replace with parsed/coerced data
    next();
  };
}
```

#### Route Schemas

```typescript
// Payment initiation
const initiateCheckoutSchema = z.object({
  planId: z.enum(['pro_monthly', 'pro_yearly', 'business_monthly', 'business_yearly']),
});

// Project creation
const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
});

// User registration
const registerSchema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
  password: z.string().min(8),
});
```

---

### 7. Payment Webhook Idempotency

#### Idempotency Check Pattern

```typescript
// In PhonePe webhook handler
async function handlePhonePeWebhook(req, res) {
  const { merchantTransactionId, status } = req.body;

  // Idempotency: check if already processed
  const existing = await Subscription.findOne({
    phonepeMerchantTransactionId: merchantTransactionId,
  });
  if (existing) {
    // Already processed — return 200 to prevent PhonePe retries
    return res.status(200).json({ status: 'already_processed' });
  }

  // Atomic upsert to handle race conditions
  const sub = await Subscription.findOneAndUpdate(
    { phonepeMerchantTransactionId: merchantTransactionId },
    { $setOnInsert: { /* new subscription fields */ } },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  // Update user tier
  await User.findByIdAndUpdate(sub.user, { tier: resolvePlan(sub.planType).tier });
  await logTierChange(sub.user, previousTier, newTier, 'phonepe_webhook', merchantTransactionId);

  res.status(200).json({ status: 'processed' });
}
```

#### Schema Index Addition

```typescript
// In SubscriptionSchema
phonepeMerchantTransactionId: {
  type: String,
  sparse: true,
  unique: true,  // enforce idempotency at DB level
}
```

---

### 8. Tier Change Audit Log

#### `ITierChangeLog` Interface

```typescript
// apps/api/src/models.ts
export interface ITierChangeLog extends Document {
  userId: Types.ObjectId;
  fromTier: 'free' | 'pro' | 'enterprise';
  toTier: 'free' | 'pro' | 'enterprise';
  reason: 'phonepe_webhook' | 'admin' | 'expiry' | 'manual';
  timestamp: Date;
  transactionId?: string;
}

const TierChangeLogSchema = new Schema<ITierChangeLog>({
  userId:        { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  fromTier:      { type: String, enum: ['free', 'pro', 'enterprise'], required: true },
  toTier:        { type: String, enum: ['free', 'pro', 'enterprise'], required: true },
  reason:        { type: String, enum: ['phonepe_webhook', 'admin', 'expiry', 'manual'], required: true },
  timestamp:     { type: Date, default: Date.now, required: true },
  transactionId: { type: String, sparse: true },
}, { timestamps: false }); // append-only, no updatedAt
```

#### `logTierChange` Helper

```typescript
// apps/api/src/utils/tierChangeLog.ts
export async function logTierChange(
  userId: Types.ObjectId,
  fromTier: string,
  toTier: string,
  reason: string,
  transactionId?: string
): Promise<void> {
  await TierChangeLog.create({ userId, fromTier, toTier, reason, timestamp: new Date(), transactionId });
}
```

---

### 9. Health Check Endpoints

#### Node_API Health Route

```typescript
// apps/api/src/routes/healthRoutes.ts
router.get('/health', async (req, res) => {
  const dbState = mongoose.connection.readyState; // 1 = connected
  const status = dbState === 1 ? 'ok' : 'degraded';
  const httpStatus = dbState === 1 ? 200 : 503;
  res.status(httpStatus).json({
    status,
    version: process.env.npm_package_version ?? 'unknown',
    db: dbState === 1 ? 'connected' : 'disconnected',
  });
});
```

#### Rust_API Health Route

```rust
// apps/rust-api/src/routes/health.rs
pub async fn health() -> impl IntoResponse {
    Json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION")
    }))
}
```

#### Python_API Health Route

```python
# apps/backend-python/routes/health.py
from fastapi import APIRouter
import importlib.metadata

router = APIRouter()

@router.get("/health")
async def health():
    return {"status": "ok", "version": importlib.metadata.version("beamlab-python")}
```

---

### 10. Model Size Limits Middleware

```typescript
// apps/api/src/middleware/modelSizeLimiter.ts
const MODEL_SIZE_LIMITS = {
  free:       100,
  pro:        2000,
  enterprise: 10000,
};

export function modelSizeLimiter(req: Request, res: Response, next: NextFunction) {
  const nodeCount: number = req.body?.nodes?.length ?? req.body?.nodeCount ?? 0;
  const tier = req.user?.tier ?? 'free';
  const limit = MODEL_SIZE_LIMITS[tier] ?? MODEL_SIZE_LIMITS.free;

  if (nodeCount > limit) {
    return res.status(400).json({
      error: 'MODEL_TOO_LARGE',
      message: `Your ${tier} plan supports up to ${limit} nodes. This model has ${nodeCount} nodes.`,
      limit,
      nodeCount,
    });
  }
  next();
}
```

Apply to `POST /api/analysis/run` and `POST /api/analysis/preflight`.

---

### 11. FastAPI CORS Fix

```python
# apps/backend-python/main.py
import os
from fastapi.middleware.cors import CORSMiddleware

allowed_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,   # replaces allow_origins=["*"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

---

### 12. FastAPI Pydantic Input Validation

```python
# apps/backend-python/models/structural_model.py
from pydantic import BaseModel, validator
from typing import List, Dict

class Node(BaseModel):
    id: str
    x: float
    y: float
    z: float = 0.0

    @validator('x', 'y', 'z')
    def coordinate_range(cls, v):
        if abs(v) > 10_000:
            raise ValueError('Node coordinate must be within ±10,000 m')
        return v

class Member(BaseModel):
    id: str
    startNodeId: str
    endNodeId: str
    sectionProfile: str

class Load(BaseModel):
    nodeId: str
    fx: float = 0.0
    fy: float = 0.0
    fz: float = 0.0

    @validator('fx', 'fy', 'fz')
    def load_magnitude(cls, v):
        if abs(v) > 1e9:
            raise ValueError('Load magnitude must not exceed 1×10⁹ kN')
        return v

class StructuralModel(BaseModel):
    nodes: List[Node]
    members: List[Member]
    loads: List[Load] = []

    @validator('members', each_item=True)
    def member_nodes_exist(cls, member, values):
        node_ids = {n.id for n in values.get('nodes', [])}
        if member.startNodeId not in node_ids:
            raise ValueError(f'Member {member.id}: startNodeId {member.startNodeId!r} not found in nodes')
        if member.endNodeId not in node_ids:
            raise ValueError(f'Member {member.id}: endNodeId {member.endNodeId!r} not found in nodes')
        return member

    @validator('members', each_item=True)
    def section_profile_known(cls, member):
        from section_database import SECTION_DATABASE
        if member.sectionProfile not in SECTION_DATABASE:
            raise ValueError(f'Unknown section profile: {member.sectionProfile!r}')
        return member
```

---

## Additional Correctness Properties

### Property 11: Webhook idempotency — duplicate transaction rejected

*For any* `phonepeMerchantTransactionId` T that already exists in the `Subscription` collection, a second webhook delivery with the same T SHALL return HTTP 200 without creating a new subscription record or changing the user's tier.

**Validates: Requirements 15.1, 15.2, 15.3**

---

### Property 12: Payment amount is server-derived

*For any* checkout initiation request, the `amountPaise` used to create the PhonePe order SHALL equal `BILLING_PLANS[planId].amountPaise` regardless of any `amount` field present in the request body.

**Validates: Requirements 16.1, 16.2**

---

### Property 13: Model size limit enforced per tier

*For any* analysis request where `nodeCount > MODEL_SIZE_LIMITS[user.tier]`, the Node_API SHALL return HTTP 400 with `MODEL_TOO_LARGE` and SHALL NOT forward the request to the Rust_API or Python_API.

**Validates: Requirements 20.6**

---

### Property 14: Request validation rejects malformed bodies

*For any* POST/PATCH request body that fails the Zod schema for that route, the Node_API SHALL return HTTP 400 with `VALIDATION_ERROR` and a non-empty `fields` array, and SHALL NOT execute the route handler.

**Validates: Requirements 14.1, 14.2**

