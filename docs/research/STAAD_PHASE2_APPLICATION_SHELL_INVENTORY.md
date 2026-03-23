# STAAD Phase 2 — Application Shell Inventory

## Scope

This phase inventories STAAD.Pro shell-level UX surfaces that govern navigation, mode switching, window composition, and global interactions.

## Canonical sources used (Tier 1)

- Application window layout: `https://docs.bentley.com/LiveContent/web/STAAD.Pro%20Help-v21/en/GUID-11AB84A4-4A5C-436D-9537-45C4614B68D8.html`
- File tab (Backstage): `https://docs.bentley.com/LiveContent/web/STAAD.Pro%20Help-v21/en/STD_FILE_RIBBON_TAB.html`
- Quick access toolbar: `https://docs.bentley.com/LiveContent/web/STAAD.Pro%20Help-v21/en/GUID-BB7677AA-3CD8-4A2D-BF29-119FB57BD75A.html`
- Workflows: `https://docs.bentley.com/LiveContent/web/STAAD.Pro%20Help-v21/en/GUID-0E9A64F6-3D80-434E-8A0F-0938278474CF.html`
- Page control: `https://docs.bentley.com/LiveContent/web/STAAD.Pro%20Help-v21/en/GUID-92D4D790-7599-442C-B6E1-19B671EF2DB8.html`
- Data area: `https://docs.bentley.com/LiveContent/web/STAAD.Pro%20Help-v21/en/GUID-7C43311F-0B35-4EF4-B4F4-D36B9B907345.html`
- View window: `https://docs.bentley.com/LiveContent/web/STAAD.Pro%20Help-v21/en/GUID-349C46F4-C0B5-4B6E-8959-EE759E93B054.html`
- Status bar: `https://docs.bentley.com/LiveContent/web/STAAD.Pro%20Help-v21/en/GUID-0BC037C5-692D-403F-9F2C-88C7A476E36D.html`
- Keyboard shortcuts: `https://docs.bentley.com/LiveContent/web/STAAD.Pro%20Help-v21/en/GUID-8E9DAF27-0814-4E8E-94D2-F1204A222EDD.html`
- Tool search: `https://docs.bentley.com/LiveContent/web/STAAD.Pro%20Help-v21/en/GUID-65AAA75D-5D66-4275-9BCD-B064E681B031.html`
- Right-click menu: `https://docs.bentley.com/LiveContent/web/STAAD.Pro%20Help-v21/en/GUID-CCBC920C-CB07-464B-8D59-DB3C4B6AE787.html`
- Right-click view tools: `https://docs.bentley.com/LiveContent/web/STAAD.Pro%20Help-v21/en/GUID-BCED57E2-8521-453D-9C14-4139326919A6.html`
- Quick commands popup: `https://docs.bentley.com/LiveContent/web/STAAD.Pro%20Help-v21/en/GUID-CCD59678-10A6-4CEF-9161-2AFE6C75E743.html`

## Shell component inventory

### 1) Frame composition

- File tab opens Backstage for file operations.
- Ribbon remains workflow-aware and dynamically updates.
- Page Control presents per-workflow pages in recommended left-to-right progression.
- Data Area updates dialogs and tables based on current workflow page.
- View Window is the primary model and results canvas.
- Status Bar displays workflow context plus active load case and current input units.

### 2) Workflow and page semantics

- Workflows replaced legacy mode/page controls from earlier STAAD generations.
- Workflows include: Analytical Modeling, Physical Modeling, Piping, Postprocessing, Foundation Design, Steel AutoDrafter, Chinese Steel Design, Connection Design, Advanced Concrete Design, Advanced Slab Design, Earthquake, and Reports.
- Some workflows open separate applications or windows (explicitly noted in Help):
  - Physical Modeling
  - Advanced Concrete Design
- Page Control includes domain-specific page sets, such as:
  - Analytical Modeling: Geometry, Properties, Materials, Specifications, Supports, Loading, Analysis, Design
  - Postprocessing: Displacements, Reactions, Beam Results, Plate Results, Solid Results, Dynamics, Reports
- Restore View tool restores dialogs for current page if panels were closed.

### 3) Global navigation and quick access

- QAT is above ribbon and customizable through More Commands.
- QAT provides Back and Forward navigation through page history.
- QAT includes Save, Open, Close, Undo, Redo.
- Command File and Analysis Output are available but hidden by default.

### 4) Interaction surfaces

- Right-click popup is context-sensitive with selection-state variants.
- Shift + right-click opens View Tools at pointer location.
- Spacebar opens Quick Commands popup with customizable command sets.
- Tool Search supports partial name matching.
- Tool Search hover reveals workflow-tab-group location.
- Tool Search Show Details reveals richer tooltip descriptions.

### 5) Keyboard and view control layer

- Alt key exposes ribbon access keys.
- Core shortcuts include project operations (Ctrl+N/O/S/P and Alt+F4).
- Analysis launch is mapped to Ctrl+F5.
- View controls include arrows for rotate, Ctrl+arrows for spin, F4 orientation, F5 refresh, F12 full-screen animation.
- Label toggles and display controls include Shift/Ctrl+Shift combinations for node-beam-plate-solid and diagnostic overlays.

## BeamLab mapping targets for Phase 5 crosswalk

- `apps/web/src/components/layout/EngineeringRibbon.tsx`
- `apps/web/src/components/ViewportManager.tsx`
- `apps/web/src/components/modeler/StatusBar.tsx`
- `apps/web/src/components/layout/RightPropertiesPanel.tsx`
- `apps/web/src/store/uiStore.ts`
- `apps/web/src/components/modeler/StaadProDialogStubs.tsx`

## Coverage notes

- This inventory is shell-level only and intentionally excludes deep tab tool taxonomies already being captured by domain phases.
- Tool-level shell evidence rows are appended in the main ledger as `STAAD-SHELL-*` IDs.
