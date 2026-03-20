# Implementation Plan: BeamLab Platform Refinement

## Overview

Verification, polish, and gap-closure across the full BeamLab Ultimate platform. All major
features are implemented across prior specs. This plan focuses on confirming correctness,
fixing the user-reported house plan generator inaccuracy (top priority), and closing
remaining gaps in UI polish, analysis routing, reports, tier gating, and backend validation.

Tasks reference existing implementations — do not re-implement what is already done; only
verify and fix gaps.

## Tasks

- [x] 1. House Plan Generator — Investigate and fix architectural placement pipeline
  - Audit `SpacePlanningEngine.architecturalPlacement()` call site in `generateFloorPlan()`:
    confirm the `roomsWithMandatory.length >= 2` guard routes to `architecturalPlacement`
    and not the legacy `placeRooms()` for all standard house programs.
  - Verify `buildCirculationSpine()` places the corridor as the first element in `placed[]`
    with `corridorRoom.width >= 1.0` before any habitable room is positioned.
  - Verify `enforceNBCMinDimensions()` is called inside `placePublicZone`, `placeWetAreas`,
    and `placePrivateZone` before computing room coordinates; confirm `NBC_MIN_DIMS` values
    match the spec (living 3.0×3.0, bedroom 2.7×2.7, kitchen 2.1×1.8, bathroom 1.2×0.9,
    toilet 1.0×0.9, corridor 1.0×1.0, foyer 1.5×1.5).
  - Verify `placeWetAreas()` sets `context.wetWallX`/`wetWallY` after the first wet room and
    that all subsequent wet rooms are placed touching that same wall coordinate.
  - Verify `validateEntranceSequence()` is called after placement and returns `true` for any
    plan with living rooms and bedrooms on a south-facing plot.
  - Fix any failing step found above in `SpacePlanningEngine.ts`.
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8_

  - [ ]* 1.1 Write property test for zone separation (P1)
    - **Property 1: House Plan Zone Separation**
    - For any input with ≥1 bedroom and ≥1 living room, every bedroom's
      `distanceFromEntrance` must be strictly greater than the living room's.
    - Use `fc.record` to generate random plot sizes (5–20 m) and room programs.
    - **Validates: Requirements 4.1, 4.5**

  - [ ]* 1.2 Write property test for circulation spine (P2)
    - **Property 2: House Plan Circulation Spine**
    - For any input with ≥3 habitable rooms, the output must contain a corridor room
      with `width >= 1.0` and every habitable room must share a wall with it.
    - **Validates: Requirement 4.2**

  - [ ]* 1.3 Write property test for NBC minimum dimensions (P3)
    - **Property 3: NBC Minimum Dimensions**
    - For any `FloorPlanGenerationInput`, every placed room must satisfy
      `room.width >= NBC_MIN_DIMS[room.type].w` and `room.height >= NBC_MIN_DIMS[room.type].h`.
    - **Validates: Requirement 4.4**

  - [ ]* 1.4 Write property test for wet area grouping (P24)
    - **Property 24: Wet Area Grouping**
    - For any input containing a kitchen or bathroom, every wet area must share an
      internal wall with at least one other wet area (unless geometrically impossible).
    - **Validates: Requirement 4.3**

  - [ ]* 1.5 Write property test for boundary enforcement preservation (P16)
    - **Property 16: Boundary Enforcement Preservation**
    - For any input, every `PlacedRoom` must satisfy all four setback constraints.
    - **Validates: Requirement 4.8**

- [-] 2. House Plan Generator — Multi-floor and plot orientation accuracy
  - Verify `generateFloorPlan(floor > 0)` filters room specs to the correct floor and
    auto-injects parking only on floor 0.
  - Verify upper-floor column positions align with ground-floor columns within 0.15 m
    (`generateStructuralPlan` grid snapping).
  - Verify East/West-facing plots rotate entrance-side logic so the foyer lands on the
    road-facing boundary.
  - Verify corner-plot logic applies reduced setbacks on the secondary road side.
  - Verify plots narrower than 6 m produce a single-loaded corridor layout and record a
    constraint note in `FloorPlan.constraintViolations`.
  - Fix any gaps found in `SpacePlanningEngine.ts`.
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [~] 3. House Plan Generator — Round-trip serialization
  - Verify `projectSerializer.ts` (or equivalent) serializes and deserializes a
    `HousePlanProject` without data loss for all `PlacedRoom` coordinates and MEP fixtures.
  - Verify malformed JSON input returns a descriptive error rather than a partial object.
  - Fix any gaps found.
  - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 3.1 Write property test for round-trip serialization (P4)
    - **Property 4: House Plan Round-Trip Serialization**
    - For all valid `HousePlanProject` objects P, `deserialize(serialize(P))` must produce
      identical `x`, `y`, `width`, `height` on every `PlacedRoom` and identical `x`, `y`,
      `roomId` on every MEP fixture.
    - **Validates: Requirements 6.2, 6.3**

- [~] 4. Checkpoint — House plan generator tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [~] 5. Design system — shared token set and component consistency
  - Audit all pages (LandingPage, Dashboard, SpacePlanningPage, ModernModeler,
    ReportBuilderPage, DetailingDesignPage, PricingPage, all modal dialogs) for inline
    color/spacing/radius values that bypass the shared token set.
  - Replace any hardcoded values with the canonical CSS variables or Tailwind tokens
    (`--color-primary`, `--color-surface`, `--color-border`, `--radius-md`, etc.).
  - Verify all interactive controls (buttons, inputs, selects, checkboxes, sliders,
    tooltips) share the same visual style across pages.
  - _Requirements: 1.1, 1.3_

- [~] 6. Design system — loading, error, and empty states
  - Audit every data-fetching component for missing skeleton/spinner, inline error, and
    empty-state handling.
  - Implement the `if (isLoading) / if (error) / if (!data)` pattern in any component
    that currently renders a blank panel or throws on missing data.
  - Verify CSS transitions (150–300 ms) are applied to panel open/close, modal
    appear/dismiss, and tab switching.
  - _Requirements: 1.4, 1.5, 1.6, 1.7_

- [~] 7. Accessibility baseline
  - Add visible focus rings to all interactive elements that are currently missing them.
  - Add `alt` / `aria-label` to all meaningful images and icons.
  - Implement focus trap in all modal dialogs (return focus to trigger on close).
  - Verify logical tab order on Dashboard, SpacePlanningPage, ModernModeler,
    ReportBuilderPage, and DetailingDesignPage.
  - Associate all form inputs with `<label>` or `aria-labelledby`.
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [~] 8. Navigation and information architecture
  - Verify Dashboard sidebar has all five sections: My Projects, Space Planning,
    Structural Modeler, Reports, Account Settings.
  - Add breadcrumb / back-navigation control to all non-Dashboard pages.
  - Verify user name, avatar, and subscription tier badge appear in the top nav bar on
    all authenticated pages.
  - Implement session-expiry redirect that preserves the destination URL in a query param.
  - Add persistent upgrade banner for free-tier users on the Dashboard.
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [~] 9. Analysis pipeline — end-to-end routing verification
  - Audit `useAnalysisRouter.ts` (or `useAnalysis.ts`) routing logic:
    confirm `nodeCount < 500 && analysisType === 'static'` routes to WASM,
    `nodeCount >= 500` routes to Rust_API, and Rust unavailable falls through to Python_API.
  - Verify the fallback chain: WebGPU error → `serverFallbackAvailable: true`;
    WASM failure → Rust_API; Rust unavailable → Python_API toast; Python timeout → retry button.
  - Verify `AnalysisResult` shape is normalized identically across all backends.
  - Fix any routing gaps found.
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

  - [ ]* 9.1 Write property test for analysis routing by node count (P5)
    - **Property 5: Analysis Routing by Node Count**
    - Models with `nodeCount < 500` and `analysisType === 'static'` must route to WASM;
      models with `nodeCount >= 500` must route to Rust_API when available.
    - Use `fc.integer` to generate node counts in both ranges.
    - **Validates: Requirements 7.1, 7.2**

  - [ ]* 9.2 Write property test for analysis result shape invariant (P6)
    - **Property 6: Analysis Result Shape Invariant**
    - For any valid `AnalysisModel`, the result must always contain `displacements`,
      `reactions`, `memberForces`, `backend`, and `computeTimeMs` regardless of backend.
    - **Validates: Requirement 7.5**

  - [ ]* 9.3 Write property test for local compute quota exemption (P21)
    - **Property 21: Local Compute Does Not Consume Server Quota**
    - For any job with `computeMode: 'local'`, `computeUnitsCharged` must be 0 and
      `GET /api/user/quota` must return the same `computeUnitsRemaining` before and after.
    - **Validates: Requirements 7.1 (local path), 12.8**

- [~] 10. Analysis pipeline — advanced analysis types and result field mapping
  - Verify `LoadCombosView` populates all combination result rows from the analysis result.
  - Verify `DCRatioView` displays utilization ratios for both steel (Rust/WASM) and
    concrete (Python) members.
  - Verify `SteelDesignTab` renders results for AISC 360-16 and IS 800:2007 when present.
  - Verify `RCBeamTab` correctly maps all fields from the Python response schema to UI fields.
  - Fix any undefined/null field mapping gaps.
  - _Requirements: 8.5, 8.6, 8.7, 8.8_

  - [ ]* 10.1 Write property test for analysis result field mapping (P23)
    - **Property 23: Analysis Result Field Mapping**
    - For any result object from any backend, all fields consumed by LoadCombosView,
      DCRatioView, SteelDesignTab, and RCBeamTab must be non-null/undefined when the
      result contains valid data.
    - **Validates: Requirements 8.5, 8.6, 8.7, 8.8**

- [~] 11. Checkpoint — Analysis pipeline tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [~] 12. Report generation — data accuracy fixes
  - Fix `handleExportPDF()` to read `projectName` from the active project store and
    `engineerName` from the auth session instead of hardcoded strings.
  - Fix `generateBasicPDFReport` to convert max displacement `* 1000` to mm with unit
    label "mm", and to preserve signed `momentY`/`momentZ` values.
  - Add load cases section, support reactions section, and node displacement table to
    `generateBasicPDFReport`.
  - Add node coordinate table (node ID, X, Y, Z, support condition) to
    `generateBasicPDFReport`.
  - Add human-readable check descriptions and code clause references to the steel design
    section (e.g., "Combined Compression + Flexure — AISC 360-16 §H1-1").
  - Fix `ProfessionalReportGenerator` to read node count, member count, storey count, and
    total height from `useModelStore` instead of hardcoded placeholders.
  - Fix `generateQualityChecks()` to derive pass/fail from actual `analysisResults` and
    `designResults` (real drift, deflection, utilization ratios).
  - Fix `transformToDetailedReportData()` to use `null`/`"N/A"` for all result fields when
    `analysisResults` is not provided.
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_

  - [ ]* 12.1 Write property test for report using actual project data (P7)
    - **Property 7: Report Uses Actual Project Data**
    - For any `(projectName, engineerName)` pair of non-empty strings, the generated PDF
      must contain both values and must NOT contain the literal strings "BeamLab Project"
      or "Engineer" as hardcoded fallbacks.
    - **Validates: Requirements 9.1, 9.6**

  - [ ]* 12.2 Write property test for displacement unit conversion (P8)
    - **Property 8: Displacement Unit Conversion**
    - For any analysis result with displacements in metres, the summary row value must
      equal `max(|dx|, |dy|, |dz|) * 1000` with absolute error < 0.001 mm.
    - **Validates: Requirement 9.2**

  - [ ]* 12.3 Write property test for quality checks reflecting actual results (P9)
    - **Property 9: Quality Checks Reflect Actual Results**
    - For any `(analysisResults, designResults)` pair where both are non-null,
      `generateQualityChecks` output must have `driftCheck.actual === analysisResults.maxDrift`
      and `deflectionCheck.actual === analysisResults.maxDisplacement`.
    - **Validates: Requirement 9.7**

- [~] 13. Report generation — export completeness
  - Verify `ReportBuilderPage` has a PDF export button that generates and downloads a PDF.
  - Verify all professional reports include a PE stamp block (engineer name, license no.,
    date, signature line).
  - Implement the DetailingDesignPage HTML report: compile self-contained HTML with inline
    CSS containing project name, date, design code, summary table (member ID, type, section,
    Utilization_Ratio, pass/fail), and individual design calculation sheets; open in new
    window and trigger `window.print()`.
  - Show "Generate Report" button on DetailingDesignPage when at least one member is designed.
  - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

  - [ ]* 13.1 Write property test for report completeness (P22)
    - **Property 22: Report Completeness**
    - For any analysis results, the generated PDF must contain a load cases section,
      support reactions section, node displacement table, node coordinate table, and PE
      stamp block, with no hardcoded placeholder values.
    - **Validates: Requirements 9.4, 10.2, 10.3**

- [~] 14. Checkpoint — Report generation tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [~] 15. Tier gating and subscription UI
  - Audit all Pro-only features (advanced analysis types, PDF export, AI Architect,
    advanced design codes, collaboration, BIM export, advanced meshing) and confirm each
    is wrapped in `<TierGate>`.
  - Verify `SubscriptionProvider.canAccess()` reads from `localStorage` cached tier when
    `subscription.isLoading === true` (stale-while-revalidate).
  - Verify only one API call to `/api/user/subscription` is made per session; all
    components read from context.
  - Fix any missing `TierGate` wrappers or extra API calls found.
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_

  - [ ]* 15.1 Write property test for tier gating consistency (P10)
    - **Property 10: Tier Gating Consistency**
    - For any feature F where `TIER_CONFIG[tier][F]` is false/0, a user of that tier must
      see the UpgradeModal and NOT the feature panel; Pro/Enterprise must see the feature panel.
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.6**

  - [ ]* 15.2 Write property test for canAccess stale-while-revalidate (P11)
    - **Property 11: canAccess Stale-While-Revalidate**
    - When `subscription.isLoading === true` and a cached tier T is in localStorage,
      `canAccess(F)` must return `TIER_CONFIG[T][F]` rather than `false`.
    - **Validates: Requirement 11.4**

- [~] 16. User data management
  - Verify auto-save fires at intervals ≤ 60 seconds and writes unsaved state to
    `localStorage` under `beamlab:unsaved:{projectId}` on network failure with exponential
    backoff retry.
  - Verify Favorites tab query returns only `isFavorited === true AND deletedAt === null`.
  - Verify Trash tab query returns only `deletedAt !== null`.
  - Verify default "My Projects" query excludes soft-deleted projects.
  - Verify profile page displays current tier, remaining daily quota, and account creation date.
  - Fix any gaps found.
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_

  - [ ]* 16.1 Write property test for project filter invariants (P12)
    - **Property 12: Project Filter Invariants**
    - For any collection of projects with mixed `isFavorited` and `deletedAt` values,
      each tab query must return only the correct subset.
    - **Validates: Requirements 12.4, 12.5, 12.6**

- [~] 17. Collaboration features
  - Verify invite → accept → revoke lifecycle: accepted collaborator gets HTTP 200 on
    project GET; after revocation gets HTTP 403.
  - Verify invite to unknown email returns HTTP 404 with "No account found for that email address."
  - Verify free-tier CollaborationHub is wrapped in `TierGate` showing upgrade prompt.
  - Fix any gaps found in collaboration routes.
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

  - [ ]* 17.1 Write property test for collaboration access control (P25)
    - **Property 25: Collaboration Access Control**
    - For any project and accepted collaborator, HTTP 200 on GET; after revocation HTTP 403.
    - **Validates: Requirements 13.2, 13.3**

- [~] 18. Checkpoint — Tier gating, user data, and collaboration tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [~] 19. Space planning — end-to-end verification
  - Verify SpacePlanningPage loads the floor plan canvas, room list, and constraint report
    without errors or blank panels.
  - Verify CSP solver progress indicator renders during solve and updates the canvas on completion.
  - Verify optimization tab: Pareto front scatter plot renders when two objectives are selected;
    convergence chart updates in real time (≤ every 5 iterations).
  - Verify "Apply to Model" button updates member section IDs in the model store.
  - Verify elevations tab draws building outline to scale with dimension lines.
  - Fix any gaps found.
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.8_

  - [ ]* 19.1 Write property test for Pareto front non-dominance (P17)
    - **Property 17: Pareto Front Non-Dominance**
    - For any set of optimization solutions S, no solution in the computed Pareto front
      must be strictly dominated by another solution in the same front.
    - **Validates: Requirement 14.3**

- [~] 20. Modeling tools — STAAD.Pro parity verification
  - Verify all 23 tool IDs are registered in the toolbar and each opens its dialog/panel
    via `openModal`.
  - Verify analysis result tools (VIEW_STORY_DRIFT, VIEW_FORCE_ENVELOPE,
    VIEW_SECTION_FORCES, ANIMATE_MODE_SHAPE) show "analysis must be completed first"
    notification when no analysis has been run.
  - Verify ASSIGN_MASTER_SLAVE shows an error notification when fewer than two nodes are selected.
  - Verify Structure Wizard includes all five truss templates (Fink, North Light, King Post,
    Queen Post, Scissors) and Cylindrical Frame and Spherical Surface templates.
  - Verify Design Codes configuration includes all additional international codes
    (GB50017, BS5950, AIJ, SNIP, AASHTO_LRFD, AA_ADM1, CSA_A23, SP52101, IS13920, EC5).
  - Fix any missing tool registrations or dialog wiring.
  - _Requirements: 15.1, 15.2, 15.5, 15.6, 15.7_

  - [ ]* 20.1 Write property test for dialog validation (P18)
    - **Property 18: Dialog Validation Rejects Out-of-Range Values**
    - For any partial moment release factor outside 0.001–0.999, or property reduction
      factor outside 0.01–1.00, the dialog must show a validation error and not save.
    - Use `fc.float` to generate out-of-range values.
    - **Validates: Requirements 15.3, 15.4**

- [~] 21. Error boundaries and resilience
  - Verify `PanelErrorBoundary` wraps `StructuralModelingCanvas` (Three.js) and renders
    "Reload Canvas" fallback on uncaught exception.
  - Verify `PanelErrorBoundary` wraps `AnalysisDesignPanel` and `AIArchitectPanel`.
  - Verify `PanelErrorBoundary` wraps `SpacePlanningPage` and its child panels with a
    "Reload" button fallback.
  - Verify WASM solver failure falls through to Rust_API without surfacing an unhandled
    exception.
  - Verify Python_API timeout (> 2 min) surfaces a descriptive error with a retry button.
  - Add any missing `ErrorBoundary` wrappers.
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

- [~] 22. Backend health endpoints
  - Verify `GET /health` on Rust_API returns `{ "status": "ok", "version": "<semver>" }`
    with HTTP 200.
  - Verify `GET /health` on Python_API returns `{ "status": "ok", "version": "<semver>" }`
    with HTTP 200.
  - Verify `GET /health` on Node_API returns `{ "status": "ok", "version": "<semver>",
    "db": "connected" | "disconnected" }` with HTTP 200 when healthy and HTTP 503 when DB
    is unreachable.
  - Add any missing health endpoints.
  - _Requirements: 17.1, 17.2, 17.3_

- [~] 23. Backend input validation
  - Verify `validateBody` Zod middleware is applied to all POST and PATCH routes in
    Node_API; confirm HTTP 400 with `{ error: 'VALIDATION_ERROR', fields: [...] }` on failure.
  - Verify Python_API Pydantic validators reject models with node coordinates > ±10,000 m,
    load magnitudes > 1×10⁹ kN, or members referencing non-existent node IDs.
  - Verify Node_API analysis proxy enforces per-tier model size limits before forwarding
    (free ≤ 100 nodes, pro ≤ 2,000 nodes, enterprise ≤ 10,000 nodes) and returns HTTP 400
    with `MODEL_TOO_LARGE` when exceeded.
  - Fix any missing middleware or validator coverage.
  - _Requirements: 17.4, 17.5, 17.6_

  - [ ]* 23.1 Write property test for Node_API body validation (P19)
    - **Property 19: Node_API Body Validation**
    - For any POST/PATCH request body that fails Zod schema validation, the API must
      return HTTP 400 with `{ error: 'VALIDATION_ERROR', fields: [...] }` and not execute
      handler logic.
    - **Validates: Requirement 17.4**

  - [ ]* 23.2 Write property test for per-tier model size enforcement (P20)
    - **Property 20: Per-Tier Model Size Enforcement**
    - For any analysis request where node count exceeds the tier limit, the Node_API proxy
      must return HTTP 400 with `MODEL_TOO_LARGE` before forwarding to any backend.
    - **Validates: Requirement 17.6**

- [~] 24. Payment and billing integrity
  - Verify PhonePe webhook handler checks `phonepeMerchantTransactionId` for duplicates
    before processing and returns HTTP 200 without modifying any record on duplicate.
  - Verify checkout route derives `amount` exclusively from
    `BILLING_PLANS[planId].amountPaise` and rejects any client-provided `amount` field.
  - Verify `TierChangeLog` record is written on every tier change with `userId`, `fromTier`,
    `toTier`, `reason`, `timestamp`, and `transactionId`.
  - Verify checkout with an invalid `planId` returns HTTP 400.
  - Fix any gaps found in billing routes.
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

  - [ ]* 24.1 Write property test for payment idempotency (P13)
    - **Property 13: Payment Idempotency**
    - Processing the same `phonepeMerchantTransactionId` twice must produce the same
      database state as processing it once — no duplicate Subscription records.
    - **Validates: Requirement 18.1**

  - [ ]* 24.2 Write property test for payment amount server-side derivation (P14)
    - **Property 14: Payment Amount Server-Side Derivation**
    - For any valid `planId`, `BILLING_PLANS[planId].amountPaise > 0` and
      `durationDays > 0`; the checkout route must use this value regardless of any
      client-provided amount.
    - **Validates: Requirements 18.2, 18.4**

  - [ ]* 24.3 Write property test for invalid plan IDs returning HTTP 400 (P15)
    - **Property 15: Invalid Plan IDs Return HTTP 400**
    - For any string not in `{pro_monthly, pro_yearly, business_monthly, business_yearly}`,
      the checkout endpoint must return HTTP 400.
    - **Validates: Requirement 18.5**

- [~] 25. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP.
- All tasks reference existing implementations — verify and fix gaps only; do not re-implement.
- Property tests use **fast-check** (TypeScript frontend/Node backend) with minimum 100 iterations.
- Checkpoints ensure incremental validation after each major area.
- Top priority is Task 1 (house plan generator) — user-reported critical bug.
