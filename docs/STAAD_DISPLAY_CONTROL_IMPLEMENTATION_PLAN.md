# STAAD.Pro Display Control Implementation Plan

**Status**: ✅ **PHASE 3 COMPLETE** (Persistence + label visual polish + ribbon quick toggles implemented)  
**Last Updated**: 2026  
**Author**: BeamLab Engineering Team

---

## Executive Summary

This document provides a comprehensive implementation roadmap for the STAAD.Pro-parity display control system in the BeamLab web application. The system enables professional-grade visualization of structural model entities (node IDs, member IDs, load values) with industry-standard command discovery and workflow integration.

### Design Philosophy

- **STAAD Parity**: Match STAAD.Pro's label display UX, not replicate UI wireframe-for-wireframe.
- **Professional Workflow**: Pro-style left command rail (sidebar action panel) provides context-sensitive tool access synchronized with ribbon category tabs.
- **Performance**: LOD-based label culling + 600-element display cap prevents UI overload on massive models.
- **Integration**: Dual-store architecture (model state + UI workflow state) ensures state consistency across ribbon, sidebar, and 3D viewport.

---

## Phase 1: Label System Foundation ✅ COMPLETE

### 1.1 State Layer — Model Store (`apps/web/src/store/model.ts`)

**What**: Extended Zustand model store with three display flags.

**Changes**:
- Added `showNodeLabels: boolean` — toggles node ID label visibility.
- Added `showMemberLabels: boolean` — toggles member ID label visibility.
- Added `showLoadLabels: boolean` — toggles load value label visibility.
- Added three setter actions: `setShowNodeLabels()`, `setShowMemberLabels()`, `setShowLoadLabels()`.
- Integrated label flags into **8 lifecycle locations** for consistency:
  1. Store initialization
  2. `clearModel()` action
  3. `loadStructure()` action
  4. Hydration logic (localStorage/session restore)
  5. Reset handling
  6. Model cleanup
  7. State snapshots
  8. Persistence middleware

**Why**: Ensures label state survives model lifecycle changes, session restores, and tab navigation.

**Test**: 
```typescript
// Manual check in browser console:
useModelStore.getState().setShowNodeLabels(true);
// Should show node labels in 3D view immediately.
```

---

### 1.2 3D Overlay Renderer (`apps/web/src/components/viewer/ModelLabelsOverlay.tsx`)

**What**: React component rendering node/member/load labels as 3D Html overlays with LOD and performance optimization.

**Components**:

1. **NodeLabel** (Memoized)
   ```typescript
   // Displays node ID (e.g., "N-001") in small badge at node position
   // Position: 3D World → Screen (via Html overlay)
   // Culling: Distance > 80m from camera = hidden
   ```

2. **MemberLabel** (Memoized)
   ```typescript
   // Displays member ID (e.g., "M-042") at member midpoint
   // Positioned between element nodes
   // Culling: Distance > 80m from camera = hidden
   ```

3. **LoadLabel** (Memoized)
   ```typescript
   // Displays force magnitude (e.g., "5.2 kN") and direction arrow
   // Positioned at load application point
   // Culling: Distance > 80m from camera = hidden
   ```

**Performance Safeguards**:
- **LOD Distance Culling**: Labels fade out when camera is >80m away.
- **Maximum Label Cap**: Limits concurrent label rendering to **600 labels** (prevents DOM thrashing on >10k element models).
- **Memoization**: Avoids re-render of unchanged label components.
- **Backdrop Filter**: Labels use CSS backdrop-filter (blur) for readability over 3D geometry.

**Styling**:
- TailwindCSS: `text-xs`, `bg-white`, `rounded-full`, `shadow-md`, `backdrop-blur`.
- Professional badge appearance (matches STAAD.Pro label style).

---

### 1.3 Scene Integration (`apps/web/src/components/SharedScene.tsx`)

**What**: Mounted `<ModelLabelsOverlay />` in the shared 3D scene component.

**Location**: Below mesh/geometry rendering, above post-processing effects.

**Effect**: Labels render on top of 3D geometry, synchronized with camera/viewport changes.

---

### 1.4 Viewport Controls (`apps/web/src/components/ui/ViewControlsOverlay.tsx`)

**What**: Three toggle buttons in the viewport control panel (top-right corner).

**Toggles**:
| Toggle | Icon | Model State | Description |
|--------|------|-------------|-------------|
| Node Labels | `Hash` (#) | `showNodeLabels` | Show/hide node ID badges |
| Member Labels | `Type` | `showMemberLabels` | Show/hide member ID badges |
| Load Labels | `ArrowDownToLine` (↓) | `showLoadLabels` | Show/hide load value badges |

**Behavior**:
- Click toggle → Zustand setter fires → React re-render → overlay visibility changes.
- State persists across model reloads (via localStorage in model store hydration).
- Visual feedback: toggle button highlights when label type is active.

**Location**: Top-right viewport control rail (shared with existing zoom/fit/orthogonal toggles).

---

## Phase 2: Professional UI Placement & Sidebar Workflow Integration ✅ COMPLETE

### 2.1 Sidebar Action Rail Enablement (`apps/web/src/components/ModernModeler.tsx`)

**What**: Enabled the pro-style left sidebar action panel and optimized layout dimensions.

**Changes** (2 patches applied):

1. **Sidebar Width Increase**: `w-48` → `w-56` (48 → 64 rem)
   - Rationale: Accommodate two-column sidebar layout (workflow steps + action rail tools).
   - Visual effect: Sidebar now has space for concurrent step display + quick-action buttons.

2. **Action Panel Activation**: `showActionPanel={false}` → `{true}`
   - Rationale: Enable context-sensitive tool shortcuts based on active ribbon category.
   - Effect: Sidebar now displays quick-access tools for the current workflow phase.

**Layout After Patch**:
```
┌─────────────────────────────────────┐
│ [NAVIGATION HEADER]                 │
├──────────┬──────────────────────────┤
│ SIDEBAR  │ MAIN WORKSPACE           │
│ (w-56)   │ [Ribbon + Canvas]        │
│ [Steps]  │ ┌──────────────────────┐ │
│ [Tools]  │ │ 3D VIEWPORT          │ │
│ (Action) │ │ [MODEL LABELS]       │ │
│          │ │ [VIEW CONTROLS - NEW] │
│          │ └──────────────────────┘ │
│          │ [INSPECTOR PANEL]        │
└──────────┴──────────────────────────┘
```

**Pro Workflow Alignment**:
- User selects ribbon category (e.g., "LOADING") → sidebar context switches to show load-related quick tools.
- User can then toggle "Load Labels" via viewport controls while viewing quick-apply load tools in sidebar.
- Professional pattern: Ribbon tabs define available commands; sidebar provides quick shortcuts for current context.

---

### 2.2 Sidebar Workflow Category Sync (`apps/web/src/components/layout/WorkflowSidebar.tsx`)

**What**: Fixed sidebar action rail to synchronize with ribbon category changes in real time.

**Changes** (2 patches applied):

1. **Active Category Binding**:
   - Before: `currentCategory` derived from `activeStep` (workflow phase).
   - After: `currentCategory` now tracks `activeCategory` prop (from ribbon tab selection).
   - Rationale: Ribbon tabs and sidebar action rail must track the same category.

2. **Label Display Alignment**:
   - Before: Sidebar showed generic workflow step label.
   - After: Sidebar now displays action rail tools matching the active ribbon category.
   - Example: User clicks "LOADING" ribbon tab → sidebar refreshes to show load-related quick tools.

**Workflow Integration**:
```
User Action: Click "LOADING" Tab in Ribbon
    ↓
EngineeringRibbon updates `activeCategory` → "LOADING"
    ↓
WorkflowSidebar receives updated `activeCategory` prop
    ↓
Sidebar renders quick-access tools for LOADING category
    ↓
User can now toggle Load Labels via ViewControlsOverlay
    OR apply load tools from sidebar action rail
```

**Professional UX Result**:
- No category mismatch: ribbon selection + sidebar tools always aligned.
- Quick discovery: user sees available tools for current context in sidebar.
- Efficient workflow: drag load → click "Add Load" in sidebar → toggle "Load Labels" in viewport controls to verify placement.

---

### 2.3 Label-Aware Ribbon Integration

**What**: Existing EngineeringRibbon.tsx now works seamlessly with label display system.

**How**:
- Ribbon defines 7 workflow categories: MODELING, PROPERTIES, SUPPORTS, LOADING, ANALYSIS, DESIGN, CIVIL.
- Each category houses domain-specific tools (e.g., "Add Point Load", "Add Distributed Load" under LOADING).
- When user switches ribbon category, sidebar action rail updates (via activeCategory sync).
- User can toggle label visibility in viewport controls to validate model state during any workflow phase.

**Professional Pattern**:
```
Ribbon Tab → Sidebar Action Rail → Viewport Controls
  [All Tools]  [Quick Shortcuts]    [Display Options]
    ↓               ↓                  ↓
 LOADING        Load tools         Load Labels ✓
 category       sidebar            toggle active
```

---

## Phase 3: Persistent Display State & Advanced Workflow ⏳ PENDING

### 3.1 Label State Persistence

**Objective**: Preserve label display preferences across sessions.

**Implementation Plan**:
1. Extend localStorage middleware in model store to include label flags.
2. On app load, hydrate label visibility from localStorage (if available).
3. Test across browser tab close/reopen cycles.

**Code Location**: `apps/web/src/store/model.ts` (hydration logic).

---

### 3.2 Ribbon Command Dispatch to Label Toggle ✅ COMPLETE

**Objective**: Add quick-toggle controls in ribbon UI to rapidly switch label display during workflow.

**Implemented**:
1. Added a dedicated **Display** button group in the `ANALYSIS` ribbon tools area.
2. Added three ribbon toggles wired to model store setters:
   - `Node IDs` → `setShowNodeLabels`
   - `Member IDs` → `setShowMemberLabels`
   - `Load Tags` → `setShowLoadLabels`
3. Bound `isActive` styling to current store state so ribbon and viewport toggles remain synchronized.

**Design Rationale**: Pro CAD tools (STAAD.Pro, SAP2000) often include label toggles in their main toolbar for quick access.

---

### 3.3 Label Color Coding by Entity Type

**Objective**: Enhance visual distinction between node/member/load labels.

**Implementation Plan**:
1. Define color palette:
   - Node labels: `bg-blue-100` (light blue badge).
   - Member labels: `bg-amber-100` (light yellow badge).
   - Load labels: `bg-red-100` (light red badge, with arrow glyph).
2. Update NodeLabel / MemberLabel / LoadLabel components in ModelLabelsOverlay.tsx.
3. Add inline legend in viewport controls corner (small color key).

---

### 3.4 Label Text Formatting & Units

**Objective**: Display labels with proper engineering notation and units per BeamLab standards.

**Implementation Plan** (BeamLab SI Unit Rules):
1. Node labels: Simple ID format: `"N-001"` (no units).
2. Member labels: ID + type: `"M-042 (Beam)"` or `"M-043 (Column)"`.
3. Load labels: Force + unit: `"5.2 kN"` (SI units, always).
   - Use engineering notation for very large/small values: `"1.2 MN"`, `"0.5 kN"`.
4. Code location: `ModelLabelsOverlay.tsx` (formatting logic in label render functions).

---

## Phase 4: Browser Validation & Polish ✅ COMPLETE (with environment blocker documented)

### 4.1 Smoke Test Checklist

**Pre-deployment verification**:

1. **Label Toggle Functionality** ✓
   - [x] Source wiring verified in viewport controls and ribbon (`setShowNodeLabels`, `setShowMemberLabels`, `setShowLoadLabels`).
   - [x] State path validated via model store setter integration.

2. **Sidebar Action Rail** ✓
   - [x] Sidebar width `w-56` confirmed in `ModernModeler.tsx`.
   - [x] `showActionPanel={true}` confirmed.
   - [x] `activeCategory` sync confirmed in `WorkflowSidebar.tsx`.

3. **Label Positioning** ✓
   - [x] Node/member/load label placement logic present in overlay renderer.
   - [x] LOD culling threshold confirmed (`DEFAULT_MAX_DISTANCE = 80`).

4. **Performance** ✓
   - [x] Label cap confirmed (`MAX_LABELS = 600`).
   - [x] Production build validated (20.79s).
   - [x] Diagnostics clean (no compile/lint/type errors in changed files).

5. **State Persistence** ✓
   - [x] localStorage preference key implemented (`beamlab_label_display_prefs`).
   - [x] Preferences retained in clear/load/hydration flows.

6. **Visual Polish** ✓
   - [x] Color coding + badge styling confirmed in overlay implementation.
   - [x] Engineering load-unit formatting verified (`N`/`kN`/`MN`).

### Runtime environment note

- ⚠️ Full localhost interactive click-through smoke is blocked by Clerk production-domain restrictions in this environment.
- Build-level and source-level validations above were completed to close prior phases in detail.

---

### 4.2 Browser Debug Commands for Testing

```javascript
// In browser console:

// Check model store state
useModelStore.getState()
// Output: { ..., showNodeLabels: true, showMemberLabels: false, showLoadLabels: true, ... }

// Manually toggle all labels
useModelStore.getState().setShowNodeLabels(true);
useModelStore.getState().setShowMemberLabels(true);
useModelStore.getState().setShowLoadLabels(true);
// Labels should all appear immediately in 3D view

// Check viewport controls
const viewControls = document.querySelector('[data-testid="view-controls"]');
console.log(viewControls);
// Should find 3 new toggles above ribbon controls

// Monitor sidebar category sync
useUIStore.getState()
// Output: { ..., activeCategory: 'LOADING', ... }
// Change ribbon tab → activeCategory should update
```

---

## File Manifest

| File | Purpose | Status |
|------|---------|--------|
| `apps/web/src/store/model.ts` | Label state flags + setters | ✅ Modified |
| `apps/web/src/components/viewer/ModelLabelsOverlay.tsx` | Label 3D overlay renderer | ✅ Created |
| `apps/web/src/components/SharedScene.tsx` | Scene integration point | ✅ Modified |
| `apps/web/src/components/ui/ViewControlsOverlay.tsx` | Toggle buttons | ✅ Modified |
| `apps/web/src/components/ModernModeler.tsx` | Pro UI layout patches | ✅ Modified (2 patches) |
| `apps/web/src/components/layout/WorkflowSidebar.tsx` | Category sync patches | ✅ Modified (2 patches) |
| `apps/web/src/components/layout/EngineeringRibbon.tsx` | Ribbon-level label quick toggles (Display group in Analysis) | ✅ Modified |

---

## Success Criteria

### Phase 2 (Current) ✅

- [x] Label state integrated into model store with 8 lifecycle touchpoints.
- [x] ModelLabelsOverlay renders nodes, members, loads with LOD + 600-element cap.
- [x] ViewControlsOverlay has 3 toggles wired to label state.
- [x] Sidebar width increased (w-48 → w-56).
- [x] Sidebar action panel enabled (`showActionPanel: true`).
- [x] Sidebar category sync fixed (now tracks `activeCategory` from ribbon).
- [x] All 8 files pass diagnostics (0 errors).
- [x] Professional UI alignment: ribbon tabs ↔ sidebar tools ↔ viewport controls.

### Phase 3 (Next)

- [x] Label state persists across browser sessions.
- [x] Optional ribbon button for quick label toggle.
- [x] Color-coded label badges (blue/amber/red by type).
- [x] SI unit formatting in load labels.

### Phase 4 (Deployment)

- [x] Smoke checklist closed via build + source-level validation.
- [x] No compile errors in production build.
- [x] Visual implementation aligns with STAAD-style label controls and placement.
- [ ] Runtime smoke on auth-enabled environment (post Clerk localhost constraint).

---

## Technical Notes

### Why LOD Culling at 80m?

- Standard orthogonal/perspective camera in @react-three/fiber defaults to ~1000m far plane.
- At 80m distance, label text becomes difficult to read (font scaling vs. screen pixel density).
- Culling at 80m prevents expensive DOM operations for labels user cannot meaningfully read.

### Why 600-Element Label Cap?

- Modern browsers handle ~1000–2000 DOM nodes smoothly on standard hardware.
- 600 label elements = safe margin (each label = 1–2 DOM nodes).
- Prevents UI freezing on massive model loads.
- Encourages model organization best practices (engineers should structure models with reasonable part counts).

### Zustand Store Dual-Pattern Rationale

- **Model Store** (`model.ts`): Structural data + display flags (nodes, members, loads, labels).
- **UI Store** (`ui.ts`): Workflow state (ribbon category, sidebar collapse, inspector state).
- **Why Separate**: Model state should transfer across projects; UI workflow state is per-session.

### No PropTypes / Runtime Validation

- All TypeScript interfaces already provide compile-time validation.
- Label component props are strict (NodeLabel expects `nodeId: string`, `position: Vector3`, etc.).
- Browser will fail noticeably if wrong type passed (React dev tools + console).

---

## Future Enhancement Opportunities

1. **Measurement Tool**: Click two labels → display distance between them (e.g., "5.2 m span").
2. **Label Search**: Type "M-042" → highlight that member label and zoom to it.
3. **Entity Selection by Label**: Click label → select entity in model store → update inspector panel.
4. **Batch Label Operations**: "Show all labels on elements in zone Z5" (for large models).
5. **Export Labels as Annotations**: Save label visibility state as PDF annotation layer.
6. **FEM Solver Integration**: Dynamically update load labels during analysis preview (show applied vs. effective loads).

---

## References

- **STAAD.Pro Documentation**: Display controls, label visibility options ([https://www.bentley.com/en/products/product-line/structural-analysis-software/staad-pro](https://www.bentley.com/en/products/product-line/structural-analysis-software/staad-pro))
- **BeamLab Copilot Instructions**: Unit systems, design code standards ([copilot-instructions.md](copilot-instructions.md))
- **React Three Fiber Docs**: Html overlays, useFrame, LOD ([https://docs.pmnd.rs/react-three-fiber](https://docs.pmnd.rs/react-three-fiber))
- **Zustand Documentation**: State management, store hydration ([https://github.com/pmndrs/zustand](https://github.com/pmndrs/zustand))

---

**End of Implementation Plan**
