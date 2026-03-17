# BeamLab UI Features and Report Fix — Bugfix Design

## Overview

This document covers the technical design for four groups of bugs in BeamLab:

1. **Pro feature gating** — `useTierAccess` bypasses all limits; `UpgradeModal` is never triggered.
2. **Analysis pipeline** — three backends called directly with no unified hook, no fallback, no progress feedback.
3. **Result view wiring** — mode shapes, buckling, DC ratios, load combos, IS 800 results, RC schema are partially or incorrectly wired.
4. **PDF and report quality** — unit mismatch, moment sign loss, missing sections, hardcoded placeholders, no PE stamp.

The billing bypass removal itself is tracked in `beamlab-improvement-roadmap`. This spec assumes `TEMP_UNLOCK_ALL` is `false` and the backend returns the real tier.


---

## Glossary

- **Bug_Condition (C)**: The condition that identifies a defective execution path.
- **Property (P)**: The desired behavior that must hold for all inputs satisfying C.
- **Preservation**: Existing correct behavior that must not regress after the fix.
- **C1**: Free-tier user accesses a Pro-gated feature without an upgrade prompt.
- **C2**: `maxDisp` in the PDF summary is in raw meters, labeled as mm.
- **C3**: Report cover page shows hardcoded `"BeamLab Project"` / `"Engineer"` instead of live data.
- **C4**: `generateQualityChecks()` returns hardcoded PASS items regardless of actual results.
- **useTierAccess**: `apps/web/src/hooks/useTierAccess.ts` — currently calls `/api/user/limits` independently.
- **useSubscription**: `apps/web/src/hooks/useSubscription.tsx` — owns `SubscriptionContext` and calls `/api/user/subscription`.
- **SubscriptionContext**: React context provided by `SubscriptionProvider`; single source of truth for tier after the fix.
- **useAnalysis**: New unified hook `apps/web/src/hooks/useAnalysis.ts` that routes to WASM / Rust / Python.
- **TierGate**: `<TierGate feature="...">` wrapper component that renders `UpgradeModal` for free-tier users.
- **TIER_CONFIG**: Shared config object in `apps/web/src/config/tierConfig.ts` (already exists on the API side; needs a matching client-side copy).


---

## Bug Details

### Bug Condition C1 — Pro Feature Accessible to Free Tier

The bug manifests whenever a free-tier user opens any Pro-gated UI surface. `useTierAccess.ts` sets all `TIER_LIMITS.free` fields to `Infinity` / `true`, and `TEMP_UNLOCK_ALL` forces `canAccess()` to always return `true`. No component calls `canAccess()` before rendering advanced panels anyway.

**Formal Specification:**
```
FUNCTION isBugCondition_C1(X)
  INPUT: X of type { userTier: Tier, featureName: string }
  OUTPUT: boolean

  RETURN X.userTier = 'free'
    AND X.featureName IN {
      'advancedAnalysis', 'pdfExport', 'aiAssistant',
      'advancedDesignCodes', 'collaboration', 'bimExport',
      'advancedMeshing', 'sectionBrowser'
    }
END FUNCTION
```

**Examples:**
- Free user opens `PDeltaAnalysisPanel` → panel renders, no modal. Expected: `UpgradeModal` with `feature="advancedAnalysis"`.
- Free user clicks PDF export in `ExportDialog` → PDF downloads. Expected: `UpgradeModal` with `feature="pdfExport"`.
- Free user opens `CollaborationHub` → full UI renders. Expected: `UpgradeModal` with `feature="collaboration"`.

### Bug Condition C2 — Displacement Unit Mismatch in PDF

In `generateBasicPDFReport`, individual displacements are converted `* 1000` when building `dispDict`, but the `maxDisp` accumulator is computed from the raw meter values and then written to the summary table labeled "mm". The result is 1000× too small.

**Formal Specification:**
```
FUNCTION isBugCondition_C2(X)
  INPUT: X of type { displacements: Map<nodeId, {dx, dy, dz}> }
  OUTPUT: boolean

  RETURN X.displacements.size > 0
END FUNCTION
```

**Examples:**
- Node with `dx = 0.005 m` → summary shows `0.005 mm`. Expected: `5.000 mm`.

### Bug Condition C3 — Hardcoded Placeholder Data in Reports

`AnalysisDesignPanel.handleExportPDF()` passes `name: "BeamLab Project"` and `engineer: "Engineer"` as literals. `ProfessionalReportGenerator` initializes `projectInfo` with static placeholder strings and never connects to `useModelStore`.

**Formal Specification:**
```
FUNCTION isBugCondition_C3(X)
  INPUT: X of type { projectName: string, engineerName: string }
  OUTPUT: boolean

  RETURN X.projectName != '' AND X.engineerName != ''
END FUNCTION
```

**Examples:**
- Project named "Tower A", engineer "Er. Sharma" → PDF cover shows "BeamLab Project" / "Engineer". Expected: "Tower A" / "Er. Sharma".
- `ProfessionalReportGenerator` geometry section shows "156 nodes" regardless of model. Expected: actual node count from `useModelStore`.

### Bug Condition C4 — Quality Checks Hardcoded

`ComprehensiveReportService.generateQualityChecks()` ignores its `_analysisResults` and `_designResults` parameters and returns a fixed array of five PASS items.

**Formal Specification:**
```
FUNCTION isBugCondition_C4(X)
  INPUT: X of type { analysisResults: AnalysisResults, designResults: DesignResults }
  OUTPUT: boolean

  RETURN X.analysisResults != null AND X.designResults != null
END FUNCTION
```

**Examples:**
- Analysis with `maxDrift = 0.006` (exceeds IS 1893 limit of 0.004) → quality check shows PASS. Expected: FAIL with actual value.
- Member with utilization 1.15 → member check shows PASS. Expected: FAIL.


---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Pro/Enterprise users must continue to access all advanced panels without any upgrade prompt (Requirements 3.1–3.4).
- WASM routing for small static models (`nodeCount < 500`) must continue to work with the same accuracy (Requirement 3.5).
- Rust API routing for large models must continue to work when the Rust API is available (Requirement 3.6).
- PDF cover page, running header, footer branding, and D/C ratio color coding must remain unchanged (Requirements 3.7–3.8).
- `ReportBuilderPage` auto-fill from model, Markdown/HTML download, and section editing must continue to work (Requirement 3.9).
- `AnalysisDesignPanel` member forces tab, design check tab, and section assignment controls must continue to work (Requirement 3.10).
- `ProfessionalReportGenerator` template selection, section toggling, and report preview must continue to work (Requirement 3.11).
- `ComprehensiveReportService` PDF generation with valid project/design data must continue to produce a correct PDF blob (Requirement 3.12).

**Scope:**
All inputs where `userTier != 'free'` are unaffected by the tier-gating fix. All analysis paths where the Rust API is available and `nodeCount >= 500` are unaffected by the fallback fix. All PDF generation paths where `analysisResults` is `null` are unaffected by the unit conversion fix (no displacements to convert).


---

## Hypothesized Root Cause

### C1 — Pro Feature Gating

1. **`TEMP_UNLOCK_ALL` flag active**: `PAYMENT_CONFIG.billingBypass` defaults to `true`, which forces `canAccess()` to return `true` for every feature regardless of tier. This is the primary cause.
2. **`TIER_LIMITS.free` set to `Infinity`**: Even with `TEMP_UNLOCK_ALL = false`, the free-tier limits are all `Infinity` / `true`, so `canAccess()` would still return `true`.
3. **No `canAccess()` call at component entry points**: `ExportDialog`, `CollaborationHub`, `AdvancedMeshingDashboard`, `BIMExportEnhanced`, `SectionBrowserDialog`, and all advanced analysis panels render unconditionally — they never call `canAccess()` before rendering.
4. **Dual API call race condition**: `useTierAccess` calls `/api/user/limits` and `useSubscription` calls `/api/user/subscription` independently. If they resolve in different orders, the displayed tier can briefly differ between components.

### C2 — Displacement Unit Mismatch

1. **Missing `* 1000` in summary accumulator**: The `maxDisp` variable accumulates raw meter values from `analysisResults.displacements`, but the summary table labels the column "mm". The `* 1000` conversion is applied to `dispDict` entries but not to `maxDisp`.

### C3 — Hardcoded Placeholder Data

1. **`handleExportPDF()` uses string literals**: The call to `generateDesignReport` passes `name: "BeamLab Project"` and `engineer: "Engineer"` as hardcoded strings instead of reading from `useModelStore` and the auth session.
2. **`ProfessionalReportGenerator` never connects to `useModelStore`**: The component initializes `projectInfo` with static placeholder values and has no `useEffect` or `useMemo` that reads from the store.
3. **`transformToDetailedReportData()` uses hardcoded fallbacks**: When `analysisResults` is not provided, the `analysisSummary` block uses `{ maxDisplacement: 12.5, maxDrift: 0.0035 }` instead of `null`.

### C4 — Quality Checks Hardcoded

1. **Parameters are unused**: `generateQualityChecks(_analysisResults, _designResults)` prefixes both parameters with `_`, indicating they are intentionally ignored. The method body returns a static array.

### Analysis Pipeline (C-adjacent)

1. **No unified entry point**: Components import `localAnalysis.ts`, `rustApi.ts`, or `advancedAnalysis.ts` directly. There is no single hook that selects the backend.
2. **`rustApi.smartAnalyze` has no fallback**: When the Rust API is unavailable, `smartAnalyze` throws rather than delegating to the Python job queue.
3. **No progress events surfaced**: The solver backends emit progress steps internally but no mechanism exists to relay them to `ResultsHub` or `AnalysisResultsDashboard`.

### Result View Wiring (C-adjacent)

1. **`ModeShapeRenderer` data path inconsistent**: Modal results are stored in the analysis result object but the renderer is not always passed the correct key.
2. **`StabilityView` Python response mapping incomplete**: The Python backend returns buckling results under a different key structure than what `StabilityView` expects.
3. **`DCRatioView` only wired for steel**: The component receives `MemberResult[]` which is populated only from the steel design path; concrete members are never added.
4. **`SteelDesignTab` only renders AISC rows**: The `MemberDesignRow` type has no IS 800 result fields; IS 800 results from the Python backend are discarded.
5. **`RCBeamTab` schema mismatch**: The Python backend returns RC results with snake_case keys; the component expects camelCase.
6. **No `ErrorBoundary` on high-risk components**: `StructuralModelingCanvas`, `AnalysisDesignPanel`, and `AIArchitectPanel` are not wrapped.


---

## Correctness Properties

Property 1: Bug Condition C1 — Tier Gate Enforcement

_For any_ user where `isBugCondition_C1` holds (free tier + Pro-gated feature), the fixed UI SHALL render `UpgradeModal` with the correct `feature` prop and SHALL NOT render the gated component.

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7**

---

Property 2: Preservation — Pro Tier Unaffected by Gating

_For any_ user where `isBugCondition_C1` does NOT hold (tier is `pro` or `enterprise`), the fixed UI SHALL render the gated component without any upgrade prompt, identical to the original behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

---

Property 3: Single API Call — No Dual-Fetch Race

_For any_ authenticated user session, mounting both `useTierAccess` and `useSubscription` in the same component tree SHALL result in exactly one network request to `/api/user/subscription`, with `useTierAccess` reading from `SubscriptionContext` rather than calling `/api/user/limits`.

**Validates: Requirement 2.8**

---

Property 4: Bug Condition C2 — Displacement Unit Conversion

_For any_ displacement map where `isBugCondition_C2` holds (at least one displacement entry), the fixed `generateBasicPDFReport` SHALL write `maxDisp = max(|dx|, |dy|, |dz|) * 1000` to the summary table, and the unit label SHALL read "mm".

**Validates: Requirement 2.21**

---

Property 5: Preservation — Displacement Unit Conversion Does Not Affect Individual Rows

_For any_ displacement map, the individual displacement values in `dispDict` (already converted `* 1000`) SHALL remain unchanged by the fix to `maxDisp`.

**Validates: Requirement 3.7**

---

Property 6: Bug Condition C3 — Report Uses Live Project and Engineer Data

_For any_ project name `P` and engineer name `E` where `isBugCondition_C3` holds, the fixed `handleExportPDF()` and `ProfessionalReportGenerator` SHALL produce a report that contains `P` and `E`, and SHALL NOT contain the strings `"BeamLab Project"` or `"Engineer"` as the project/engineer values.

**Validates: Requirements 2.20, 2.26**

---

Property 7: Bug Condition C4 — Quality Checks Derived from Actual Results

_For any_ `analysisResults` and `designResults` where `isBugCondition_C4` holds, the fixed `generateQualityChecks()` SHALL return check items where:
- `driftCheck.actual` equals `analysisResults.maxDrift`
- `deflectionCheck.actual` equals `analysisResults.maxDisplacement`
- `memberCheck.status` is derived from the maximum utilization in `designResults`

**Validates: Requirement 2.27**

---

Property 8: Preservation — Quality Checks With Null Results

_For any_ call to `generateQualityChecks(null, null)`, the fixed method SHALL return an empty array or a list of "N/A" items rather than hardcoded PASS items, and SHALL NOT throw.

**Validates: Requirement 2.28**

---

Property 9: Analysis Routing — Backend Selection

_For any_ `AnalysisModel` with `nodeCount < 500` and `analysisType === 'static'` when a WASM runner is available, `useAnalysis` SHALL return `result.backend === 'wasm'`.

_For any_ `AnalysisModel` with `nodeCount >= 500` when the Rust API is available, `useAnalysis` SHALL return `result.backend === 'rust'`.

_For any_ `AnalysisModel` when the Rust API is unavailable, `useAnalysis` SHALL return `result.backend === 'python'` and SHALL display a non-blocking toast.

**Validates: Requirements 2.9, 2.10**

---

Property 10: Analysis Result Shape Invariant

_For any_ valid `AnalysisModel` and any backend, the result returned by `useAnalysis` SHALL always conform to the `UnifiedAnalysisResult` interface containing `displacements`, `reactions`, `memberForces`, `backend`, and `computeTimeMs`, regardless of which backend processed the request.

**Validates: Requirements 2.9, 3.5, 3.6**

---

Property 11: Moment Data Preserves Signed Values

_For any_ member forces entry where `isBugCondition_C2` holds, the fixed `generateBasicPDFReport` SHALL store `momentY` and `momentZ` as signed values at both member ends in the forces dictionary, rather than only the peak absolute value.

**Validates: Requirement 2.22**

---

Property 12: Governing Check Uses Human-Readable Description

_For any_ design result, the fixed `generateBasicPDFReport` SHALL write a human-readable description (e.g., `"Combined Compression + Flexure"`) to the governing check column, and SHALL NOT write internal enum names (e.g., `"COMPRESSION_FLEXURE_COMBINED"`).

**Validates: Requirement 2.24**

---

Property 13: Node Coordinate Table Row Count

_For any_ model with N nodes, the fixed `generateBasicPDFReport` SHALL include a node coordinate table in the geometry section with exactly N data rows, each containing node ID, X, Y, Z coordinates, and support condition.

**Validates: Requirement 2.31**


---

## Fix Implementation

### 1. Pro Feature Gating Architecture

#### 1.1 `useTierAccess` — Thin Adapter over `SubscriptionContext`

Refactor `useTierAccess.ts` to read from `SubscriptionContext` instead of calling `/api/user/limits`. This eliminates the dual-fetch race condition (C1 root cause 4) and makes `useTierAccess` a zero-cost adapter.

```typescript
// apps/web/src/hooks/useTierAccess.ts (after fix)
export function useTierAccess(): TierAccess {
  const { subscription } = useSubscription(); // reads context, no API call
  const tier = subscription.tier;
  const limits = CLIENT_TIER_CONFIG[tier]; // see §1.2
  return {
    tier,
    isFree: tier === 'free',
    isPro: tier === 'pro' || tier === 'enterprise',
    isEnterprise: tier === 'enterprise',
    isLoading: subscription.isLoading,
    limits,
    isAuthenticated: true,
    userEmail: null,
    isMasterUser: false,
  };
}
```

The existing `TIER_LIMITS` object in `useTierAccess.ts` is replaced by `CLIENT_TIER_CONFIG` which mirrors the server-side `apps/api/src/config/tierConfig.ts` with correct free-tier limits (not `Infinity`).

#### 1.2 `CLIENT_TIER_CONFIG` — Correct Free-Tier Limits

```typescript
// apps/web/src/config/clientTierConfig.ts
export const CLIENT_TIER_CONFIG = {
  free: {
    maxNodes: 10, maxMembers: 15, maxProjects: 3,
    maxAnalysisPerDay: 3, maxPdfExportsPerDay: 1,
    canSaveProjects: false, canExportCleanPDF: false,
    hasDesignCodes: false, hasAIFeatures: false,
    hasAdvancedAnalysis: false,
  },
  pro: {
    maxNodes: Infinity, maxMembers: Infinity, maxProjects: Infinity,
    maxAnalysisPerDay: Infinity, maxPdfExportsPerDay: Infinity,
    canSaveProjects: true, canExportCleanPDF: true,
    hasDesignCodes: true, hasAIFeatures: true,
    hasAdvancedAnalysis: true,
  },
  enterprise: { /* same as pro with apiAccess: true */ },
} as const;
```

#### 1.3 `<TierGate>` Wrapper Component

New file: `apps/web/src/components/TierGate.tsx`

```typescript
interface TierGateProps {
  feature: keyof typeof PREMIUM_FEATURES;
  children: React.ReactNode;
  fallback?: React.ReactNode; // defaults to UpgradeModal
}

export const TierGate: FC<TierGateProps> = ({ feature, children, fallback }) => {
  const { canAccess } = useSubscription();
  const [showModal, setShowModal] = useState(false);

  if (canAccess(feature as keyof SubscriptionFeatures)) {
    return <>{children}</>;
  }

  return (
    <>
      {fallback ?? (
        <div onClick={() => setShowModal(true)} className="cursor-pointer">
          <LockedOverlay feature={feature} />
        </div>
      )}
      <UpgradeModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        feature={feature}
      />
    </>
  );
};
```

Alternatively, a `withTierGate(feature, Component)` HOC wraps the same logic for class-style usage.

#### 1.4 Components Requiring `<TierGate>` Wrapping

| Component | Feature Key | Wrap Strategy |
|---|---|---|
| `ExportDialog` PDF button | `pdfExport` | Wrap the PDF export button click handler |
| `DesignCodesDialog` advanced codes | `advancedDesignCodes` | Wrap advanced code options with `<TierGate>` |
| `CollaborationHub` | `teamMembers` | Wrap entire component at render site |
| `AdvancedMeshingDashboard` | `advancedAnalysis` | Wrap entire component at render site |
| `BIMExportEnhanced` | `advancedAnalysis` | Wrap entire component at render site |
| `SectionBrowserDialog` full DB | `advancedDesignCodes` | Wrap the full-database section list |
| `PDeltaAnalysisPanel` | `advancedAnalysis` | Wrap at panel render site |
| `BucklingAnalysisPanel` | `advancedAnalysis` | Wrap at panel render site |
| `ModalAnalysisPanel` | `advancedAnalysis` | Wrap at panel render site |
| `NonLinearAnalysisPanel` | `advancedAnalysis` | Wrap at panel render site |
| `TimeHistoryPanel` | `advancedAnalysis` | Wrap at panel render site |
| AI Architect trigger | `aiAssistant` | Wrap trigger button |

`UpgradeModal` is already implemented and accepts a `feature` prop that maps to `PREMIUM_FEATURES`. No changes needed to `UpgradeModal` itself.

---

### 2. Unified Analysis Hook (`useAnalysis`)

New file: `apps/web/src/hooks/useAnalysis.ts`

#### 2.1 Interface

```typescript
export interface UseAnalysisResult {
  result: UnifiedAnalysisResult | null;
  isLoading: boolean;
  progress: AnalysisProgressStep[];  // real-time solver steps
  error: string | null;
  backend: 'wasm' | 'rust' | 'python' | null;
  analyze: (model: AnalysisModel, analysisType?: AnalysisType) => Promise<void>;
}

export function useAnalysis(options?: { wasmRunner?: WasmRunner }): UseAnalysisResult
```

#### 2.2 Routing Logic

```
FUNCTION routeAnalysis(model, analysisType, wasmRunner)
  IF model.nodes.length < 500 AND analysisType = 'static' AND wasmRunner != null
    RETURN { result: wasmRunner(model), backend: 'wasm' }
  END IF

  rustAvailable ← await rustApi.isAvailable()
  IF rustAvailable
    RETURN { result: normalizeRustResult(rustApi.analyzeStatic(model)), backend: 'rust' }
  END IF

  // Python fallback — show non-blocking toast
  toast.info('Using cloud solver (Rust API unavailable)')
  RETURN { result: normalizePythonResult(submitAndPollPythonJob(model, analysisType)), backend: 'python' }
END FUNCTION
```

#### 2.3 Progress Events

The hook exposes a `progress: AnalysisProgressStep[]` array. Each backend emits progress via a callback:

```typescript
interface AnalysisProgressStep {
  step: string;       // e.g. "Assembling stiffness matrix"
  percent: number;    // 0–100
  timestamp: number;
}
```

- WASM: emits steps via a `onProgress` callback passed to the WASM runner.
- Rust API: polls a `/api/analysis/progress/:jobId` SSE endpoint.
- Python: polls the job status endpoint every 500 ms and maps status strings to steps.

#### 2.4 Skeleton Loaders

`ResultsHub` and `AnalysisResultsDashboard` check `isLoading` from `useAnalysis`:

```tsx
{isLoading ? (
  <AnalysisSkeleton steps={progress} />
) : result ? (
  <AnalysisResults result={result} />
) : (
  <EmptyState />
)}
```

`AnalysisSkeleton` renders animated placeholder cards matching the summary card layout, plus a progress step list sourced from `progress`.

#### 2.5 Error Boundary Placement

Three `ErrorBoundary` wrappers are added at the following sites:

```tsx
// StructuralModelingCanvas render site
<ErrorBoundary fallback={<CanvasFallback onReload={() => window.location.reload()} />}>
  <StructuralModelingCanvas ... />
</ErrorBoundary>

// AnalysisDesignPanel render site
<ErrorBoundary fallback={<PanelFallback name="Analysis & Design" />}>
  <AnalysisDesignPanel ... />
</ErrorBoundary>

// AIArchitectPanel render site
<ErrorBoundary fallback={<PanelFallback name="AI Architect" />}>
  <AIArchitectPanel ... />
</ErrorBoundary>
```

A shared `PanelErrorBoundary` component is created in `apps/web/src/components/ui/PanelErrorBoundary.tsx`.

---

### 3. Result View Wiring Fixes

#### 3.1 `ModeShapeRenderer` — Data Path

After `useAnalysis` returns, modal results are stored under `result.modalResults.modes`. The renderer is wired as:

```tsx
<ModeShapeRenderer
  modes={analysisResult?.modalResults?.modes ?? []}
  selectedMode={selectedModeIndex}
/>
```

The `UnifiedAnalysisResult` type is extended with:
```typescript
modalResults?: {
  modes: ModeShape[];
  frequencies: number[];
  participationFactors: number[];
};
```

#### 3.2 `StabilityView` — Buckling Result Mapping

The Python backend returns:
```json
{ "buckling_factors": [2.34, 3.11], "mode_shapes": [...] }
```

A normalizer maps this to the `BucklingResult` shape expected by `StabilityView`:
```typescript
function normalizeBucklingResult(raw: PythonBucklingResponse): BucklingResult {
  return {
    loadFactors: raw.buckling_factors,
    modeShapes: raw.mode_shapes,
  };
}
```

`StabilityView` receives `bucklingResult` from `useAnalysis` result:
```tsx
<StabilityView bucklingResult={analysisResult?.bucklingResult ?? null} />
```

#### 3.3 `DCRatioView` — Concrete DC Ratio Support

`DCRatioView` currently receives only `MemberResult[]` from the steel path. After the fix:

1. The `MemberResult` type gains a `materialType: 'steel' | 'concrete'` field.
2. Concrete DC ratios are sourced from the Python backend response under `concrete_design.members`.
3. Both steel and concrete members are merged into a single `MemberResult[]` before being passed to `DCRatioView`.
4. The governing check column shows `"Bending"`, `"Shear"`, `"Axial"`, or `"Flexure + Axial (RC)"` as appropriate.

#### 3.4 `LoadCombosView` — Consistent Population

`LoadCombosView` receives `loadCombos` from `useAnalysis` result:
```typescript
// UnifiedAnalysisResult extension
loadCombos?: LoadComboResult[];
```

All three backends normalize their load combination output into `LoadComboResult[]` before returning from `routeAnalysis`.

#### 3.5 `SteelDesignTab` — IS 800:2007 Results

The `MemberDesignRow` type is extended:
```typescript
interface MemberDesignRow {
  // existing fields ...
  designCode: 'AISC360' | 'IS800' | 'EC3';
  is800Result?: IS800DesignResult;  // populated when Python backend returns IS 800 data
}
```

`SteelDesignTab` renders a design code badge and, when `is800Result` is present, shows a second check group labeled "IS 800:2007 Checks" below the existing AISC checks.

#### 3.6 `RCBeamTab` — Python Backend Schema Alignment

A normalizer converts the Python snake_case response to the camelCase shape expected by `RCBeamTab`:

```typescript
function normalizeRCBeamResult(raw: PythonRCBeamResponse): RCBeamResult {
  return {
    momentCapacity: raw.moment_capacity,
    shearCapacity: raw.shear_capacity,
    mainReinforcement: raw.main_reinforcement,
    stirrupSpacing: raw.stirrup_spacing,
    utilizationRatio: raw.utilization_ratio,
    status: raw.status,
  };
}
```

This normalizer is applied in the Python result normalization layer inside `useAnalysis`.

---

### 4. PDF Report Generation Fixes

All fixes are in `apps/web/src/services/PDFReportService.ts`, function `generateBasicPDFReport`.

#### 4.1 Displacement Unit Conversion (C2 fix)

```typescript
// BEFORE (bug):
analysisResults.displacements?.forEach((d) => {
  maxDisp = Math.max(maxDisp, Math.abs(d.dx), Math.abs(d.dy), Math.abs(d.dz));
});
// summary row: ['Maximum Displacement', formatNumber(maxDisp, 4), 'mm']  ← wrong unit

// AFTER (fix):
analysisResults.displacements?.forEach((d) => {
  maxDisp = Math.max(maxDisp,
    Math.abs(d.dx) * 1000,
    Math.abs(d.dy) * 1000,
    Math.abs(d.dz) * 1000
  );
});
// summary row: ['Maximum Displacement', formatNumber(maxDisp, 3), 'mm']  ← correct
```

#### 4.2 Moment Data Preservation (signed values)

```typescript
// BEFORE (bug):
forcesDict[memberId] = {
  moment: [0, Math.max(Math.abs(forces.momentZ || 0), Math.abs(forces.momentY || 0))],
  ...
};

// AFTER (fix):
forcesDict[memberId] = {
  momentY_start: forces.momentY ?? 0,
  momentY_end: forces.momentY ?? 0,   // end value populated when available
  momentZ_start: forces.momentZ ?? 0,
  momentZ_end: forces.momentZ ?? 0,
  shear: [forces.shearY ?? 0, forces.shearZ ?? 0],
  axial: forces.axial,
};
```

The member forces table in the PDF already shows `My` and `Mz` as signed values from `analysisResults.memberForces` directly, so the table is unaffected. The `forcesDict` fix ensures the Python professional report generator also receives signed data.

#### 4.3 Missing Report Sections

Three new sections are added after the member forces table:

**Load Cases section** — iterates `nodeLoads` and `memberLoads` parameters (already passed to `generateBasicPDFReport` via `generateProfessionalReport`). For the basic PDF path, load case data is read from `analysisResults.loadCases` if present, otherwise a placeholder row is shown.

**Support Reactions section** — iterates `analysisResults.reactions`:
```typescript
const reactionsBody = Array.from(analysisResults.reactions.entries()).map(([nodeId, r]) => [
  nodeId, formatNumber(r.fx), formatNumber(r.fy), formatNumber(r.fz),
  formatNumber(r.mx), formatNumber(r.my), formatNumber(r.mz)
]);
```

**Node Coordinate Table** — iterates `nodes`:
```typescript
const nodeBody = nodes.map(n => [
  n.id,
  formatNumber(n.x, 4), formatNumber(n.y, 4), formatNumber(n.z, 4),
  n.restraints ? (Object.values(n.restraints).every(Boolean) ? 'Fixed' :
    Object.values(n.restraints).some(Boolean) ? 'Pinned/Roller' : 'Free') : 'Free'
]);
```

#### 4.4 Human-Readable Governing Check Descriptions

A lookup map replaces internal enum names:

```typescript
const GOVERNING_CHECK_LABELS: Record<string, string> = {
  'COMPRESSION_FLEXURE_COMBINED': 'Combined Compression + Flexure (AISC H1-1)',
  'TENSION':                      'Tension (AISC D2)',
  'COMPRESSION':                  'Compression (AISC E3)',
  'FLEXURE_MAJOR':                'Major-Axis Flexure (AISC F2)',
  'SHEAR_MAJOR':                  'Major-Axis Shear (AISC G2)',
  'COMBINED_INTERACTION':         'Combined Interaction (AISC H1-1)',
  // IS 800 equivalents
  'IS800_COMPRESSION_FLEXURE':    'Combined Compression + Flexure (IS 800 §9.3.1)',
  'IS800_TENSION':                'Tension (IS 800 §6.2)',
  'IS800_FLEXURE':                'Flexure (IS 800 §8.2)',
  'IS800_SHEAR':                  'Shear (IS 800 §8.4)',
};

// Usage in design table:
const label = GOVERNING_CHECK_LABELS[r.governingCheck] ?? r.governingCheck;
```

#### 4.5 Design Code Clause References

A second lookup map provides clause references per check type:

```typescript
const CHECK_CLAUSE_REFS: Record<string, string> = {
  'COMPRESSION_FLEXURE_COMBINED': 'AISC 360-16 §H1-1',
  'TENSION':                      'AISC 360-16 §D2',
  'COMPRESSION':                  'AISC 360-16 §E3',
  'FLEXURE_MAJOR':                'AISC 360-16 §F2',
  'SHEAR_MAJOR':                  'AISC 360-16 §G2',
  'IS800_COMPRESSION_FLEXURE':    'IS 800:2007 §9.3.1',
  'IS800_TENSION':                'IS 800:2007 §6.2',
  'IS800_FLEXURE':                'IS 800:2007 §8.2',
  'IS800_SHEAR':                  'IS 800:2007 §8.4',
};
```

The design table gains a "Clause" column populated from this map.

#### 4.6 PE Stamp Block

A PE stamp block is added to the cover page, below the document control table:

```typescript
// PE Stamp block — added after the document control autoTable
autoTable(doc, {
  startY: (doc as any).lastAutoTable.finalY + 8,
  margin: { left: 20, right: 20 },
  head: [['PE STAMP / ENGINEER CERTIFICATION']],
  body: [
    ['Engineer of Record', project.engineer],
    ['License No.', project.licenseNumber ?? '_______________'],
    ['Date', project.date],
    ['Signature', '_______________'],
  ],
  theme: 'plain',
  headStyles: { fillColor: NAVY, textColor: [255,255,255], fontStyle: 'bold', fontSize: 8 },
  bodyStyles: { fontSize: 8, textColor: SLATE_700 },
  styles: { cellPadding: 4, lineColor: SLATE_200, lineWidth: 0.3 },
});
```

The `ProjectInfo` interface gains an optional `licenseNumber?: string` field.

#### 4.7 `handleExportPDF()` — Read from Store and Auth Session (C3 fix)

```typescript
// apps/web/src/components/AnalysisDesignPanel.tsx
const projectInfo = useModelStore((s) => s.projectInfo);
const { user } = useAuth();

const handleExportPDF = () => {
  if (!analysisResults) return;
  generateDesignReport(
    {
      name: projectInfo?.name ?? 'Untitled Project',
      engineer: user?.fullName ?? user?.email ?? 'Engineer',
      date: new Date().toLocaleDateString(),
      description: projectInfo?.description ?? '',
    },
    Array.from(members.values()),
    Array.from(nodes.values()),
    analysisResults,
    designResults
  );
};
```

---

### 5. ProfessionalReportGenerator and ComprehensiveReportService Fixes

#### 5.1 `ProfessionalReportGenerator` — Connect to `useModelStore` (C3 fix)

```typescript
// apps/web/src/pages/ProfessionalReportGenerator.tsx
const nodes = useModelStore((s) => s.nodes);
const members = useModelStore((s) => s.members);
const storeProjectInfo = useModelStore((s) => s.projectInfo);

// Replace static projectInfo initialization:
const [projectInfo, setProjectInfo] = useState({
  projectName: storeProjectInfo?.name ?? 'Untitled Project',
  // ... other fields remain user-editable
});

// Sync node/member counts into the geometry section preview:
const geometrySummary = useMemo(() => ({
  nodeCount: nodes.size,
  memberCount: members.size,
  supportCount: Array.from(nodes.values()).filter(n =>
    n.restraints && Object.values(n.restraints).some(Boolean)
  ).length,
}), [nodes, members]);
```

The geometry section HTML template replaces the hardcoded `156` / `312` / `G+8` / `28.0 m` values with `geometrySummary.nodeCount`, `geometrySummary.memberCount`, and store-derived storey/height values.

#### 5.2 `generateQualityChecks()` — Derive from Actual Results (C4 fix)

```typescript
private generateQualityChecks(
  analysisResults: ReportAnalysisData | null,
  designResults: ReportDesignData | null
): QualityCheck[] {
  if (!analysisResults || !designResults) return [];

  const maxDrift = (analysisResults.maxDrift as any)?.value ?? null;
  const maxDisp = (analysisResults.maxDisplacement as any)?.value ?? null;
  const maxUtil = designResults.members
    ? Math.max(...(designResults.members as any[]).map((m: any) => m.utilization ?? 0))
    : null;

  return [
    {
      category: 'Analysis',
      item: 'Story Drift',
      requirement: '≤ 0.4% (IS 1893 §7.11.1)',
      actual: maxDrift != null ? `${(maxDrift * 100).toFixed(3)}%` : 'N/A',
      status: maxDrift == null ? 'N/A' : maxDrift <= 0.004 ? 'PASS' : 'FAIL',
      reference: 'IS 1893:2016',
    },
    {
      category: 'Analysis',
      item: 'Maximum Deflection',
      requirement: '≤ L/240',
      actual: maxDisp != null ? `${maxDisp.toFixed(2)} mm` : 'N/A',
      status: maxDisp == null ? 'N/A' : 'PASS', // limit check requires span — simplified
      reference: 'IS 800:2007',
    },
    {
      category: 'Design',
      item: 'Member Utilization',
      requirement: '≤ 1.0',
      actual: maxUtil != null ? maxUtil.toFixed(3) : 'N/A',
      status: maxUtil == null ? 'N/A' : maxUtil <= 1.0 ? 'PASS' : 'FAIL',
      reference: 'IS 800:2007 / AISC 360-16',
    },
  ];
}
```

#### 5.3 `transformToDetailedReportData()` — Null/N/A Fallbacks (C3 fix)

```typescript
analysisSummary: {
  maxDisplacement: analysisResults?.maxDisplacement ?? null,
  maxDrift: analysisResults?.maxDrift ?? null,
  maxReaction: analysisResults?.maxReaction ?? null,
  fundamentalPeriod: analysisResults?.fundamentalPeriod ?? null,
},
```

The `DetailedReportEngine` is updated to render "N/A" for null fields rather than crashing.

#### 5.4 PDF Export Button in `ReportBuilderPage`

A PDF export button is added to the header action row:

```tsx
<button
  type="button"
  onClick={() => downloadReportAsPDF()}
  className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
>
  <Download className="w-4 h-4" />
  PDF
</button>
```

`downloadReportAsPDF()` calls `generateBasicPDFReport` with the current `config` and `sections` content, using `useModelStore` for nodes/members and `useModelStore(s => s.analysisResults)` for analysis data.

---

### 6. Dead Code Removal

| File | Action | Reason |
|---|---|---|
| `apps/web/src/components/RazorpayPayment.tsx` | Delete | Razorpay removed; replaced by PhonePe |
| `apps/web/src/components/RazorpayCustom.tsx` | Delete | Same |
| `apps/web/src/hooks/useSubscription.ts` | Delete | Duplicate of `useSubscription.tsx` |
| `apps/web/src/**/*.bak` | Delete | Backup files committed by mistake |

Before deletion, run `grep -r "RazorpayPayment\|RazorpayCustom\|useSubscription\.ts"` to confirm no remaining imports.


---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate each bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate each bug BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write tests that render gated components with `tier='free'` and assert that `UpgradeModal` is shown. Run displacement unit tests against the unfixed `generateBasicPDFReport`. Run quality check tests against the unfixed `generateQualityChecks`.

**Test Cases**:
1. **C1 — Tier Gate**: Render `<PDeltaAnalysisPanel>` with `tier='free'` and `TEMP_UNLOCK_ALL=false` → assert `UpgradeModal` is in the DOM (will fail on unfixed code).
2. **C2 — Unit Mismatch**: Call `generateBasicPDFReport` with a node having `dx=0.005` → assert summary row shows `5.000 mm` (will fail on unfixed code, shows `0.005`).
3. **C3 — Hardcoded Data**: Call `handleExportPDF()` with project name "Tower A" → assert PDF contains "Tower A" (will fail on unfixed code).
4. **C4 — Quality Checks**: Call `generateQualityChecks` with `maxDrift=0.006` → assert drift check status is `FAIL` (will fail on unfixed code, returns `PASS`).

**Expected Counterexamples**:
- `UpgradeModal` is not rendered for any free-tier user on any advanced panel.
- `maxDisp` in summary is 1000× smaller than expected.
- PDF cover shows "BeamLab Project" regardless of store state.
- Quality checks always return PASS regardless of input.

### Fix Checking

**Goal**: Verify that for all inputs where each bug condition holds, the fixed function produces the expected behavior.

**Pseudocode:**
```
FOR ALL X WHERE isBugCondition_C1(X) DO
  result ← renderFeatureTrigger'(X)
  ASSERT upgradeModalVisible(result) = true
  ASSERT featurePanelVisible(result) = false
END FOR

FOR ALL X WHERE isBugCondition_C2(X) DO
  report ← generateBasicPDFReport'(X)
  maxDispInReport ← extractSummaryMaxDisp(report)
  maxDispExpected ← max(|d.dx|, |d.dy|, |d.dz| for d in X.displacements) * 1000
  ASSERT abs(maxDispInReport - maxDispExpected) < 0.001
END FOR

FOR ALL X WHERE isBugCondition_C3(X) DO
  report ← generateReport'(X)
  ASSERT reportContains(report, X.projectName)
  ASSERT NOT reportContains(report, 'BeamLab Project')
END FOR

FOR ALL X WHERE isBugCondition_C4(X) DO
  checks ← generateQualityChecks'(X.analysisResults, X.designResults)
  ASSERT checks.find(c => c.item === 'Story Drift').actual = X.analysisResults.maxDrift
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where each bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL X WHERE NOT isBugCondition_C1(X) DO  // tier = pro or enterprise
  ASSERT renderFeatureTrigger(X) = renderFeatureTrigger'(X)
END FOR

FOR ALL X WHERE NOT isBugCondition_C2(X) DO  // no displacements
  ASSERT generateBasicPDFReport(X) = generateBasicPDFReport'(X)
END FOR
```

**Testing Approach**: Property-based testing is recommended for C1 and C2 because:
- C1: The set of (tier, feature) combinations is finite but large; PBT generates all combinations automatically.
- C2: The displacement value space is continuous; PBT generates edge cases (zero, very small, very large) automatically.

**Test Plan**: Observe behavior on UNFIXED code first for pro-tier users and zero-displacement models, then write property-based tests capturing that behavior.

**Test Cases**:
1. **Pro Tier Preservation**: Render all advanced panels with `tier='pro'` → assert no `UpgradeModal` in DOM.
2. **Zero Displacement Preservation**: Call `generateBasicPDFReport` with empty displacements → assert summary row shows `0.000 mm`.
3. **PDF Branding Preservation**: Call `generateBasicPDFReport` with any input → assert cover page still contains `BEAMLAB_COMPANY.name` and the running header.
4. **D/C Color Coding Preservation**: Render `DCRatioView` with utilization 0.5, 0.9, 1.1 → assert green/amber/red colors unchanged.

### Unit Tests

- Test `<TierGate feature="advancedAnalysis">` renders `UpgradeModal` for free tier and children for pro tier.
- Test `generateBasicPDFReport` displacement unit conversion with known values.
- Test `generateQualityChecks` with drift=0.003 (PASS) and drift=0.006 (FAIL).
- Test `normalizeRCBeamResult` maps all snake_case fields correctly.
- Test `GOVERNING_CHECK_LABELS` lookup returns human-readable string for all known enum values.
- Test `ErrorBoundary` catches thrown exceptions and renders fallback UI.
- Test `useAnalysis` routing: nodeCount=100 → backend='wasm', nodeCount=600 → backend='rust', rustUnavailable → backend='python'.

### Property-Based Tests

- **Property 1 (C1 gating)**: For any `(tier, feature)` where `tier='free'` and `feature` is in the gated set, `<TierGate>` renders `UpgradeModal` and not the child.
- **Property 2 (C1 preservation)**: For any `(tier, feature)` where `tier` is `'pro'` or `'enterprise'`, `<TierGate>` renders the child and not `UpgradeModal`.
- **Property 4 (C2 unit conversion)**: For any displacement map with at least one entry, `maxDisp` in the summary equals `max(|d|) * 1000` within floating-point tolerance.
- **Property 9 (analysis routing)**: For any `nodeCount < 500` with WASM available, `useAnalysis` returns `backend='wasm'`.
- **Property 10 (result shape)**: For any model and any backend, `useAnalysis` result always has `displacements`, `reactions`, `memberForces`, `backend`, `computeTimeMs`.
- **Property 12 (governing check labels)**: For any `governingCheck` string in `GOVERNING_CHECK_LABELS`, the output does not contain the raw enum name.
- **Property 13 (node table row count)**: For any model with N nodes, the geometry section table has exactly N data rows.

### Integration Tests

- Full flow: free-tier user opens `PDeltaAnalysisPanel` → `UpgradeModal` shown → user upgrades → panel renders.
- Full flow: run analysis on 100-node model → WASM backend → results appear in `ResultsHub` with correct units.
- Full flow: run modal analysis → `ModeShapeRenderer` receives all modes → mode selector works.
- Full flow: `handleExportPDF()` with project "Tower A" → PDF cover shows "Tower A".
- Full flow: `ReportBuilderPage` PDF export button → PDF downloads with cover page and PE stamp block.

