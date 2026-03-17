# Implementation Plan

- [*] 1. Write bug condition exploration tests (BEFORE implementing any fix)
  - **Property 1: Bug Condition** - C1 Tier Gate, C2 Unit Mismatch, C3 Hardcoded Data, C4 Quality Checks
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **GOAL**: Surface counterexamples that demonstrate each bug exists
  - **Scoped PBT Approach**: Scope each property to the concrete failing case(s) for reproducibility
  - C1 — Render `<PDeltaAnalysisPanel>` with `tier='free'` and `TEMP_UNLOCK_ALL=false`; assert `UpgradeModal` is in the DOM (from Bug Condition C1 in design)
  - C2 — Call `generateBasicPDFReport` with a node having `dx=0.005 m`; assert summary row shows `5.000 mm` not `0.005` (from Bug Condition C2 in design)
  - C3 — Call `handleExportPDF()` with project name "Tower A"; assert PDF contains "Tower A" and not "BeamLab Project" (from Bug Condition C3 in design)
  - C4 — Call `generateQualityChecks` with `maxDrift=0.006`; assert drift check status is `FAIL` not `PASS` (from Bug Condition C4 in design)
  - Run all tests on UNFIXED code
  - **EXPECTED OUTCOME**: All tests FAIL (this is correct — it proves the bugs exist)
  - Document counterexamples found (e.g., "UpgradeModal not rendered for free tier", "maxDisp shows 0.005 instead of 5.000")
  - Mark task complete when tests are written, run, and failures are documented
  - Files: `apps/web/src/hooks/__tests__/useTierAccess.test.ts`, `apps/web/src/services/__tests__/PDFReportService.test.ts`, `apps/web/src/services/__tests__/ComprehensiveReportService.test.ts`
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.20, 1.21, 1.27_

- [x] 2. Create `clientTierConfig.ts` with correct free-tier limits
  - Create `apps/web/src/config/clientTierConfig.ts`
  - Define `CLIENT_TIER_CONFIG` mirroring `apps/api/src/config/tierConfig.ts` with correct free-tier limits (not `Infinity`)
  - Free tier: `maxNodes: 10`, `maxMembers: 15`, `maxProjects: 3`, `maxAnalysisPerDay: 3`, `maxPdfExportsPerDay: 1`, `hasAdvancedAnalysis: false`, `hasDesignCodes: false`, `hasAIFeatures: false`, `canExportCleanPDF: false`
  - Pro/Enterprise tier: all limits `Infinity`, all feature flags `true`
  - Export `CLIENT_TIER_CONFIG` as a `const` object
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 3. Refactor `useTierAccess.ts` to read from `SubscriptionContext`
  - Modify `apps/web/src/hooks/useTierAccess.ts`
  - Replace the `/api/user/limits` fetch with `const { subscription } = useSubscription()`
  - Replace `TIER_LIMITS` with `CLIENT_TIER_CONFIG[tier]` from `clientTierConfig.ts`
  - Remove `TEMP_UNLOCK_ALL` override so `canAccess()` reflects real tier
  - Return `{ tier, isFree, isPro, isEnterprise, isLoading, limits, canAccess }` from context data only
  - Eliminates the dual-fetch race condition (Bug Condition C1 root cause 4)
  - _Bug_Condition: isBugCondition_C1 — useTierAccess calls /api/user/limits independently_
  - _Preservation: Pro/Enterprise users must continue to access all features (Requirements 3.1–3.4)_
  - _Requirements: 2.8, 1.8_

- [x] 4. Create `<TierGate>` wrapper component
  - Create `apps/web/src/components/TierGate.tsx`
  - Accept props: `feature: keyof SubscriptionFeatures`, `children: React.ReactNode`, `fallback?: React.ReactNode`
  - Call `canAccess(feature)` from `useSubscription()`; if true render `children`
  - If false, render `<LockedOverlay>` that opens `<UpgradeModal isOpen={showModal} feature={feature} />` on click
  - Default fallback is `UpgradeModal`; custom `fallback` prop overrides the locked overlay
  - No changes needed to `UpgradeModal` itself
  - _Bug_Condition: isBugCondition_C1 — no canAccess() call at component entry points_
  - _Expected_Behavior: upgradeModalVisible(result) = true AND featurePanelVisible(result) = false_
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 5. Add `<TierGate>` to all gated components
  - Wrap `ExportDialog.tsx` PDF export button with `<TierGate feature="pdfExport">` (Requirement 2.4)
  - Wrap `DesignCodesDialog.tsx` advanced code options with `<TierGate feature="advancedDesignCodes">` (Requirement 2.2)
  - Wrap `CollaborationHub.tsx` at render site with `<TierGate feature="teamMembers">` (Requirement 2.5)
  - Wrap `AdvancedMeshingDashboard.tsx` at render site with `<TierGate feature="advancedAnalysis">` (Requirement 2.7)
  - Wrap `BIMExportEnhanced.tsx` at render site with `<TierGate feature="advancedAnalysis">` (Requirement 2.7)
  - Wrap `SectionBrowserDialog.tsx` full-database section list with `<TierGate feature="advancedDesignCodes">` (Requirement 2.6)
  - Wrap `PDeltaAnalysisPanel`, `BucklingAnalysisPanel`, `ModalAnalysisPanel`, `NonLinearAnalysisPanel`, `TimeHistoryPanel` at render site with `<TierGate feature="advancedAnalysis">` (Requirement 2.1)
  - Wrap AI Architect trigger button with `<TierGate feature="aiAssistant">` (Requirement 2.3)
  - Files: `apps/web/src/components/ExportDialog.tsx`, `apps/web/src/components/DesignCodesDialog.tsx`, `apps/web/src/components/CollaborationHub.tsx`, `apps/web/src/components/AdvancedMeshingDashboard.tsx`, `apps/web/src/components/BIMExportEnhanced.tsx`, `apps/web/src/components/SectionBrowserDialog.tsx`, all advanced analysis panel files, AI Architect trigger
  - _Bug_Condition: isBugCondition_C1 — components render unconditionally without canAccess() check_
  - _Expected_Behavior: upgradeModalVisible(result) = true AND featurePanelVisible(result) = false for free tier_
  - _Preservation: Pro/Enterprise users see no upgrade prompt (Requirements 3.1–3.4)_
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_

- [x] 6. Fix displacement unit conversion bug in `generateBasicPDFReport` (C2)
  - Modify `apps/web/src/services/PDFReportService.ts`, function `generateBasicPDFReport`
  - Change `maxDisp` accumulator to multiply by 1000: `Math.abs(d.dx) * 1000`, `Math.abs(d.dy) * 1000`, `Math.abs(d.dz) * 1000`
  - Ensure summary row unit label reads "mm" and value is the converted result
  - Individual `dispDict` entries (already `* 1000`) are unchanged
  - _Bug_Condition: isBugCondition_C2 — maxDisp accumulated in raw meters, labeled as mm_
  - _Expected_Behavior: maxDispInReport = max(|d.dx|, |d.dy|, |d.dz|) * 1000, unit = "mm"_
  - _Preservation: Individual dispDict entries and PDF branding remain unchanged (Requirements 3.7)_
  - _Requirements: 2.21, 1.21_

- [x] 7. Fix moment data loss bug in `generateBasicPDFReport` (preserve signed values)
  - Modify `apps/web/src/services/PDFReportService.ts`, function `generateBasicPDFReport`
  - Replace `moment: [0, Math.max(Math.abs(forces.momentZ), Math.abs(forces.momentY))]` with signed fields: `momentY_start`, `momentY_end`, `momentZ_start`, `momentZ_end`
  - Preserve sign and both-end distribution for `momentY` and `momentZ`
  - Update any downstream consumer of `forcesDict` that reads the old `moment` key
  - _Requirements: 2.22, 1.22_

- [x] 8. Add missing report sections to `generateBasicPDFReport`
  - Modify `apps/web/src/services/PDFReportService.ts`
  - Add Load Cases section: iterate `analysisResults.loadCases` if present; show placeholder row if absent
  - Add Support Reactions section: iterate `analysisResults.reactions` entries, columns: Node ID, Fx, Fy, Fz, Mx, My, Mz
  - Add Node Coordinate Table: iterate `nodes`, columns: Node ID, X, Y, Z, Support Condition (Fixed/Pinned/Roller/Free derived from `n.restraints`)
  - Insert all three sections after the member forces table
  - _Requirements: 2.23, 2.31, 1.23, 1.31_

- [x] 9. Add human-readable governing check labels and code clause references
  - Modify `apps/web/src/services/PDFReportService.ts`
  - Add `GOVERNING_CHECK_LABELS` map: internal enum names → human-readable descriptions (e.g., `'COMPRESSION_FLEXURE_COMBINED'` → `'Combined Compression + Flexure (AISC H1-1)'`)
  - Add `CHECK_CLAUSE_REFS` map: enum names → clause references (e.g., `'COMPRESSION_FLEXURE_COMBINED'` → `'AISC 360-16 §H1-1'`)
  - Include IS 800:2007 equivalents in both maps
  - Add "Clause" column to the steel design table populated from `CHECK_CLAUSE_REFS`
  - Replace raw `r.governingCheck` with `GOVERNING_CHECK_LABELS[r.governingCheck] ?? r.governingCheck`
  - _Requirements: 2.24, 2.25, 1.24, 1.25_

- [x] 10. Add PE stamp block to PDF cover page
  - Modify `apps/web/src/services/PDFReportService.ts`
  - Add PE stamp `autoTable` block after the document control table on the cover page
  - Fields: Engineer of Record, License No. (`project.licenseNumber ?? '_______________'`), Date, Signature line
  - Add optional `licenseNumber?: string` field to the `ProjectInfo` interface
  - Style with `NAVY` header and `SLATE_700` body text matching existing cover page theme
  - _Requirements: 2.30, 1.30_

- [x] 11. Fix `handleExportPDF()` in `AnalysisDesignPanel` to read from store/auth (C3)
  - Modify `apps/web/src/components/AnalysisDesignPanel.tsx`
  - Add `const projectInfo = useModelStore((s) => s.projectInfo)` and `const { user } = useAuth()`
  - Replace hardcoded `name: "BeamLab Project"` with `projectInfo?.name ?? 'Untitled Project'`
  - Replace hardcoded `engineer: "Engineer"` with `user?.fullName ?? user?.email ?? 'Engineer'`
  - Pass `projectInfo?.description` and `new Date().toLocaleDateString()` for remaining fields
  - _Bug_Condition: isBugCondition_C3 — handleExportPDF() passes string literals instead of store/auth data_
  - _Expected_Behavior: reportContains(report, X.projectName) AND NOT reportContains(report, "BeamLab Project")_
  - _Preservation: PDF cover page branding, header, footer remain unchanged (Requirement 3.7)_
  - _Requirements: 2.20, 1.20_

- [x] 12. Connect `ProfessionalReportGenerator` to `useModelStore` for live model statistics (C3)
  - Modify `apps/web/src/pages/ProfessionalReportGenerator.tsx`
  - Add `const nodes = useModelStore((s) => s.nodes)`, `members`, and `storeProjectInfo` selectors
  - Initialize `projectInfo` state from `storeProjectInfo?.name` instead of static placeholder
  - Derive `geometrySummary` via `useMemo`: `nodeCount: nodes.size`, `memberCount: members.size`, `supportCount` from restraints
  - Replace hardcoded `156 nodes`, `312 members`, `G+8 storeys`, `28.0 m` in the geometry section template with live store values
  - _Bug_Condition: isBugCondition_C3 — ProfessionalReportGenerator never connects to useModelStore_
  - _Preservation: Template selection, section toggling, and report preview continue to work (Requirement 3.11)_
  - _Requirements: 2.26, 1.26_

- [x] 13. Fix `generateQualityChecks()` to derive from actual results (C4)
  - Modify `apps/web/src/services/ComprehensiveReportService.ts`
  - Remove the `_` prefix from `analysisResults` and `designResults` parameters (they are currently intentionally ignored)
  - Return `[]` when both parameters are null/undefined
  - Derive `driftCheck.actual` from `analysisResults.maxDrift`; status FAIL if `> 0.004` (IS 1893 §7.11.1)
  - Derive `deflectionCheck.actual` from `analysisResults.maxDisplacement`
  - Derive `memberCheck.status` from `max(designResults.members[].utilization)`: FAIL if `> 1.0`
  - _Bug_Condition: isBugCondition_C4 — generateQualityChecks() ignores parameters, returns hardcoded PASS_
  - _Expected_Behavior: checks.driftCheck.actual = analysisResults.maxDrift; memberCheck.status derived from designResults_
  - _Preservation: generateQualityChecks(null, null) returns [] without throwing (Requirement 2.28)_
  - _Requirements: 2.27, 2.28, 1.27_

- [x] 14. Fix `transformToDetailedReportData()` null/N/A fallbacks
  - Modify `apps/web/src/services/ComprehensiveReportService.ts`
  - Replace hardcoded fallback values `{ maxDisplacement: 12.5, maxDrift: 0.0035 }` with `null`
  - Use `analysisResults?.maxDisplacement ?? null`, `analysisResults?.maxDrift ?? null`, etc.
  - Update `DetailedReportEngine` to render "N/A" for null fields rather than crashing
  - _Bug_Condition: isBugCondition_C3 — transformToDetailedReportData() uses hardcoded fallback numbers_
  - _Preservation: PDF generation with valid project/design data continues to produce correct PDF blob (Requirement 3.12)_
  - _Requirements: 2.28, 1.28_

- [x] 15. Add PDF export button to `ReportBuilderPage`
  - Modify `apps/web/src/pages/ReportBuilderPage.tsx`
  - Add a PDF export button to the header action row alongside existing Markdown/HTML buttons
  - Implement `downloadReportAsPDF()` calling `generateBasicPDFReport` with current `config`, `sections`, nodes/members from `useModelStore`, and `analysisResults` from store
  - Style button with `bg-red-600 hover:bg-red-700` to match PDF convention
  - _Preservation: Markdown/HTML download and section editing continue to work (Requirement 3.9)_
  - _Requirements: 2.29, 1.29_

- [x] 16. Create unified `useAnalysis` hook with WASM→Rust→Python routing
  - Create `apps/web/src/hooks/useAnalysis.ts`
  - Define `UnifiedAnalysisResult` interface: `{ displacements, reactions, memberForces, modalResults?, bucklingResult?, loadCombos?, backend: 'wasm'|'rust'|'python', computeTimeMs }`
  - Define `AnalysisProgressStep` interface: `{ step: string, percent: number, timestamp: number }`
  - Implement routing: `nodeCount < 500 && type === 'static' && wasmRunner` → WASM; `rustApi.isAvailable()` → Rust; else Python with `toast.info('Using cloud solver')`
  - Expose `{ result, isLoading, progress, error, backend, analyze }` from the hook
  - Add normalizers: `normalizeRustResult`, `normalizePythonResult` to map each backend's response to `UnifiedAnalysisResult`
  - _Preservation: WASM routing for small static models continues with same accuracy (Requirement 3.5); Rust routing for large models continues when available (Requirement 3.6)_
  - _Requirements: 2.9, 2.10, 1.9, 1.10_

- [x] 17. Add skeleton loaders and progress steps to `ResultsHub` and `AnalysisResultsDashboard`
  - Create `apps/web/src/components/ui/AnalysisSkeleton.tsx` with animated placeholder cards and a progress step list
  - Modify `apps/web/src/components/ResultsHub.tsx`: check `isLoading` from `useAnalysis`; render `<AnalysisSkeleton steps={progress} />` when loading
  - Modify `apps/web/src/components/AnalysisResultsDashboard.tsx`: same pattern
  - _Preservation: Results display and member forces/design check tabs continue to work when results are present (Requirement 3.10)_
  - _Requirements: 2.13, 1.13_

- [x] 18. Fix `ModeShapeRenderer` data path wiring
  - Modify the render site of `apps/web/src/components/ModeShapeRenderer.tsx`
  - Wire `modes={analysisResult?.modalResults?.modes ?? []}` and `frequencies={analysisResult?.modalResults?.frequencies ?? []}` from `useAnalysis` result
  - Extend `UnifiedAnalysisResult` with `modalResults?: { modes: ModeShape[], frequencies: number[], participationFactors: number[] }`
  - _Requirements: 2.11, 1.11_

- [x] 19. Fix `StabilityView` buckling result mapping (Python response normalizer)
  - Add `normalizeBucklingResult(raw: PythonBucklingResponse): BucklingResult` in the Python normalizer layer inside `useAnalysis`
  - Map `raw.buckling_factors` → `loadFactors`, `raw.mode_shapes` → `modeShapes`
  - Wire `bucklingResult={analysisResult?.bucklingResult ?? null}` at the `StabilityView` render site
  - Extend `UnifiedAnalysisResult` with `bucklingResult?: BucklingResult`
  - _Requirements: 2.12, 1.12_

- [x] 20. Wire `LoadCombosView` to load combination results from `useAnalysis`
  - Modify the render site of `apps/web/src/components/LoadCombosView.tsx`
  - Extend `UnifiedAnalysisResult` with `loadCombos?: LoadCombination[]` where `LoadCombination = { id: string, name: string, factors: Record<string, number>, envelopeForces: MemberForceData[] }`
  - In `normalizePythonResult`, map `raw.load_combinations` → `loadCombos` array
  - Wire `loadCombos={analysisResult?.loadCombos ?? []}` at the `LoadCombosView` render site
  - Render a "No load combinations available" empty state when `loadCombos` is empty
  - _Requirements: 2.15, 1.15_

- [x] 21. Add concrete DC ratio support to `DCRatioView`
  - Modify `apps/web/src/components/DCRatioView.tsx`
  - Add `materialType: 'steel' | 'concrete'` field to `MemberResult` type
  - Source concrete DC ratios from Python backend response under `concrete_design.members` in the `normalizePythonResult` normalizer
  - Merge steel and concrete `MemberResult[]` before passing to `DCRatioView`
  - Add governing check labels for concrete: `"Bending"`, `"Shear"`, `"Flexure + Axial (RC)"`
  - _Requirements: 2.14, 1.14_

- [x] 22. Add IS 800:2007 results to `SteelDesignTab`
  - Modify `apps/web/src/components/SteelDesignTab.tsx`
  - Extend `MemberDesignRow` type with `designCode: 'AISC360' | 'IS800' | 'EC3'` and `is800Result?: IS800DesignResult`
  - Populate `is800Result` from Python backend IS 800 output in the `normalizePythonResult` normalizer
  - Render a design code badge per row; when `is800Result` is present, show a second check group labeled "IS 800:2007 Checks"
  - _Requirements: 2.16, 1.16_

- [x] 23. Fix `RCBeamTab` Python backend schema alignment (snake_case → camelCase normalizer)
  - Add `normalizeRCBeamResult(raw: PythonRCBeamResponse): RCBeamResult` in the Python normalizer layer inside `useAnalysis`
  - Map: `raw.moment_capacity` → `momentCapacity`, `raw.shear_capacity` → `shearCapacity`, `raw.main_reinforcement` → `mainReinforcement`, `raw.stirrup_spacing` → `stirrupSpacing`, `raw.utilization_ratio` → `utilizationRatio`, `raw.status` → `status`
  - Apply normalizer in `normalizePythonResult` before storing RC results in `UnifiedAnalysisResult`
  - _Requirements: 2.17, 1.17_

- [x] 24. Add `ErrorBoundary` to high-risk components
  - Create `apps/web/src/components/ui/PanelErrorBoundary.tsx` — a shared `ErrorBoundary` class component with a `fallback` prop
  - Wrap `StructuralModelingCanvas` render site: `<ErrorBoundary fallback={<CanvasFallback onReload={() => window.location.reload()} />}>`
  - Wrap `AnalysisDesignPanel` render site: `<ErrorBoundary fallback={<PanelFallback name="Analysis & Design" />}>`
  - Wrap `AIArchitectPanel` render site: `<ErrorBoundary fallback={<PanelFallback name="AI Architect" />}>`
  - _Requirements: 2.18, 2.19, 1.18, 1.19_

- [x] 25. Delete dead code
  - Delete `apps/web/src/components/RazorpayPayment.tsx` (Razorpay removed, replaced by PhonePe)
  - Delete `apps/web/src/components/RazorpayCustom.tsx`
  - Delete `apps/web/src/hooks/useSubscription.ts` (duplicate of `useSubscription.tsx`)
  - Delete all `apps/web/src/**/*.bak` backup files committed by mistake
  - Before deletion, confirm no remaining imports via grep for `RazorpayPayment`, `RazorpayCustom`, `useSubscription.ts`
  - _Requirements: Design §6 Dead Code Removal_

- [*] 26. Fix verification property tests (confirm all bugs fixed, preservation holds)
  - **Property 1: Expected Behavior** - C1 Tier Gate Enforcement
  - **Property 2: Preservation** - Pro Tier Unaffected by Gating
  - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests for C1/C2/C3/C4
  - Re-run C1 exploration test from task 1 → **EXPECTED OUTCOME**: PASSES (UpgradeModal shown for free tier)
  - Re-run C2 exploration test from task 1 → **EXPECTED OUTCOME**: PASSES (maxDisp = 5.000 mm for dx=0.005 m)
  - Re-run C3 exploration test from task 1 → **EXPECTED OUTCOME**: PASSES (PDF contains "Tower A", not "BeamLab Project")
  - Re-run C4 exploration test from task 1 → **EXPECTED OUTCOME**: PASSES (drift check FAIL for maxDrift=0.006)
  - Write preservation property tests (observation-first): observe pro-tier behavior on unfixed code first, then assert
  - Preservation P2: For any `(tier, feature)` where `tier='pro'` or `'enterprise'`, `<TierGate>` renders children without `UpgradeModal`
  - Preservation P5: Individual `dispDict` entries (already `* 1000`) are unchanged by the maxDisp fix
  - Preservation P8: `generateQualityChecks(null, null)` returns `[]` without throwing
  - Verify PDF cover page branding, running header, footer, and D/C color coding are unchanged (Requirements 3.7–3.8)
  - Verify `ReportBuilderPage` Markdown/HTML download and section editing still work (Requirement 3.9)
  - Verify `AnalysisDesignPanel` member forces tab, design check tab, section assignment controls still work (Requirement 3.10)
  - Files: `apps/web/src/hooks/__tests__/useTierAccess.test.ts`, `apps/web/src/services/__tests__/PDFReportService.test.ts`, `apps/web/src/services/__tests__/ComprehensiveReportService.test.ts`, `apps/web/src/components/__tests__/TierGate.test.tsx`
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10, 3.11, 3.12_

- [x] 27. Checkpoint — Ensure all tests pass
  - Run the full test suite and confirm all tests pass
  - Verify no regressions in Pro/Enterprise tier access
  - Verify PDF generation produces correct output with live project/engineer data
  - Verify analysis routing selects the correct backend for each model size
  - Ask the user if any questions arise before closing the spec
