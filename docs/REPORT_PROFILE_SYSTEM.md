# Report Generation & Optimized SFD/BMD Profile System

**Status:** Phase 5 Complete — Implementation Ready  
**Date:** March 9, 2026  
**Scope:** Full UI + Export Report Support

---

## Overview

This document describes the **Report Profile System** for BeamLab — a unified mechanism to let users request specific report outputs (Full Engineering Report, Optimization Summary, or SFD/BMD-Only Diagrams) consistently across both:

1. **Optimization/Results Screens** — Live visualization in the app
2. **Generated Reports** — PDF/DOCX/HTML export

The system uses **three preset profiles** that automatically configure section visibility and diagram types, eliminating manual checkbox tweaking.

---

## Profile Definitions

### 1. FULL_REPORT
**Use case:** Complete professional documentation for permitting, design review, or archival.

**Includes:**
- ✅ Cover page (project metadata)
- ✅ Table of Contents
- ✅ Input Summary (geometry, loads, supports)
- ✅ Load Cases & Load Combinations
- ✅ Analysis Results (displacements, reactions, forces)
- ✅ Design Checks (IS 800 compliance tables)
- ✅ All Diagrams: SFD, BMD, Deflection, AFD, Weak-axis moments/shears
- ✅ Concrete/Foundation/Connection Design (design code checks)

**Behavior:**
- All diagram types rendered in optimization screen
- Selected load case used for SFD/BMD (not forced envelope)
- Metadata included: full company/project information

**Output:** 10–20 page PDF with exhaustive results

---

### 2. OPTIMIZATION_SUMMARY
**Use case:** Compact variant comparison during FSD (Fully Stressed Design) optimization iterations.

**Includes:**
- ✅ Cover page (minimal)
- ✅ Input Summary (geometry only)
- ✅ Design Checks (utilization ratios, pass/fail)
- ✅ Primary Diagrams: SFD, BMD, Deflection (no AFD, no weak-axis)
- ❌ Load details, node displacements, reactions
- ❌ Weak-axis diagrams, connection design details

**Behavior:**
- Focuses on critical design results
- Deflection included for limit state checks
- Suitable for side-by-side variant comparison
- Selected load case used

**Output:** 3–5 page PDF with design summary + primary diagrams

---

### 3. SFD_BMD_ONLY
**Use case:** Minimal field/quick-check output — just shear and moment diagrams for a specific load case.

**Includes:**
- ✅ Minimal header (project name, load case ID, date)
- ✅ SFD (Shear Force Diagram)
- ✅ BMD (Bending Moment Diagram)
- ❌ Everything else

**Behavior:**
- Renders SFD + BMD for currently selected load case in UI
- Metadata minimized (one-line header with load case context)
- Perfect for code reviews or on-site verification
- No verbose text; pure diagrams

**Output:** 1–2 page PDF, diagram-centric

---

## Architecture

### Frontend (TypeScript/React)

**Profile Type System** (`apps/web/src/types/reportProfiles.ts`):
```typescript
enum ReportProfile {
  FULL_REPORT = 'FULL_REPORT',
  OPTIMIZATION_SUMMARY = 'OPTIMIZATION_SUMMARY',
  SFD_BMD_ONLY = 'SFD_BMD_ONLY',
}

// Centralized mapping of profile → section toggles
const PROFILE_SPECS: Record<ReportProfile, ReportProfileSpec> = {...}

// Helper functions for profile queries
export function getProfileSections(profile: ReportProfile): ProfileSectionConfig
export function getProfileDiagrams(profile: ReportProfile): ProfileDiagramConfig
export function shouldUseMinimalMetadata(profile: ReportProfile): boolean
```

**UI Integration** (`apps/web/src/components/ReportCustomizationDialog.tsx`):
- New "Presets" tab in report dialog
- Three buttons: select profile with one click
- Auto-switches to "Content" tab for per-section customization if desired
- Manual toggle changes clear profile selection (non-destructive)

**Store Integration** (`apps/web/src/store/model.ts`):
```typescript
applyDiagramProfile: (profile: 'FULL_REPORT' | 'OPTIMIZATION_SUMMARY' | 'SFD_BMD_ONLY') => void
```
- Called by optimization/results screens to apply profile diagram visibility
- Sets `showSFD`, `showBMD`, etc. based on profile
- Allows UI to immediately show/hide diagrams

**Report Generation Service** (`apps/web/src/services/reports/ReportGeneratorService.ts`):
- Passes selected profile to backend via `ReportCustomization` model
- Include `selected_load_case_id` from UI's active load case

---

### Backend (Python FastAPI)

**Customization Model** (`apps/backend-python/routers/reports.py`):
```python
class ReportCustomization(BaseModel):
    profile: Optional[Literal["FULL_REPORT", "OPTIMIZATION_SUMMARY", "SFD_BMD_ONLY"]] = None
    
    # Section toggles (extended list)
    include_cover_page: bool = True
    include_toc: bool = True
    include_input_summary: bool = True
    ... (14 toggles total)
    
    # Granular diagram controls
    include_sfd: bool = True
    include_bmd: bool = True
    include_deflection: bool = True
    include_afd: bool = True
    include_bmd_my: bool = False
    include_shear_z: bool = False
    
    # Context
    selected_load_case_id: Optional[str] = None
    minimal_metadata: bool = False
```

**Profile Application Function** (`apps/backend-python/routers/reports.py`):
```python
def apply_profile_to_customization(customization: ReportCustomization) -> ReportCustomization:
    """Apply profile presets to customize sections and diagrams."""
    # Defines hardcoded profile configs (mirror of TypeScript specs)
    # Applies section toggles based on profile selection
    # Returns modified customization
```

**Report Generation** (`apps/backend-python/analysis/report_generator.py`):
- Extended `ReportSettings` with all new toggles
- Endpoint (`/reports/generate`) calls `apply_profile_to_customization()` before creating settings
- Report sections gated by individual toggles (e.g., `if settings.include_deflection: _add_deflection()`)
- Diagram rendering respects granular toggles: only renders requested SFD/BMD/AFD/etc.

---

## Data Flow

### Scenario: User requests "SFD_BMD_ONLY" report

**Frontend:**
1. User clicks "Presets" tab in ReportCustomizationDialog
2. Selects "SFD / BMD Only" card
3. Dialog applies profile:
   - `setSelectedProfile('SFD_BMD_ONLY')`
   - Merges profile sections + diagrams into local state
   - `include_sfd: true, include_bmd: true, include_deflection: false, ...`
4. User clicks "Generate Report"
5. Frontend constructs request:
   ```json
   {
     "analysis_data": {...},
     "customization": {
       "profile": "SFD_BMD_ONLY",
       "include_sfd": true,
       "include_bmd": true,
       "include_deflection": false,
       ...
       "selected_load_case_id": "LC_LIVE"
     }
   }
   ```

**Backend:**
1. Endpoint receives `POST /reports/generate` with customization
2. Calls `apply_profile_to_customization()`:
   - Looks up profile in hardcoded dict
   - Overwrites all section toggles  
   - Sets metadata minimization flags
3. Creates `ReportSettings` with applied toggles
4. `ReportGenerator.generate_report()`:
   - Skips cover page (no, wait — SFD_BMD_ONLY keeps it), TOC, input, analysis results
   - Only renders diagrams: respects `include_sfd`, `include_bmd`
   - Uses `selected_load_case_id` instead of forcing envelope
5. Returns 1–2 page PDF with SFD/BMD for selected load case

---

## Implementation Details

### Sign Conventions

**BMD (Bending Moment Diagram):**
- **Positive:** Sagging (compression at top flange, tension at bottom) — drawn above baseline per IS 456
- **Negative:** Hogging (tension at top flange, compression at bottom) — drawn below baseline

**SFD (Shear Force Diagram):**
- **Positive:** Right-hand rule (upward on left face, downward on right face)
- **Negative:** Opposite

**Axial Force Diagram (AFD):**
- **Positive:** Tension
- **Negative:** Compression

**Weak-axis diagrams** (`include_bmd_my`, `include_shear_z`):
- `BMD_My`: Moment about Y-axis (XZ plane bending)
- `SFD_Vz`: Shear along Z-axis (XZ plane shear)

All signs preserved in export for code-compliant design checks.

### Load Case Selection Rule

When `selected_load_case_id` is provided (not null), use that specific load case for SFD/BMD rendering.

**Rationale:** Users want to compare a specific load case across optimized variants, not a forced envelope.

**Default:** If `selected_load_case_id` is null, backend defaults to critical LC or envelope (per existing logic).

### Backward Compatibility

- **Old requests without profile:** Work as-is. All toggles default to true (full report mode).
- **Legacy include_diagrams gate:** Still respected. If false, no diagrams regardless of granular toggles.
- **Granular toggles override:** If provided, take precedence over `include_diagrams`. Allows fine-grained control.

---

## Testing

### Unit Tests (TypeScript)

**File:** `apps/web/src/__tests__/types/reportProfiles.test.ts`

Coverage:
- ✅ Profile specs defined correctly
- ✅ Helper functions return correct configs
- ✅ Consistency checks (SFD/BMD pair, etc.)
- ✅ Load case context preserved
- ✅ Backward compatibility with legacy toggles

Run:
```bash
pnpm test reportProfiles.test.ts
```

### Unit Tests (Python)

**File:** `apps/backend-python/tests/test_report_profiles.py`

Coverage:
- ✅ `apply_profile_to_customization()` for each profile
- ✅ Granular diagram toggle independence
- ✅ Metadata minimization flags
- ✅ Load case context passed through
- ✅ Unknown profile handling (no crash)
- ✅ Profile overrides manual toggles

Run:
```bash
pytest apps/backend-python/tests/test_report_profiles.py -v
```

### Integration Tests

**Scenario A: Optimization Screen**
1. Run analysis → results panel shows
2. Click "SFD / BMD Only" report preset
3. Verify SFD + BMD render in viewport (other diagrams hidden)
4. Export report → 1-page PDF with SFD/BMD only

**Scenario B: Full Report**
1. Run analysis → results panel shows
2. Click "Full Report" preset
3. Verify all diagrams render
4. Export → 15+ page PDF with all sections

**Scenario C: Load Case Persistence**
1. Select "LC_LIVE" in load case dropdown
2. Select "SFD_BMD_ONLY" preset
3. Export report
4. Verify SFD/BMD are for LC_LIVE, not envelope

---

## Deployment Checklist

- [ ] **Frontend:** Deploy `reportProfiles.ts` type system
- [ ] **Frontend:** Update `ReportCustomizationDialog.tsx` with preset selector
- [ ] **Frontend:** Extend `model.ts` store with `applyDiagramProfile()` action
- [ ] **Backend:** Extend `ReportCustomization` model in `reports.py`
- [ ] **Backend:** Add `apply_profile_to_customization()` function
- [ ] **Backend:** Update `ReportSettings` in `report_generator.py`
- [ ] **Backend:** Update report endpoint to call `apply_profile_to_customization()`
- [ ] **Tests:** Run TypeScript profile tests
- [ ] **Tests:** Run Python profile tests
- [ ] **Manual Testing:** Verify all three profiles in dev/staging
- [ ] **Docs:** Update user guide with preset descriptions
- [ ] **Release Notes:** Document profile feature + load case selection rule

---

## Known Limitations & Future Work

### Current (Acceptable for v1)
- Profile names are case-sensitive (must be `FULL_REPORT`, not `full_report`)
- No UI for editing profile defaults (preset-only)
- DPI for PDF fixed at 2x scale (adequate for screen, may need 300 DPI for print)

### Future Enhancements
- [ ] **User-defined profiles:** Save custom presets per project
- [ ] **Peak value annotations:** Label max/min SFD/BMD values on diagrams
- [ ] **Multi-page diagram layout:** For large structures, span SFD/BMD across pages
- [ ] **Weak-axis diagrams in presets:** Add toggle for easy `My`/`Vz` inclusion
- [ ] **Dynamic load case selector in report dialog:** Choose LC without closing dialog
- [ ] **Profile templates by code:** AISC-specific, EC3-specific profiles

---

## References

- **TypeScript Profile Types:** [reportProfiles.ts](../apps/web/src/types/reportProfiles.ts)
- **Frontend UI Component:** [ReportCustomizationDialog.tsx](../apps/web/src/components/ReportCustomizationDialog.tsx)
- **Store Integration:** [model.ts](../apps/web/src/store/model.ts) — `applyDiagramProfile()`
- **Backend Schema:** [reports.py](../apps/backend-python/routers/reports.py) — `ReportCustomization`, `apply_profile_to_customization()`
- **Report Generator:** [report_generator.py](../apps/backend-python/analysis/report_generator.py) — `ReportSettings`, `ReportGenerator`
- **Unit Tests (TS):** [reportProfiles.test.ts](../apps/web/src/__tests__/types/reportProfiles.test.ts)
- **Unit Tests (Python):** [test_report_profiles.py](../apps/backend-python/tests/test_report_profiles.py)
- **Capture Reliability:** [PHASE4_CAPTURE_RELIABILITY.md](./PHASE4_CAPTURE_RELIABILITY.md)

---

**Implementation Status:** ✅ **COMPLETE**

All five phases delivered:
1. ✅ Profile contract types (TypeScript enum, specs, helpers)
2. ✅ Python backend schema extension with profile support
3. ✅ Frontend UI preset selector and store integration
4. ✅ Backend profile application and section gating
5. ✅ Capture reliability documented; tests written; documentation complete

**Ready for:** Testing, UAT, Production Deployment
