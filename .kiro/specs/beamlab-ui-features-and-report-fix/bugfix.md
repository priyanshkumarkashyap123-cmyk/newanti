# Bugfix Requirements Document

## Introduction

BeamLab is a professional structural engineering SaaS platform. This document captures bugs across three areas that are distinct from the billing/subscription fixes already tracked in `beamlab-improvement-roadmap`:

1. **Pro feature gating and UI surfacing** — Pro-only analysis types (P-Delta, buckling, modal, nonlinear, time history), advanced design codes, AI Architect, BIM export, and PDF export are accessible to free-tier users because `useTierAccess.ts` has all limits set to `Infinity` and `TEMP_UNLOCK_ALL` is active. The `UpgradeModal` exists but is never triggered.

2. **Analysis pipeline and result view wiring** — Three separate analysis backends (WASM, Rust, Python) are called directly by components with no unified hook, no automatic fallback, and no real-time progress feedback. Advanced result views (mode shapes, buckling, DC ratio for concrete, load combinations) are partially wired or show blank panels.

3. **PDF and report generation quality** — `PDFReportService.ts` contains hardcoded placeholder strings, a displacement unit mismatch (raw meters labeled as mm), a moment sign/distribution loss bug, missing report sections (load cases, reactions, node coordinates), and no PE stamp block. `ProfessionalReportGenerator.tsx` and `ComprehensiveReportService.ts` use hardcoded model statistics instead of reading from the live model store. `ReportBuilderPage.tsx` has no PDF export button. `generateQualityChecks()` returns hardcoded pass/fail data regardless of actual results.

The billing bypass removal itself is out of scope here (covered by `beamlab-improvement-roadmap` Req 1–5). This spec focuses on what happens *after* the bypass is removed: the UI must correctly gate features, wire result views, and produce accurate professional reports.

---

## Bug Analysis

### Current Behavior (Defect)

**Section 1 — Pro Feature Gating**

1.1 WHEN a free-tier user opens any advanced analysis panel (P-Delta, buckling, modal, nonlinear, time history, pushover), THEN the system renders the full panel without any upgrade prompt, because `useTierAccess.ts` sets `hasAdvancedAnalysis: true` for the free tier and `TEMP_UNLOCK_ALL` overrides `canAccess()` to always return `true`.

1.2 WHEN a free-tier user opens `DesignCodesDialog.tsx` to select IS 800, AISC 360, EC3, or ACI 318 advanced design codes, THEN the system allows selection without a tier check, because no `canAccess('advancedDesignCodes')` guard is present in that dialog.

1.3 WHEN a free-tier user clicks the AI Architect trigger, THEN the system launches `useAIArchitect.ts` without checking `canAccess('aiAssistant')`, because the UI trigger has no tier gate.

1.4 WHEN a free-tier user opens `ExportDialog.tsx` and clicks PDF export, THEN the system generates and downloads a PDF without checking `canAccess('pdfExport')`, because `ExportDialog.tsx` contains no tier check.

1.5 WHEN a free-tier user opens `CollaborationHub.tsx`, THEN the system renders the full collaboration UI without an upgrade prompt, even though the backend route already enforces `requireFeature('collaboration')`.

1.6 WHEN a free-tier user opens `SectionBrowserDialog.tsx`, THEN the system shows the full section database without restriction, because no tier check limits section access for free users.

1.7 WHEN a free-tier user opens `AdvancedMeshingDashboard.tsx` or `BIMExportEnhanced.tsx`, THEN the system renders these Pro-only tools without any upgrade prompt.

1.8 WHEN `useSubscription.tsx` and `useTierAccess.ts` are both mounted in the same component tree, THEN the system makes two concurrent API calls (`/api/user/limits` and `/api/user/subscription`) that can resolve in different orders, causing a race condition where the displayed tier briefly differs between components.

**Section 2 — Analysis Pipeline and Result View Wiring**

1.9 WHEN a user runs any analysis type, THEN the system calls one of three separate backends (`localAnalysis.ts`, `rustApi.ts`, `advancedAnalysis.ts`) directly from the component, with no unified entry point, no automatic fallback when the Rust API is unavailable, and no real-time progress indication during the 2–5 second wait.

1.10 WHEN the Rust API is unavailable and a component calls `rustApi.smartAnalyze`, THEN the system throws an unhandled error rather than falling back to the Python job queue, because `smartAnalyze` has no fallback path.

1.11 WHEN a user runs modal analysis and the results are returned, THEN `ModeShapeRenderer.tsx` does not always receive the modal results because the data path from the analysis hook to the renderer is not consistently wired.

1.12 WHEN a user runs buckling analysis and the results are returned, THEN `StabilityView.tsx` shows incomplete or empty data because the buckling result mapping from the Python backend response to the view component is incomplete.

1.13 WHEN a user runs analysis and the results panel is loading, THEN the system shows a blank panel with no skeleton loaders or progress steps, because `ResultsHub.tsx` and `AnalysisResultsDashboard.tsx` have no loading skeleton or real-time progress indicator.

1.14 WHEN a user views design results in `DCRatioView.tsx`, THEN the system only shows DC ratios for steel members; concrete members show no DC ratio because `DCRatioView.tsx` is only wired for steel design results.

1.15 WHEN a user views `LoadCombosView.tsx`, THEN the load combination results are not always populated because the load combination data is not consistently passed from the analysis result to the view.

1.16 WHEN a user views `SteelDesignTab.tsx`, THEN the system only shows AISC 360-16 design results; IS 800 results are not displayed because the tab is not wired for IS 800 output.

1.17 WHEN a user views `RCBeamTab.tsx`, THEN the RC design results from the Python backend are not always correctly mapped to the UI fields because the response schema from the Python backend does not match the expected shape in the component.

1.18 WHEN `StructuralModelingCanvas.tsx` (Three.js) throws an uncaught exception, THEN the entire React tree crashes because no `ErrorBoundary` wraps the canvas component.

1.19 WHEN `AnalysisDesignPanel.tsx` or `AIArchitectPanel` throws an uncaught exception, THEN the entire React tree crashes because no `ErrorBoundary` wraps these high-risk components.

**Section 3 — PDF and Report Generation Quality**

1.20 WHEN `AnalysisDesignPanel.tsx` calls `handleExportPDF()`, THEN the generated PDF cover page shows `"BeamLab Project"` as the project name and `"Engineer"` as the engineer name, because these strings are hardcoded in the `generateDesignReport` call rather than being read from the active project store or user session.

1.21 WHEN `generateBasicPDFReport` builds the analysis results summary table, THEN the maximum displacement value is displayed in raw meters labeled as "mm", because `maxDisp` is computed as `Math.max(...Math.abs(d.dx), ...)` without the `* 1000` conversion that is applied to individual displacements, causing a 1000× underreporting error in the summary row.

1.22 WHEN `generateBasicPDFReport` builds the member forces dictionary, THEN the moment data is stored as `[0, Math.max(Math.abs(forces.momentZ), Math.abs(forces.momentY))]`, which loses the sign and the full distribution, so the report shows only the peak absolute value instead of the actual signed moment diagram data.

1.23 WHEN `generateBasicPDFReport` generates a report, THEN the PDF contains no load cases section, no support reactions section, and no node displacement table, because these sections are not implemented in the basic PDF generator.

1.24 WHEN `generateBasicPDFReport` generates the steel design section, THEN the governing check column shows internal code names such as `"COMPRESSION_FLEXURE_COMBINED"` instead of human-readable descriptions such as `"Combined Compression + Flexure (AISC H1-1)"`.

1.25 WHEN `generateBasicPDFReport` generates the steel design section, THEN no design code clause reference (e.g., `"AISC 360-16 Section H1-1"`) is included alongside the check result, making the report non-compliant with professional engineering report standards.

1.26 WHEN `ProfessionalReportGenerator.tsx` renders the report preview, THEN the geometry section shows hardcoded values (`156 nodes`, `312 members`, `G+8 storeys`, `28.0 m`) instead of reading from the live model store, because the component initializes `projectInfo` with static placeholder strings and never connects to `useModelStore`.

1.27 WHEN `ComprehensiveReportService.ts` calls `generateQualityChecks()`, THEN the method returns a hardcoded array of five `PASS` items regardless of the actual analysis results passed in, because the `_analysisResults` and `_designResults` parameters are unused.

1.28 WHEN `ComprehensiveReportService.ts` calls `transformToDetailedReportData()` and `analysisResults` is not provided, THEN the `analysisSummary` block uses hardcoded fallback values (`maxDisplacement: 12.5`, `maxDrift: 0.0035`) instead of indicating that results are unavailable.

1.29 WHEN `ReportBuilderPage.tsx` is open, THEN the user can only download Markdown and HTML formats; there is no PDF export button, despite the page being named "Report Builder" and users expecting PDF output.

1.30 WHEN any professional engineering report is generated, THEN the report contains no PE stamp / engineer signature block, which is required for professional engineering submissions.

1.31 WHEN `generateBasicPDFReport` generates a report, THEN the geometry section shows only node and member counts without a node coordinate table, making it impossible to verify the model geometry from the report alone.

---

### Expected Behavior (Correct)

**Section 2 — Pro Feature Gating**

2.1 WHEN a free-tier user attempts to open any advanced analysis panel (P-Delta, buckling, modal, nonlinear, time history, pushover), THEN the system SHALL display the `UpgradeModal` with the feature name and Pro plan CTA instead of rendering the panel.

2.2 WHEN a free-tier user attempts to select an advanced design code (IS 800, AISC 360, EC3, ACI 318 advanced) in `DesignCodesDialog.tsx`, THEN the system SHALL show an upgrade prompt and prevent selection, because `canAccess('advancedDesignCodes')` returns `false` for free tier.

2.3 WHEN a free-tier user clicks the AI Architect trigger, THEN the system SHALL display the `UpgradeModal` with the AI Assistant feature highlighted, because `canAccess('aiAssistant')` returns `false` for free tier.

2.4 WHEN a free-tier user attempts to export a PDF from `ExportDialog.tsx`, THEN the system SHALL display the `UpgradeModal` with the PDF Export feature highlighted, because `canAccess('pdfExport')` returns `false` for free tier.

2.5 WHEN a free-tier user opens `CollaborationHub.tsx`, THEN the system SHALL display an upgrade prompt explaining that collaboration is a Pro feature, consistent with the backend `requireFeature('collaboration')` enforcement.

2.6 WHEN a free-tier user opens `SectionBrowserDialog.tsx`, THEN the system SHALL limit the visible section database to the free-tier section set and show an upgrade prompt for the full database.

2.7 WHEN a free-tier user opens `AdvancedMeshingDashboard.tsx` or `BIMExportEnhanced.tsx`, THEN the system SHALL display the `UpgradeModal` instead of rendering the full tool.

2.8 WHEN both `useSubscription.tsx` and `useTierAccess.ts` are mounted, THEN the system SHALL make only one API call to `/api/user/subscription`, with `useTierAccess` reading from the `SubscriptionContext` rather than calling `/api/user/limits` independently.

**Section 3 — Analysis Pipeline and Result View Wiring**

2.9 WHEN a user runs any analysis type, THEN the system SHALL route the request through a single `useAnalysis` hook that selects the appropriate backend (WASM for small static models, Rust API for large models, Python fallback when Rust is unavailable) and returns a unified `AnalysisResult` shape.

2.10 WHEN the Rust API is unavailable during an analysis request, THEN the system SHALL automatically fall back to the Python job queue without any change required in the calling component, and SHALL display a non-blocking toast indicating the fallback backend.

2.11 WHEN modal analysis results are returned, THEN `ModeShapeRenderer.tsx` SHALL receive and render the mode shape data for all computed modes, because the data path from `useAnalysis` to the renderer is consistently wired.

2.12 WHEN buckling analysis results are returned, THEN `StabilityView.tsx` SHALL display the buckling load factors and mode shapes for all computed buckling modes.

2.13 WHEN analysis is in progress, THEN the system SHALL display skeleton loaders in `ResultsHub.tsx` and `AnalysisResultsDashboard.tsx` and SHALL show real-time progress steps sourced from the solver's progress events.

2.14 WHEN a user views `DCRatioView.tsx`, THEN the system SHALL display DC ratios for both steel and concrete members, sourcing steel results from the Rust/WASM backend and concrete results from the Python backend.

2.15 WHEN a user views `LoadCombosView.tsx`, THEN the system SHALL consistently populate load combination results from the analysis result object for all completed analyses.

2.16 WHEN a user views `SteelDesignTab.tsx`, THEN the system SHALL display design results for both AISC 360-16 and IS 800:2007 design codes when results are available for either code.

2.17 WHEN a user views `RCBeamTab.tsx`, THEN the system SHALL correctly map all RC design result fields from the Python backend response schema to the UI component fields.

2.18 WHEN `StructuralModelingCanvas.tsx` throws an uncaught exception, THEN the system SHALL catch it in an `ErrorBoundary` and render a graceful fallback UI with a "Reload Canvas" button, without crashing the rest of the application.

2.19 WHEN `AnalysisDesignPanel.tsx` or `AIArchitectPanel` throws an uncaught exception, THEN the system SHALL catch it in an `ErrorBoundary` and render a graceful fallback UI, without crashing the rest of the application.

**Section 4 — PDF and Report Generation Quality**

2.20 WHEN `AnalysisDesignPanel.tsx` calls `handleExportPDF()`, THEN the system SHALL read the project name from the active project store and the engineer name from the authenticated user session, and SHALL pass these values to `generateDesignReport` instead of hardcoded strings.

2.21 WHEN `generateBasicPDFReport` builds the analysis results summary table, THEN the maximum displacement value SHALL be converted to millimeters (`* 1000`) before being written to the summary row, and the unit label SHALL read "mm".

2.22 WHEN `generateBasicPDFReport` builds the member forces dictionary, THEN the moment data SHALL preserve the signed values for both `momentY` and `momentZ` at both ends of the member, so the report reflects the actual moment distribution rather than only the peak absolute value.

2.23 WHEN `generateBasicPDFReport` generates a report, THEN the PDF SHALL include a load cases section listing all applied load cases, a support reactions section listing all support reaction components, and a node displacement table listing all nodal displacements.

2.24 WHEN `generateBasicPDFReport` generates the steel design section, THEN the governing check column SHALL display human-readable descriptions (e.g., `"Combined Compression + Flexure"`) instead of internal enum names.

2.25 WHEN `generateBasicPDFReport` generates the steel design section, THEN each design check row SHALL include the applicable design code clause reference (e.g., `"AISC 360-16 §H1-1"` or `"IS 800:2007 §9.3.1"`).

2.26 WHEN `ProfessionalReportGenerator.tsx` renders the report preview, THEN the geometry section SHALL read node count, member count, storey count, and total height from `useModelStore` rather than from hardcoded placeholder values.

2.27 WHEN `ComprehensiveReportService.ts` calls `generateQualityChecks()`, THEN the method SHALL derive pass/fail status from the actual `analysisResults` and `designResults` passed in, including real drift values, real deflection values, and real member utilization ratios.

2.28 WHEN `ComprehensiveReportService.ts` calls `transformToDetailedReportData()` and `analysisResults` is not provided, THEN the `analysisSummary` block SHALL use `null` or `"N/A"` for all result fields rather than hardcoded fallback numbers.

2.29 WHEN `ReportBuilderPage.tsx` is open, THEN the system SHALL provide a PDF export button that generates and downloads a PDF version of the report using the same content as the Markdown/HTML exports.

2.30 WHEN any professional engineering report is generated, THEN the report SHALL include a PE stamp block containing fields for engineer name, license number, date, and a signature line.

2.31 WHEN `generateBasicPDFReport` generates a report, THEN the geometry section SHALL include a node coordinate table listing each node ID with its X, Y, Z coordinates and support condition.

---

### Unchanged Behavior (Regression Prevention)

**Section 5 — Preservation**

3.1 WHEN a Pro-tier user opens any advanced analysis panel (P-Delta, buckling, modal, nonlinear, time history), THEN the system SHALL CONTINUE TO render the full panel without any upgrade prompt.

3.2 WHEN a Pro-tier user selects any design code in `DesignCodesDialog.tsx`, THEN the system SHALL CONTINUE TO allow selection without restriction.

3.3 WHEN a Pro-tier user clicks the AI Architect trigger, THEN the system SHALL CONTINUE TO launch the AI Architect panel without any upgrade prompt.

3.4 WHEN a Pro-tier user exports a PDF from `ExportDialog.tsx`, THEN the system SHALL CONTINUE TO generate and download the PDF without any upgrade prompt.

3.5 WHEN a user runs a static analysis on a model with fewer than 500 nodes and the WASM solver is available, THEN the system SHALL CONTINUE TO route the analysis to the WASM solver and return results with the same accuracy as before.

3.6 WHEN a user runs analysis and the Rust API is available, THEN the system SHALL CONTINUE TO route large-model analysis to the Rust API and return results with the same accuracy as before.

3.7 WHEN `generateBasicPDFReport` generates a report with valid analysis results, THEN the system SHALL CONTINUE TO produce a downloadable PDF with the professional cover page, running header, and footer branding.

3.8 WHEN `generateBasicPDFReport` generates the steel design section with valid design results, THEN the system SHALL CONTINUE TO color-code D/C ratios (green < 0.85, amber 0.85–1.0, red > 1.0) and status badges (PASS/WARNING/FAIL).

3.9 WHEN `ReportBuilderPage.tsx` auto-fills from the model, THEN the system SHALL CONTINUE TO read node count, member count, and analysis results from `useModelStore` and populate the report sections accordingly.

3.10 WHEN `AnalysisDesignPanel.tsx` is open and analysis results are present, THEN the system SHALL CONTINUE TO display member forces, design check results, and section assignment controls in their respective tabs.

3.11 WHEN `ProfessionalReportGenerator.tsx` is open, THEN the system SHALL CONTINUE TO allow the user to select report templates, toggle sections, configure project metadata, and preview the report.

3.12 WHEN `ComprehensiveReportService.ts` generates a detailed analysis report with valid `projectData` and `designResults`, THEN the system SHALL CONTINUE TO produce a PDF blob with the correct project name, engineer name, and design code references.

---

## Bug Condition Pseudocode

### Bug Condition C1 — Pro Feature Accessible to Free Tier

```pascal
FUNCTION isBugCondition_C1(X)
  INPUT: X of type { userTier: Tier, featureName: string, billingBypass: boolean }
  OUTPUT: boolean

  RETURN X.userTier = 'free'
    AND X.billingBypass = false
    AND X.featureName IN {
      'advancedAnalysis', 'pdfExport', 'aiAssistant',
      'advancedDesignCodes', 'collaboration', 'bimExport', 'advancedMeshing'
    }
END FUNCTION

// Property: Fix Checking — UpgradeModal shown for gated features
FOR ALL X WHERE isBugCondition_C1(X) DO
  result ← renderFeatureTrigger'(X)
  ASSERT upgradeModalVisible(result) = true
  ASSERT featurePanelVisible(result) = false
END FOR

// Property: Preservation Checking
FOR ALL X WHERE NOT isBugCondition_C1(X) DO
  ASSERT renderFeatureTrigger(X) = renderFeatureTrigger'(X)
END FOR
```

### Bug Condition C2 — Displacement Unit Mismatch in PDF

```pascal
FUNCTION isBugCondition_C2(X)
  INPUT: X of type { displacements: Map<nodeId, {dx, dy, dz}> }
  OUTPUT: boolean

  // Bug triggers whenever displacements are present and the summary is generated
  RETURN X.displacements.size > 0
END FUNCTION

// Property: Fix Checking — maxDisp in summary is in mm
FOR ALL X WHERE isBugCondition_C2(X) DO
  report ← generateBasicPDFReport'(X)
  maxDispInReport ← extractSummaryMaxDisp(report)
  maxDispExpected ← max(|d.dx|, |d.dy|, |d.dz| for d in X.displacements) * 1000
  ASSERT abs(maxDispInReport - maxDispExpected) < 0.001
END FOR
```

### Bug Condition C3 — Hardcoded Placeholder Data in Report

```pascal
FUNCTION isBugCondition_C3(X)
  INPUT: X of type { projectName: string, engineerName: string }
  OUTPUT: boolean

  // Bug triggers whenever a project name or engineer name is available
  RETURN X.projectName != '' AND X.engineerName != ''
END FUNCTION

// Property: Fix Checking — report uses actual project/engineer data
FOR ALL X WHERE isBugCondition_C3(X) DO
  report ← generateReport'(X)
  ASSERT reportContains(report, X.projectName)
  ASSERT reportContains(report, X.engineerName)
  ASSERT NOT reportContains(report, 'BeamLab Project')
  ASSERT NOT reportContains(report, '"Engineer"')
END FOR
```

### Bug Condition C4 — Quality Checks Hardcoded

```pascal
FUNCTION isBugCondition_C4(X)
  INPUT: X of type { analysisResults: AnalysisResults, designResults: DesignResults }
  OUTPUT: boolean

  // Bug triggers whenever actual results are available but checks are hardcoded
  RETURN X.analysisResults != null AND X.designResults != null
END FUNCTION

// Property: Fix Checking — quality checks reflect actual results
FOR ALL X WHERE isBugCondition_C4(X) DO
  checks ← generateQualityChecks'(X.analysisResults, X.designResults)
  ASSERT checks.driftCheck.actual = X.analysisResults.maxDrift
  ASSERT checks.deflectionCheck.actual = X.analysisResults.maxDisplacement
  ASSERT checks.memberCheck.status = derivedFrom(X.designResults)
END FOR
```
