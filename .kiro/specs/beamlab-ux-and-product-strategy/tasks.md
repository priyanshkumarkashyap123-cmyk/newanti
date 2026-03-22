# Implementation Plan: BeamLab UX and Product Strategy

## Overview

Implementation is ordered by business impact: P0 tasks unblock trust and conversion, P1 tasks deliver core UX features, P2 tasks add polish and analytics instrumentation. All work is within `apps/web` (React SPA) and `apps/api` (Node API). No Rust or Python API changes are required.

---

## P0 — Trust and Conversion-Blocking

### Help Center (Requirements 1–2)

- [ ] 1. Create the `/docs` route and HelpCenterPage shell
  - Add a public `/docs` route to the React Router config (no auth guard)
  - Create `apps/web/src/pages/HelpCenterPage.tsx` with the `HelpCenterPageProps` interface
  - Implement sidebar category navigation (`guide`, `reference`, `tutorial`, `glossary`)
  - Wire the page into the Dashboard nav, Modeler toolbar, and account settings links
  - _Requirements: 1.1, 1.5, 2.5_

- [ ] 2. Implement client-side article search with fuse.js
  - Build the `HelpArticle` and `HelpSearchResult` interfaces in `HelpCenterPage.tsx`
  - Integrate `fuse.js` over the article index for sub-2-second client-side search
  - Render "No results found" with suggested related articles when no match exists
  - _Requirements: 1.4_

  - [ ]* 2.1 Write unit tests for HelpCenter search
    - Test: search returns empty array for a query with no matches
    - Test: search returns correct articles for known query terms
    - Test: all required article slugs are present in the article index
    - _Requirements: 1.2, 1.4_

- [ ] 3. Author the eight required launch articles as static MDX files
  - Create `apps/web/src/content/docs/` directory with MDX files for slugs:
    `getting-started`, `modeler-overview`, `first-analysis`, `interpreting-results`,
    `generating-report`, `pricing-plans`, `glossary`, `ai-assistant`
  - Include the Glossary page with all domain terms from the requirements glossary
  - _Requirements: 1.2, 1.5, 14.1_

- [ ] 4. Implement ContextualHelpPanel in the Modeler
  - Create `apps/web/src/components/ContextualHelpPanel.tsx` with `ContextualHelpPanelProps`
  - Build the `ToolHelpMap` mapping tool keys to article slugs
  - Add the persistent `?` help icon to the Modeler toolbar that opens the panel
  - Implement 1-second hover tooltips on all toolbar tools (name, description, shortcut)
  - Add "What's this?" links in every dialog header linking to the relevant Help Center article
  - _Requirements: 2.1, 2.2, 2.3_

---

### Onboarding Flow (Requirements 3–4)

- [ ] 5. Implement OnboardingFlow wizard component
  - Create `apps/web/src/components/onboarding/OnboardingFlow.tsx` with `OnboardingState` and `OnboardingFlowProps`
  - Implement the five steps: RoleSelection, UseCaseSelection, UnitSystemSelection, ExampleModelLoader, RunAnalysisPrompt
  - Render as a full-screen overlay immediately after first sign-up
  - Show success screen after step 5 with "Start your own project" CTA
  - Add "Restart tutorial" link in account settings
  - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [ ] 6. Persist onboarding progress and handle dismissal
  - Extend the user profile with `onboardingProgress` fields (see `UserProfileExtensions`)
  - Persist completed steps on each step completion via the Node API
  - On re-entry after dismissal, resume from the next uncompleted step
  - Default to `currentStep: 1, completedSteps: []` if profile state is corrupt
  - Record `onboarding_completed` event with timestamp on step 5 completion
  - _Requirements: 3.4, 3.6_

  - [ ]* 6.1 Write property test for onboarding step persistence (Property 11)
    - **Property 11: Onboarding Step Persistence**
    - For any session dismissed at step N, re-entry starts at step N+1 and never re-displays steps ≤ N
    - **Validates: Requirements 3.4**

  - [ ]* 6.2 Write unit tests for OnboardingFlow
    - Test: completing step 5 fires `onboarding_completed` analytics event
    - Test: dismissing at step 3 saves `completedSteps: [1, 2, 3]`
    - Test: re-entering after dismissal at step 3 starts at step 4
    - _Requirements: 3.4, 3.6_

- [ ] 7. Implement InteractiveTutorial with element targeting and auto-advance
  - Create `apps/web/src/components/tour/InteractiveTutorial.tsx` extending `TutorialOverlay.tsx`
  - Implement `TutorialStepDef` and `TutorialSequence` interfaces
  - Add visual overlay highlighting the `targetSelector` element at each step
  - Implement `completionEvent`-based auto-advance (no "Next" click required)
  - Implement "Skip tutorial" that dismisses and suppresses future auto-launch
  - Pause tutorial on Modeler navigation; offer resume on return
  - Author the four required sequences: `create-simple-beam`, `add-supports-and-loads`, `run-static-analysis`, `export-pdf-report`
  - Add welcome banner with "Take the tour" CTA shown on first Modeler open
  - _Requirements: 2.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

---

### Conversion Prompts (Requirements 10–11)

- [ ] 8. Implement ConversionPrompt component
  - Create `apps/web/src/components/ConversionPrompt.tsx` with `ConversionTrigger` union type and `ConversionPromptProps`
  - Render trigger-specific message copy and Pro plan CTA with monthly price for each of the six trigger types
  - Include "Maybe later" dismiss button on every prompt
  - _Requirements: 10.1–10.7_

  - [ ]* 8.1 Write unit tests for ConversionPrompt
    - Test: `trigger = 'project_limit'` renders the correct message
    - Test: dismiss button calls `onDismiss` without calling `onUpgrade`
    - _Requirements: 10.7_

- [ ] 9. Wire ConversionPrompts to all six trigger events
  - `project_limit`: fire when free-tier user saves and has reached max project count (Req 10.1, 11.1)
  - `public_project_notice`: show persistent notice on every free-tier project save (Req 10.2)
  - `pdf_watermark`: fire when free-tier user opens report export dialog (Req 10.3)
  - `design_module_gate`: fire when free-tier user accesses AISC/ACI/Eurocode design checks (Req 10.4, 11.5)
  - `model_size_limit`: fire when free-tier model exceeds 100 nodes or 200 members (Req 10.5, 11.2)
  - `ai_assistant_gate`: fire when free-tier user opens AI Assistant panel (Req 10.6, 11.6)
  - _Requirements: 10.1–10.6, 11.1–11.6_

- [ ] 10. Implement Dashboard usage counters for free-tier limits
  - Display current usage counts on Dashboard (e.g., "2 of 3 projects used") for each applicable limit
  - _Requirements: 11.8_

- [ ] 11. Checkpoint — Ensure all P0 tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## P1 — Core UX Features

### Warning Log and Repair Model (Requirements 5–6)

- [ ] 12. Implement pre-analysis model validation service
  - Create `apps/web/src/services/modelValidation.ts` with `validateModel(model): ValidationResult`
  - Detect and report errors: zero-length members, missing node references, unconnected nodes, no supports, no loads
  - Detect and report warnings: high aspect ratio (length/depth > 500), near-duplicate nodes (< 0.01 m), duplicate member definitions, empty load cases
  - Return structured `ValidationResult` with `ValidationIssue[]`, `errorCount`, `warningCount`
  - _Requirements: 5.1, 5.2, 5.3_

  - [ ]* 12.1 Write property test for validation detection completeness (Property 1)
    - **Property 1: Validation Detection Completeness**
    - For any model with one or more defined error/warning conditions, `validateModel` returns at least one issue of the correct severity per condition
    - **Validates: Requirements 5.2, 5.3**

  - [ ]* 12.2 Write unit tests for modelValidation
    - Test: `WarningLogPanel` renders 0 rows for an empty `ValidationResult`
    - Test: each error code is detected for a minimal model exhibiting that condition
    - _Requirements: 5.2, 5.3_

- [ ] 13. Implement WarningLogPanel component
  - Create `apps/web/src/components/WarningLogPanel.tsx` with `WarningLogPanelProps`
  - Render each issue with severity icon, human-readable description, and "Go to" button
  - "Go to" selects and centres the offending element in the viewport, highlights it red (error) or amber (warning)
  - Auto-open the panel when validation produces any issues
  - Keep panel accessible after analysis completes
  - _Requirements: 5.4, 5.5, 5.8_

  - [ ]* 13.1 Write property test for warning log entry count (Property 3)
    - **Property 3: Warning Log Entry Count Matches Validation Result**
    - For any `ValidationResult` with N total issues, `WarningLogPanel` renders exactly N rows
    - **Validates: Requirements 5.4**

  - [ ]* 13.2 Write unit tests for WarningLogPanel
    - Test: "Go to" button calls `onGoTo` with the correct issue
    - Test: "Repair Model" button calls `onRepair`
    - _Requirements: 5.4, 5.5_

- [ ] 14. Wire validation into the Run Analysis action
  - Run `validateModel` before any solver submission when user clicks "Run Analysis"
  - If `errorCount > 0`, block submission and update button label to "Fix N errors to run"
  - Re-run validation automatically within 500ms whenever the model changes; update Warning Log and button state
  - _Requirements: 5.1, 5.6, 5.7_

  - [ ]* 14.1 Write property test for analysis blocked by errors (Property 2)
    - **Property 2: Analysis Blocked by Errors**
    - For any model where `validateModel` returns `errorCount > 0`, the analysis submission function returns without calling the solver
    - **Validates: Requirements 5.6**

- [ ] 15. Implement RepairModel service
  - Create `apps/web/src/services/repairModel.ts` with `repairModel(model): RepairResult`
  - Implement: merge nodes within 0.01 m, remove zero-length members, remove exact duplicate members
  - Return `RepairResult` with patched model (new reference), `RepairSummary`, and `hasChanges`
  - If no fixable issues found, return `hasChanges: false` and display "No automatic repairs needed"
  - Push repair operation onto the undo history stack when `hasChanges = true`
  - Display summary notification listing each fix type and count after repair
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

  - [ ]* 15.1 Write property test for repair model idempotency (Property 4)
    - **Property 4: Repair Model Idempotency**
    - `repairModel(repairModel(m).model).summary.totalFixes === 0` for any model
    - **Validates: Requirements 6.2, 6.4**

  - [ ]* 15.2 Write property test for repair model undo stack growth (Property 5)
    - **Property 5: Repair Model Undo Stack Growth**
    - When `repairModel` returns `hasChanges = true`, undo history stack length increases by exactly 1
    - **Validates: Requirements 6.4**

  - [ ]* 15.3 Write unit tests for repairModel
    - Test: clean model returns `hasChanges: false` and `totalFixes: 0`
    - Test: two nodes at (0,0,0) and (0.005,0,0) returns `mergedNodes: 1`
    - Test: model with a zero-length member returns `removedZeroLengthMembers: 1`
    - _Requirements: 6.2, 6.3_

- [ ] 16. Checkpoint — Ensure all validation and repair tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

### Results Viewer (Requirement 7)

- [ ] 17. Implement ResultsViewer component and state
  - Create `apps/web/src/components/ResultsViewer.tsx` with `ResultsViewerProps` and `ResultsViewerState`
  - Render colour-coded force diagrams (moment, shear, axial) overlaid on the 3D viewport using the diverging colour scale from the design doc
  - Display colour scale legend with min/max values and units
  - Implement toggle controls for each result type (moment, shear, axial, deflection)
  - Display support reactions as labelled arrows with hover tooltips showing magnitude and direction
  - Switch between load cases/combinations within 300ms without full geometry re-render
  - _Requirements: 7.1, 7.4, 7.6, 7.7_

- [ ] 18. Implement force diagram hover tooltip and member detail panel
  - Show `ForceTooltipData` tooltip on hover: exact force value, member ID, fractional position
  - On member selection, open side panel showing full force diagram with values at start, midpoint, and end node
  - Highlight selected member and link to CalculationReport
  - _Requirements: 7.2, 7.5_

- [ ] 19. Implement deflected shape animation
  - Animate structure from undeformed to deflected position when user selects "Deflected Shape"
  - Expose user-adjustable scale factor (default 100×)
  - _Requirements: 7.3_

---

### Calculation Reports (Requirement 8)

- [ ] 20. Implement CalculationReport component
  - Create `apps/web/src/components/CalculationReport.tsx` with `CalculationReportProps` and `LimitStateCheck` interface
  - Display each limit state check: demand, capacity, utilization ratio, governing combo, code clause reference, pass/fail badge
  - Identify and display `controllingCheck` (highest utilization ratio) at the top with pass/fail badge
  - Highlight failed members (utilization > 1.0) in red in the viewport with utilization ratio label
  - _Requirements: 8.1, 8.2, 8.3, 8.6_

  - [ ]* 20.1 Write property test for controlling check (Property 16)
    - **Property 16: Calculation Report Controlling Check**
    - `controllingCheck` is always the check with the highest `utilizationRatio` and appears first when rendered
    - **Validates: Requirements 8.2, 8.3**

  - [ ]* 20.2 Write unit tests for CalculationReport
    - Test: all-passing checks render no fail badge
    - Test: one failing check (utilization > 1.0) renders fail badge on controlling check
    - Test: controlling check is always the first row
    - _Requirements: 8.2, 8.3_

---

### Report Generator (Requirement 9)

- [ ] 21. Implement ReportExportDialog component
  - Create `apps/web/src/components/ReportExportDialog.tsx` with `TitleBlockConfig`, `ReportSectionSelection`, and `ReportExportDialogProps`
  - Render form fields for project name, engineer name, company name, project number, date, and logo upload
  - Persist logo as base64 data URL in the project document (`ProjectReportConfig`)
  - Render section checkboxes for all nine report sections
  - Show PDF generation timeout error toast if generation exceeds 10 seconds
  - _Requirements: 9.1, 9.2, 9.3, 9.6_

- [ ] 22. Implement PDF generation with watermark logic and shareable link
  - Apply "BeamLab Free" watermark on every page for free-tier users
  - Produce unbranded PDF for pro/enterprise users
  - Use `BrandingConstants.ts` tokens for title block (navy header bar, gold accent stripe)
  - Offer direct download and "Copy shareable link" (7-day expiry via `POST /api/reports/share`)
  - Implement `GET /api/reports/share/:token` public endpoint; return HTTP 410 after expiry
  - _Requirements: 9.4, 9.5, 9.7_

  - [ ]* 22.1 Write property test for tier watermark invariant (Property 6)
    - **Property 6: Tier Watermark Invariant**
    - Free-tier PDFs always contain "BeamLab Free" on every page; pro/enterprise PDFs never contain it
    - **Validates: Requirements 9.4, 9.5, 11.4**

  - [ ]* 22.2 Write property test for report section selection fidelity (Property 7)
    - **Property 7: Report Section Selection Fidelity**
    - Generated PDF contains content for every selected section and no content for unselected sections
    - **Validates: Requirements 9.3**

- [ ] 23. Checkpoint — Ensure all report and results tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

### Dual Input Mode (Requirement 12)

- [ ] 24. Implement SpreadsheetInputPanel for nodes and members
  - Create `apps/web/src/components/SpreadsheetInputPanel.tsx` with `NodeRow`, `MemberRow`, and `SpreadsheetInputPanelProps`
  - Implement node spreadsheet: rows with editable X, Y, Z columns; update 3D viewport within 200ms on edit
  - Implement member spreadsheet: rows with member ID, start node, end node, section profile; update viewport within 200ms
  - Add toolbar toggle to show/hide the panel
  - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [ ] 25. Implement CommandBar for coordinate input
  - Create `apps/web/src/components/CommandBar.tsx` with `ParsedCoordinate` and `CommandBarProps`
  - Implement `parseCoordinateInput` supporting absolute ("X, Y, Z") and relative ("@dX, dY, dZ") formats
  - Display snapped coordinates in the status bar when grid snapping is active
  - _Requirements: 12.7_

  - [ ]* 25.1 Write property test for coordinate command bar round-trip (Property 13)
    - **Property 13: Coordinate Command Bar Round-Trip**
    - `parseCoordinateInput("X, Y, Z")` returns correct absolute coords; `parseCoordinateInput("@dX, dY, dZ", P)` returns `P + delta`
    - **Validates: Requirements 12.7**

  - [ ]* 25.2 Write unit tests for CommandBar
    - Test: `parseCoordinateInput("abc")` returns `null`
    - Test: `parseCoordinateInput("@1.5, 0, 0")` with last node `{x:1, y:0, z:0}` returns `{x:2.5, y:0, z:0, isRelative:true}`
    - _Requirements: 12.7_

- [ ] 26. Implement grid snapping in the graphical canvas
  - Add configurable grid spacing (default 0.5 m) with toolbar toggle and `G` key shortcut
  - Snap placed nodes to nearest grid intersection; display snapped coordinates in status bar
  - _Requirements: 12.5, 12.6_

  - [ ]* 26.1 Write property test for grid snapping invariant (Property 12)
    - **Property 12: Grid Snapping Invariant**
    - For any node placed with grid snapping enabled and spacing G, all coordinates are multiples of G within 1e-9 tolerance
    - **Validates: Requirements 12.5, 12.6**

---

### Section Library and Load Combinations (Requirement 13)

- [ ] 27. Implement SectionLibraryBrowser component
  - Create `apps/web/src/components/SectionLibraryBrowser.tsx` with `SectionFilter`, `SectionProperties`, and `SectionLibraryBrowserProps`
  - Populate AISC (W, S, C, L, HSS), IS (ISMB, ISMC, ISA, ISHB), and Eurocode (IPE, HEA, HEB, UB, UC) profiles
  - Implement filter controls: design code, profile family, depth range, weight range
  - Display key section properties (area, Ix, Iy, Sx, Sy, weight/m) before user confirms selection
  - Accessible from the member properties panel
  - _Requirements: 13.1, 13.2, 13.3_

  - [ ]* 27.1 Write property test for section library filter fidelity (Property 14)
    - **Property 14: Section Library Filter Fidelity**
    - Every section returned by `filterSections` satisfies all non-null filter criteria; no violating section appears in results
    - **Validates: Requirements 13.2**

- [ ] 28. Implement Load Combination Generator
  - Build the Load Combination Generator accessible from the loads panel
  - Support ASCE 7-22, IS 875 Part 5, and EN 1990 design codes
  - On confirmation, generate all required strength and serviceability combinations and add them to the model
  - _Requirements: 13.4, 13.5_

- [ ] 29. Implement Apply Self-Weight feature
  - Compute self-weight per member from section area, material density, and length: `ρ × A × 1e-6 × g` kN/m
  - Add computed load as a distributed load in the active gravity load case
  - _Requirements: 13.6_

  - [ ]* 29.1 Write property test for self-weight computation correctness (Property 15)
    - **Property 15: Self-Weight Computation Correctness**
    - Computed self-weight equals `ρ × A × 1e-6 × g` kN/m within 0.01% relative tolerance
    - **Validates: Requirements 13.6**

---

### AI Assistant UX (Requirement 14)

- [ ] 30. Implement AI Assistant onboarding tooltip and discoverability
  - Show onboarding tooltip with three example prompts on first AI Assistant panel open
  - Add persistent "How to use" link in the AI Assistant panel linking to the Help Center article
  - Display descriptive error message when AI service is unavailable (no blank panel or raw error)
  - _Requirements: 14.2, 14.3, 14.5_

- [ ] 31. Implement AI Assistant model-change confirmation dialog
  - Show confirmation dialog with proposed change before applying any AI suggestion that modifies the model
  - Record confirmed AI changes in the undo history
  - _Requirements: 14.4_

- [ ] 32. Checkpoint — Ensure all P1 tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## P2 — Polish and Analytics

### Social Proof and Landing Page (Requirement 15)

- [ ] 33. Implement trust bar and social proof sections on LandingPage
  - Add trust bar component using `BEAMLAB_COLORS.navy` background and `BEAMLAB_COLORS.gold` accent
  - Fetch stats from `GET /api/public/trust-stats` (1-hour cache); fall back to `localStorage` key `trust_bar_cache` on failure; render "—" if no cache exists
  - Implement `GET /api/public/trust-stats` endpoint in Node API (in-memory cache, 1-hour TTL)
  - Add testimonials section with three role-attributed quotes (no PII/full names)
  - Add case studies section with three worked examples (project description, model screenshot, analysis type, design code)
  - _Requirements: 15.2, 15.3, 15.4_

  - [ ]* 33.1 Write unit tests for trust bar
    - Test: renders cached values when endpoint returns 500
    - Test: renders "—" when no cache exists and endpoint fails
    - _Requirements: 15.4_

- [ ] 34. Implement "Try a live example" anonymous CTA
  - Add "Try a live example" CTA on LandingPage that loads a pre-built example model in the Modeler without requiring account creation
  - _Requirements: 15.5_

---

### Conversion Funnel Analytics (Requirement 16)

- [ ] 35. Implement useAnalytics hook with typed funnel events
  - Create `apps/web/src/hooks/useAnalytics.ts` with `FunnelEvent` union type, `FunnelEventPayload`, and `UseAnalyticsReturn`
  - Implement `trackFunnel`: silently drop events when `analyticsConsent = false`
  - Exclude all PII fields from payloads (only `userId` anonymised + `sessionId` permitted)
  - Queue failed events in `sessionStorage` (max 50); retry with exponential backoff (1s, 2s, 4s, max 3 retries); silently drop after max retries
  - _Requirements: 16.1, 16.2, 16.4, 16.5_

  - [ ]* 35.1 Write property test for funnel event PII exclusion (Property 9)
    - **Property 9: Funnel Event PII Exclusion**
    - No funnel event payload contains `email`, `name`, `firstName`, `lastName`, `phone`, or `ipAddress`
    - **Validates: Requirements 16.4**

  - [ ]* 35.2 Write property test for analytics opt-out enforcement (Property 10)
    - **Property 10: Analytics Opt-Out Enforcement**
    - For any user with `analyticsConsent = false`, `trackFunnel` does not invoke the analytics endpoint
    - **Validates: Requirements 16.5**

  - [ ]* 35.3 Write unit tests for useAnalytics
    - Test: `trackFunnel` with `analyticsConsent = false` does not call the endpoint
    - Test: `trackFunnel` payload does not contain `email` or `name` fields
    - _Requirements: 16.4, 16.5_

- [ ] 36. Wire funnel events to all trigger points
  - Instrument: `page_view_landing`, `signup_started`, `signup_completed`, `onboarding_completed`, `first_analysis_run`
  - Instrument: `upgrade_prompt_shown` (with `triggerType`) on every `ConversionPrompt` display
  - Instrument: `upgrade_cta_clicked`, `checkout_started`, `checkout_completed`
  - Record each `ConversionPrompt` display event with trigger type and user tier
  - _Requirements: 10.8, 16.1, 16.2_

- [ ] 37. Implement funnel stats API endpoint
  - Create `GET /api/admin/funnel-stats?from=ISO&to=ISO` (admin-only) returning aggregate counts per funnel event over the date range
  - Create `funnel_events` table/collection in the Node API database with `FunnelEventRecord` schema (no PII fields)
  - _Requirements: 16.3, 16.4_

  - [ ]* 37.1 Write integration test for funnel event delivery
    - Test: trigger `upgrade_prompt_shown` → event appears in `/api/admin/funnel-stats`
    - _Requirements: 16.1, 16.3_

- [ ] 38. Final checkpoint — Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Property tests use `fast-check` (already in the codebase) with a minimum of 100 iterations per property
- Each property test file includes the tag comment: `// Feature: beamlab-ux-and-product-strategy, Property N: <property_text>`
- Test file locations follow the paths defined in the design document (section 6.5)
- All new components use existing tokens from `apps/web/src/styles/theme.ts` and `apps/web/src/constants/BrandingConstants.ts`
