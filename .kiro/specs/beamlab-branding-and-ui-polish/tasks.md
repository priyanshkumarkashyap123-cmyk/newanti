# Implementation Plan

- [x] 1. Write bug condition exploration tests
  - **Property 1: Bug Condition** - Hardcoded Branding Strings (C1, C2, C3)
  - **CRITICAL**: These tests MUST FAIL on unfixed code — failure confirms the bugs exist
  - **DO NOT attempt to fix the tests or the code when they fail**
  - **NOTE**: These tests encode the expected behavior — they will validate the fix when they pass after implementation
  - **GOAL**: Surface counterexamples that demonstrate all three bug conditions exist
  - **Scoped PBT Approach**: Scope each property to the concrete failing case to ensure reproducibility
  - C1: Import `BEAMLAB_COMPANY` from `BrandingConstants.ts`, assert `BEAMLAB_COMPANY.name === 'BeamLab Ultimate'` — will FAIL (returns `'BeamLab'`)
  - C2: Render `ReportsPage` with store state `projectInfo.name = 'Tower A'`, assert cover `<h2>` text equals `'Tower A'` — will FAIL (shows `'BeamLab Project'`)
  - C3: Spy on `generateProfessionalReport`, set store `projectInfo.name = 'Tower A'`, trigger `handleExportPDF`, assert spy was called with `name === 'Tower A'` — will FAIL (passes `'BeamLab Project'`)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: All three tests FAIL (this is correct — it proves the bugs exist)
  - Document counterexamples found: `BEAMLAB_COMPANY.name` returns `'BeamLab'`; cover title renders `'BeamLab Project'`; export handler passes `'BeamLab Project'`
  - Mark task complete when tests are written, run, and failures are documented
  - Files: `apps/web/src/constants/__tests__/BrandingConstants.test.ts`, `apps/web/src/pages/__tests__/ReportsPage.test.tsx`
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Other Constants and PDF Structure Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe: all `BEAMLAB_COMPANY` fields other than `name` on unfixed code (`generatedByLine`, etc.)
  - Observe: `BEAMLAB_COLORS`, `BEAMLAB_COLORS_RGB`, `BEAMLAB_LOGO` values on unfixed code
  - Write property-based test: for all field keys in `BEAMLAB_COMPANY` other than `name`, the value matches the known correct value
  - Write property-based test: for any valid non-empty project name string, `generateDesignReport` / `generateProfessionalReport` produces the same document structure (sections, page count) as before
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - Files: `apps/web/src/constants/__tests__/BrandingConstants.test.ts`, `apps/web/src/services/__tests__/PDFReportService.test.ts`
  - _Requirements: 3.1, 3.3, 3.5_

- [x] 3. Fix hardcoded branding strings

  - [x] 3.1 Fix `BEAMLAB_COMPANY.name` in BrandingConstants.ts
    - Change `name: 'BeamLab'` → `name: 'BeamLab Ultimate'` (single line change)
    - Update the `BEAMLAB_COMPANY` mock in `apps/web/src/services/__tests__/PDFReportService.test.ts` from `name: 'BeamLab'` to `name: 'BeamLab Ultimate'` to keep mock consistent
    - _Bug_Condition: isBugCondition_C1(constant) where constant.name === 'BeamLab'_
    - _Expected_Behavior: BEAMLAB_COMPANY.name === 'BeamLab Ultimate' for all consumers_
    - _Preservation: generatedByLine, BEAMLAB_COLORS, BEAMLAB_COLORS_RGB, BEAMLAB_LOGO must remain unchanged_
    - _Requirements: 2.1, 3.1, 3.5_

  - [x] 3.2 Wire ReportsPage.tsx cover title and export handlers to project store
    - Add store selector at top of component: `const projectName = useModelStore((s) => s.projectInfo?.name) ?? 'Untitled Project'`
    - Replace cover page `<h2>` literal `'BeamLab Project'` with `{projectName}` (~line 402)
    - Replace document control table `<td>` literal `'BeamLab Project'` with `{projectName}` (~line 415, both occurrences)
    - Replace both `name: 'BeamLab Project'` occurrences in `handleExportPDF` with `name: projectName`
    - Replace hardcoded string in `handleExportIFC` with `projectName`
    - Replace hardcoded string in `handleExportExcel` with `projectName`
    - Replace inline literal in executive summary paragraph (~line 551) with `{projectName}`
    - _Bug_Condition: isBugCondition_C2 where cover title source === 'BeamLab Project' (literal); isBugCondition_C3 where export arg === 'BeamLab Project' (literal)_
    - _Expected_Behavior: cover title and all export handlers read projectInfo.name from store; fallback to 'Untitled Project' when store value is absent_
    - _Preservation: PDF document structure, export logic, and all other ReportsPage behavior unchanged_
    - _Requirements: 2.2, 2.3, 3.3_

  - [x] 3.3 Audit and fix layout/navigation branding (Part 3)
    - For each page in the audit table, check whether it renders inside AppShell or ModernWorkspace (which already provide `<Logo>`) — if so, no change needed
    - For standalone pages that render their own header without delegating to AppShell/ModernWorkspace, add `<Logo size="sm" variant="full" />` to the header element
    - Pages to audit: `Dashboard.tsx`, `FoundationDesignPage.tsx`, `ConnectionDesignPage.tsx`, `SteelDesignPage.tsx`, `ConcreteDesignPage.tsx`, `StructuralDesignCenter.tsx`, `PostAnalysisDesignHub.tsx`, `UnifiedDashboard.tsx`, `LandingPage.tsx`, `FeatureNavigation.tsx`
    - A page passes if its header/nav renders `<Logo>` (any variant) or delegates to a parent layout that already does
    - _Bug_Condition: standalone page renders dark header without <Logo>_
    - _Expected_Behavior: all key pages display BeamLab Ultimate logo in header/nav_
    - _Preservation: Logo component rendering logic, SVG assets, variant/size API, and accessibility attributes must remain unchanged; pages already using design system must not regress_
    - _Requirements: 2.4, 3.2, 3.4_

  - [x] 3.4 Verify bug condition exploration tests now pass
    - **Property 1: Expected Behavior** - Hardcoded Branding Strings Fixed
    - **IMPORTANT**: Re-run the SAME tests from task 1 — do NOT write new tests
    - The tests from task 1 encode the expected behavior
    - When these tests pass, it confirms all three bug conditions are resolved
    - Run C1, C2, C3 exploration tests from step 1
    - **EXPECTED OUTCOME**: All three tests PASS (confirms bugs are fixed)
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Other Constants and PDF Structure Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all preservation tests still pass after fix
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 4. Checkpoint — Ensure all tests pass
  - Run the full test suite for affected files: `BrandingConstants.test.ts`, `ReportsPage.test.tsx`, `PDFReportService.test.ts`
  - Ensure all tests pass; ask the user if any questions arise
