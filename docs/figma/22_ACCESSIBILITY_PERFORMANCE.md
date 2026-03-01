# 22 — Accessibility & Performance
## BeamLab Ultimate Figma Specification

---

## 22.1 WCAG 2.1 AA Compliance

### Color Contrast Requirements

| Element | Foreground | Background | Contrast Ratio | WCAG Level |
|---------|-----------|------------|---------------|------------|
| Body text | slate-200 (#e2e8f0) | slate-900 (#0f172a) | 12.6:1 | AAA ✓ |
| Secondary text | slate-400 (#94a3b8) | slate-900 (#0f172a) | 5.6:1 | AA ✓ |
| Primary button text | white (#ffffff) | blue-500 (#3b82f6) | 4.6:1 | AA ✓ |
| Destructive button | white (#ffffff) | red-500 (#ef4444) | 4.5:1 | AA ✓ |
| Link text | blue-400 (#60a5fa) | slate-900 (#0f172a) | 7.1:1 | AAA ✓ |
| Placeholder text | slate-500 (#64748b) | slate-800 (#1e293b) | 4.6:1 | AA ✓ |
| Error text | red-400 (#f87171) | slate-900 (#0f172a) | 6.1:1 | AA ✓ |
| Warning text | yellow-400 (#facc15) | slate-900 (#0f172a) | 11.5:1 | AAA ✓ |
| Success text | green-400 (#4ade80) | slate-900 (#0f172a) | 7.4:1 | AAA ✓ |
| Input border (focus) | blue-500 (#3b82f6) | slate-800 (#1e293b) | 3.1:1 | AA (non-text) ✓ |
| Disabled text | slate-600 (#475569) | slate-800 (#1e293b) | 2.2:1 | Exempt ✓ |

### Non-Color Information Encoding

```
For all status indicators, NEVER rely solely on color:

Result Status:
  ✓ Pass   — Green (#22c55e) + checkmark icon + "Pass" text
  ⚠ Warn  — Yellow (#facc15) + triangle icon + "Warning" text  
  ✕ Fail   — Red (#ef4444) + X icon + "Fail" text

Utilization Ratio:
  UR ≤ 0.50  —  Green  + no pattern
  UR 0.50-0.80 — Yellow + diagonal hatch (optional)
  UR 0.80-1.00 — Orange + cross-hatch (optional)
  UR > 1.00   — Red    + dense cross-hatch + bold "FAIL"

Load Type Colors in Viewport:
  Each load type uses a unique color AND a unique arrow/symbol shape:
  Point load:    Red    + single arrow ↓
  UDL:           Blue   + parallel arrows ↓↓↓
  Moment:        Purple + curved arrow ↻
  Temperature:   Orange + wavy line ∿
```

---

## 22.2 Keyboard Navigation

### Global Keyboard Map

```
┌──────────────────────────────────────────────────────────────────────┐
│ Focus Management & Tab Order                                         │
│                                                                      │
│ Tab order flows logically through the workspace:                    │
│                                                                      │
│ 1. Skip-to-main link (visible on focus only)                       │
│    ┌──────────────────────────────────────────┐                     │
│    │ [Skip to main content]                   │  position: fixed    │
│    └──────────────────────────────────────────┘  top: -40px         │
│    On focus: translateY(40px), bg: blue-500, z-index: 9999          │
│                                                                      │
│ 2. Header bar (logo → file menu → main actions → user menu)       │
│ 3. Ribbon toolbar (tab list → tool buttons left to right)          │
│ 4. Left sidebar (tree items, collapsible sections)                  │
│ 5. Main viewport (canvas, receives focus for keyboard shortcuts)    │
│ 6. Properties panel (form fields top to bottom)                    │
│ 7. Status bar                                                        │
│                                                                      │
│ Focus indicators:                                                    │
│   All interactive elements: 2px ring, blue-400 (#60a5fa)           │
│   Offset: 2px from element edge                                    │
│   Never removed, always visible when focused                       │
│   Custom focus for 3D viewport: dashed border around canvas        │
│                                                                      │
│ Focus trap:                                                          │
│   Modals/dialogs trap focus within                                  │
│   Tab cycles through dialog controls only                           │
│   Escape closes dialog and returns focus to trigger                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### Essential Keyboard Shortcuts (Accessible)

| Action | Shortcut | Context |
|--------|----------|---------|
| Skip to main content | Tab (first press) | Global |
| Open command palette | Ctrl+K | Global |
| Open help | F1 | Global |
| Close dialog / cancel | Escape | Any dialog |
| Confirm / OK | Enter | Any dialog |
| Undo | Ctrl+Z | Workspace |
| Redo | Ctrl+Shift+Z | Workspace |
| Navigate tabs | Arrow Left/Right | Ribbon toolbar |
| Activate tab | Enter/Space | Ribbon toolbar |
| Navigate tree | Arrow Up/Down | Sidebar tree |
| Expand/collapse tree | Arrow Right/Left | Sidebar tree node |
| Select element | Enter | Tree item / tool |
| Multi-select | Ctrl+Click or Shift+Click | Viewport / tree |
| Delete selected | Delete | Workspace |
| Zoom in | + or Ctrl+= | Viewport |
| Zoom out | - or Ctrl+- | Viewport |
| Fit all | F | Viewport |
| Toggle properties panel | P | Workspace |
| Run analysis | Ctrl+Enter | Workspace |
| Pan viewport | Arrow keys | Viewport focused |

---

## 22.3 Screen Reader Support

### ARIA Landmarks & Roles

```html
<body>
  <!-- Skip link -->
  <a href="#main" class="skip-link">Skip to main content</a>
  
  <!-- Header -->
  <header role="banner" aria-label="Application header">
    <nav role="navigation" aria-label="Main navigation">
      <!-- File, Edit, View menus -->
    </nav>
  </header>
  
  <!-- Ribbon Toolbar -->
  <div role="tablist" aria-label="Workflow tabs">
    <button role="tab" aria-selected="true" aria-controls="geometry-panel">
      Geometry
    </button>
    <button role="tab" aria-selected="false" aria-controls="loading-panel">
      Loading
    </button>
  </div>
  <div role="tabpanel" id="geometry-panel" aria-labelledby="geometry-tab">
    <div role="toolbar" aria-label="Geometry tools">
      <button aria-label="Add node" aria-keyshortcuts="N">
        <span aria-hidden="true">📍</span> Node
      </button>
      <button aria-label="Add member" aria-keyshortcuts="M">
        <span aria-hidden="true">📏</span> Member
      </button>
    </div>
  </div>
  
  <!-- Sidebar -->
  <aside role="complementary" aria-label="Model explorer">
    <div role="tree" aria-label="Structure tree">
      <div role="treeitem" aria-expanded="true" aria-level="1">
        Nodes (24)
        <div role="group">
          <div role="treeitem" aria-level="2">Node 1: (0, 0, 0)</div>
          <div role="treeitem" aria-level="2">Node 2: (6, 0, 0)</div>
        </div>
      </div>
    </div>
  </aside>
  
  <!-- Main Content -->
  <main id="main" role="main" aria-label="3D Viewport">
    <canvas 
      role="application" 
      aria-label="3D structural model. 24 nodes, 39 members. 
                   Use arrow keys to navigate, Enter to select."
      aria-roledescription="3D model viewer"
      tabindex="0"
    />
  </main>
  
  <!-- Properties Panel -->
  <aside role="complementary" aria-label="Element properties">
    <form aria-label="Properties form">
      <fieldset>
        <legend>Node Properties</legend>
        <!-- form fields -->
      </fieldset>
    </form>
  </aside>
  
  <!-- Status Bar -->
  <footer role="contentinfo" aria-label="Status bar">
    <div role="status" aria-live="polite">Ready</div>
  </footer>
</body>
```

### Live Regions

```
Analysis status updates (aria-live="polite"):
  "Analysis started. Processing 12 load cases."
  "Analysis step 3 of 6: Solving equations."
  "Analysis complete. All 12 load cases solved successfully."

Error alerts (aria-live="assertive"):
  "Error: Singular stiffness matrix. Check supports."
  "Error: Member 23 has zero length."

Toast notifications (role="alert"):
  "Section ISMB 400 assigned to 5 members."
  "Project saved successfully."

Progress updates (role="progressbar"):
  <div role="progressbar" 
       aria-valuenow="45" 
       aria-valuemin="0" 
       aria-valuemax="100"
       aria-label="Analysis progress">
    45%
  </div>
```

---

## 22.4 Focus Management Patterns

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ ── Dialog Focus ──                                                  │
│                                                                      │
│ On open:                                                             │
│   1. Save current active element reference                          │
│   2. Move focus to first focusable element in dialog                │
│   3. Trap focus: Tab wraps from last → first element                │
│   4. Shift+Tab wraps from first → last element                     │
│                                                                      │
│ On close:                                                            │
│   1. Return focus to saved element                                  │
│   2. If element no longer exists, focus nearest logical element     │
│                                                                      │
│                                                                      │
│ ── Dropdown Focus ──                                                │
│                                                                      │
│ Open: focus moves to search input (if present) or first option      │
│ Arrow Down: next option                                              │
│ Arrow Up: previous option                                           │
│ Home: first option                                                   │
│ End: last option                                                     │
│ Type-ahead: jump to matching option                                 │
│ Enter: select + close                                               │
│ Escape: close without selecting                                     │
│                                                                      │
│                                                                      │
│ ── Viewport Focus ──                                                │
│                                                                      │
│ When viewport is focused:                                           │
│   Tab: moves focus OUT of viewport to next landmark                │
│   Arrow keys: pan viewport                                          │
│   +/-: zoom                                                         │
│   N: add node mode (announced)                                      │
│   M: add member mode (announced)                                    │
│   Delete: delete selected (confirmed via aria-live)                 │
│   Enter: select element nearest to center/cursor                   │
│   Element selection announced: "Selected Member 23, ISMB 400"      │
│                                                                      │
│                                                                      │
│ ── After Actions ──                                                 │
│                                                                      │
│ After deletion: focus moves to next element in list/tree            │
│ After creation: focus moves to properties panel for new element     │
│ After analysis: focus moves to results summary                     │
│ After save: focus stays in place, status announced                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 22.5 Reduced Motion Preferences

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ When prefers-reduced-motion: reduce is active:                      │
│                                                                      │
│ ── Replace with instant transitions ──                              │
│ • All hover effects: instant color change, no translate             │
│ • Dialog open/close: instant show/hide, no scale/slide              │
│ • Sidebar collapse: instant width change                            │
│ • Tab transitions: instant swap, no slide                           │
│ • Toast notifications: appear/disappear without animation           │
│ • Progress bars: still fill (functional), no shimmer                │
│                                                                      │
│ ── Keep functional animations ──                                    │
│ • Analysis progress spinner: keep (reduced to simple rotate)        │
│ • Loading indicators: keep (simplified to opacity pulse)            │
│ • Mode shape animation: DISABLE by default, user can re-enable     │
│ • Deformed shape morph: instant jump to deformed, no interpolation  │
│ • Earthquake simulation: DISABLE playback, show static peak frame  │
│                                                                      │
│ ── 3D Viewport ──                                                   │
│ • Orbit/pan/zoom: still smooth (user-initiated, functional)        │
│ • Fit-all camera move: still animated (shorter: 200ms)             │
│ • Selection flashes: replaced with persistent highlight             │
│ • Node creation particle burst: removed                             │
│                                                                      │
│ ── User override in Settings ──                                     │
│ Settings > Appearance > Motion:                                      │
│   ○ System default (follow OS)                                      │
│   ○ Full animations                                                 │
│   ○ Reduced animations                                              │
│   ○ No animations                                                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 22.6 Color Blind Accessibility

### Color Blind Safe Palettes

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ ── Result Visualization (Deuteranopia / Protanopia safe) ──        │
│                                                                      │
│ Instead of Red-Yellow-Green, use:                                   │
│                                                                      │
│  Default palette:       Color-blind safe palette:                   │
│  🟢 Pass (#22c55e)    → 🔵 Pass (#3b82f6) + ✓ icon              │
│  🟡 Warning (#facc15)  → 🟠 Warning (#f97316) + ⚠ icon           │
│  🔴 Fail (#ef4444)    → 🔴 Fail (#dc2626) + ✕ icon + pattern    │
│                                                                      │
│ Stress contour alternatives:                                         │
│                                                                      │
│  Default (Rainbow):          Color-blind safe (Viridis):            │
│  Blue → Cyan → Green →      Purple → Blue → Teal →                 │
│  Yellow → Red                Yellow → White                          │
│                                                                      │
│  Also available:                                                     │
│  - Magma:  Black → Purple → Red → Yellow                           │
│  - Cividis: Blue → Yellow (linear, cvd-safe)                       │
│  - Grayscale: Black → White (universal)                             │
│                                                                      │
│ User can select contour palette in:                                  │
│ Settings > Appearance > Color Map: [Viridis (Color-blind safe) ▾] │
│                                                                      │
│                                                                      │
│ ── UI Elements ──                                                   │
│                                                                      │
│ All status indicators include:                                       │
│ 1. Color (primary indicator for sighted users)                      │
│ 2. Icon (shape-based for color-blind users)                         │
│ 3. Text label (universal fallback)                                  │
│                                                                      │
│ Load combination table:                                              │
│ Rows with issues get both red background AND a ⚠ prefix icon     │
│                                                                      │
│ Utilization ratio viewport overlay:                                  │
│ Members use thickness variation in addition to color:               │
│   UR ≤ 0.50:  thin line (2px) + blue                              │
│   UR 0.50-1.0: medium line (3px) + orange                         │
│   UR > 1.0:    thick line (5px) + red + dashed pattern             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 22.7 Text Sizing & Zoom

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ ── Text Scaling ──                                                  │
│                                                                      │
│ All text uses rem/em units, never px:                               │
│                                                                      │
│ Base: 16px (1rem)                                                   │
│ Minimum interactive target: 24×24px (WCAG) → 44×44px (recommended)│
│                                                                      │
│ At 200% browser zoom:                                               │
│ • All text remains readable                                         │
│ • No horizontal scrolling on content                                │
│ • Layout reflows to single column if needed                        │
│ • Toolbar wraps or collapses to overflow menu                      │
│ • Properties panel fills available width                           │
│ • Tables become horizontally scrollable with sticky headers        │
│                                                                      │
│ At 400% browser zoom:                                               │
│ • Content still accessible                                          │
│ • Mobile layout triggers                                            │
│ • 3D viewport remains functional                                    │
│ • Essential controls visible without scrolling                     │
│                                                                      │
│                                                                      │
│ ── Application Font Size Setting ──                                 │
│                                                                      │
│ Settings > Appearance > Font Size:                                   │
│   [Small (14px)] [Default (16px)] [Large (18px)] [X-Large (20px)]  │
│                                                                      │
│ Affects all UI text. 3D viewport labels scale independently.       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 22.8 Performance Budgets

### Initial Load

| Metric | Budget | Target |
|--------|--------|--------|
| First Contentful Paint (FCP) | < 1.5s | 1.2s |
| Largest Contentful Paint (LCP) | < 2.5s | 2.0s |
| Time to Interactive (TTI) | < 3.5s | 3.0s |
| Cumulative Layout Shift (CLS) | < 0.1 | 0.05 |
| First Input Delay (FID) | < 100ms | 50ms |
| Total bundle (gzipped) | < 500KB | ~420KB |
| WASM solver module | < 2MB | ~1.5MB |
| Critical CSS (inlined) | < 15KB | ~10KB |

### Runtime Performance

| Metric | Budget | Notes |
|--------|--------|-------|
| 3D viewport FPS | ≥ 30fps | Min acceptable; target 60fps |
| UI interaction response | < 100ms | Button clicks, panel toggles |
| Analysis start latency | < 200ms | Time from click to solver start |
| Property panel update | < 50ms | After element selection |
| Undo/Redo latency | < 100ms | State restoration |
| Auto-save (background) | < 500ms | Non-blocking |
| Search results | < 200ms | Section database, command palette |
| Tree expand/collapse | < 100ms | Model explorer |

### Model Size Targets

| Model Size | Members | Expected Perf |
|-----------|---------|---------------|
| Small | < 100 | 60 fps, < 0.5s analysis |
| Medium | 100-1,000 | 60 fps, < 3s analysis |
| Large | 1,000-10,000 | 30 fps, < 30s analysis |
| Very Large | 10,000-50,000 | 30 fps, < 120s analysis |
| Massive | > 50,000 | 15 fps with LOD, chunked analysis |

---

## 22.9 Lazy Loading Strategy

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ ── Route-Based Code Splitting ──                                    │
│                                                                      │
│ Chunk 1 — Shell (always loaded):                                    │
│   React, Router, Zustand, Auth (Clerk), Layout shell               │
│   Target: ~120KB gzipped                                            │
│                                                                      │
│ Chunk 2 — Landing Page:                                             │
│   Marketing components, Framer Motion, hero animations             │
│   Target: ~80KB gzipped                                             │
│   Load: on route /                                                  │
│                                                                      │
│ Chunk 3 — Dashboard:                                                │
│   Project cards, template browser, import dialogs                  │
│   Target: ~60KB gzipped                                             │
│   Load: on route /dashboard                                        │
│                                                                      │
│ Chunk 4 — Workspace (core):                                        │
│   Three.js, R3F, viewport, toolbar, properties panel               │
│   Target: ~200KB gzipped                                            │
│   Load: on route /project/:id                                      │
│   Pre-fetch: when hovering project card (200ms delay)              │
│                                                                      │
│ Chunk 5 — Analysis Engine (WASM):                                   │
│   Rust solver, sparse matrix ops                                    │
│   Target: ~1.5MB (WASM + glue JS)                                  │
│   Load: on first analysis request, cached in IndexedDB             │
│   Pre-fetch: after workspace loads (idle callback)                  │
│                                                                      │
│ Chunk 6 — Design Modules:                                           │
│   Steel design, RC design, connection design                       │
│   Target: ~100KB gzipped                                            │
│   Load: on first design tab access                                  │
│                                                                      │
│ Chunk 7 — Reporting:                                                │
│   PDF generation (pdfmake/jspdf), chart rendering                  │
│   Target: ~150KB gzipped                                            │
│   Load: on report generation request                                │
│                                                                      │
│ Chunk 8 — AI Features:                                              │
│   AI chat, generative design, optimizer                            │
│   Target: ~50KB gzipped                                             │
│   Load: on AI panel open                                            │
│                                                                      │
│ Chunk 9 — BIM Integration:                                          │
│   IFC parser, Revit sync, file converters                          │
│   Target: ~80KB gzipped                                             │
│   Load: on import/export dialog open                               │
│                                                                      │
│ Chunk 10 — Settings:                                                │
│   Settings pages, subscription management                          │
│   Target: ~30KB gzipped                                             │
│   Load: on route /settings                                          │
│                                                                      │
│                                                                      │
│ ── Component-Level Lazy Loading ──                                  │
│                                                                      │
│ Section Database Browser:                                           │
│   10,000+ entries → virtualized list (react-window)                │
│   Only render visible rows + 10 overscan                           │
│   Row height: 36px fixed                                           │
│                                                                      │
│ Model Explorer Tree:                                                │
│   Virtualized for models > 500 items                               │
│   Collapse-on-mount for deep trees                                 │
│                                                                      │
│ Data Tables (results):                                              │
│   Virtualized rows + columns                                       │
│   Pagination: 100 rows per page                                    │
│   Infinite scroll option                                            │
│                                                                      │
│ 3D Viewport LOD:                                                    │
│   < 1000 members: full geometry                                    │
│   1000-5000: simplified joints                                      │
│   > 5000: line-only mode, no 3D section profiles                   │
│   > 20000: instanced rendering, culled by frustum                  │
│                                                                      │
│ Image/Thumbnail Loading:                                            │
│   Project thumbnails: lazy via IntersectionObserver                 │
│   Template previews: lazy, placeholder blur-up                     │
│   User avatars: lazy with initials fallback                        │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 22.10 Caching Strategy

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ ── Service Worker (PWA) ──                                          │
│                                                                      │
│ Cache-first strategy for static assets:                             │
│   JS/CSS chunks, fonts, icons → cache indefinitely (content-hash)  │
│   WASM module → cache in IndexedDB (versioned)                     │
│                                                                      │
│ Network-first for dynamic data:                                     │
│   API responses, project data, user preferences                    │
│   Fallback to cache if offline                                      │
│                                                                      │
│ Stale-while-revalidate for:                                         │
│   Section database (updated monthly)                               │
│   Material database                                                 │
│   Template library                                                  │
│                                                                      │
│                                                                      │
│ ── Local Storage / IndexedDB ──                                    │
│                                                                      │
│ IndexedDB:                                                           │
│   - Active project auto-save (every 30s)                           │
│   - WASM solver binary cache                                       │
│   - Section database (10,000+ entries)                             │
│   - Recent files list                                               │
│   - Undo history (configurable depth: default 100 steps)           │
│                                                                      │
│ localStorage:                                                        │
│   - User preferences (units, theme, shortcuts)                     │
│   - UI layout state (panel widths, collapsed state)                │
│   - Last active project ID                                          │
│   - Onboarding progress                                            │
│                                                                      │
│ sessionStorage:                                                      │
│   - Temporary analysis results (cleared on tab close)              │
│   - Clipboard state for copy/paste                                 │
│                                                                      │
│                                                                      │
│ ── API Caching ──                                                   │
│                                                                      │
│ Response caching with SWR pattern:                                   │
│   GET /sections → cache 24h, revalidate on focus                   │
│   GET /materials → cache 24h                                       │
│   GET /templates → cache 1h                                        │
│   GET /project/:id → cache 5min, revalidate on focus               │
│   GET /user/profile → cache 30min                                  │
│   POST /analyze → never cache (always fresh)                       │
│   POST /design → never cache                                       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 22.11 Error Handling UX

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ ── Network Error ──                                                 │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │                                                                  ││
│ │  ☁️✕  Connection Lost                                          ││
│ │                                                                  ││
│ │  Your internet connection appears to be offline.                ││
│ │  Changes are being saved locally and will sync                  ││
│ │  when you're back online.                                       ││
│ │                                                                  ││
│ │  ┌──────────────────────────────┐                               ││
│ │  │ Offline Mode Active         │  yellow banner at top          ││
│ │  │ Last synced: 2 min ago      │  of workspace                 ││
│ │  └──────────────────────────────┘                               ││
│ │                                                                  ││
│ │  [Retry Connection]  [Continue Offline]                         ││
│ │                                                                  ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│                                                                      │
│ ── Analysis Error ──                                                │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │  ✕ Analysis Failed                                              ││
│ │                                                                  ││
│ │  Error: Singular stiffness matrix detected.                    ││
│ │                                                                  ││
│ │  Likely causes:                                                  ││
│ │  1. ⚠ Insufficient supports — Your model has 3 DOF            ││
│ │     unsupported. [Highlight unsupported nodes →]                ││
│ │  2. ⚠ Disconnected elements — Member 15 is not               ││
│ │     connected to any other member. [Select →]                  ││
│ │  3. ⚠ Collinear members at Node 7 creating a mechanism.      ││
│ │     [Show →]                                                     ││
│ │                                                                  ││
│ │  [Auto-Fix Supports]  [View Technical Log]  [Close]            ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│                                                                      │
│ ── Crash Recovery ──                                                │
│                                                                      │
│ On app restart after crash:                                          │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │  🔄 BeamLab didn't shut down properly                          ││
│ │                                                                  ││
│ │  We found an auto-saved version of your project from           ││
│ │  2 minutes ago. Would you like to restore it?                  ││
│ │                                                                  ││
│ │  Project: ABC Office Tower                                      ││
│ │  Last auto-save: Jan 15, 2025 at 14:23:45                     ││
│ │  Changes since last manual save: 12 operations                  ││
│ │                                                                  ││
│ │  [Restore Auto-Save]  [Open Last Manual Save]  [Start Fresh]   ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│                                                                      │
│ ── 404 / Not Found ──                                               │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │                                                                  ││
│ │              🏗️ 404 — Page Not Found                           ││
│ │                                                                  ││
│ │   This page doesn't exist. It might have been moved            ││
│ │   or the link may be incorrect.                                 ││
│ │                                                                  ││
│ │   [← Go to Dashboard]  [Contact Support]                       ││
│ │                                                                  ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 22.12 Internationalization (i18n) Readiness

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ ── Language Support (Planned) ──                                    │
│                                                                      │
│ Phase 1 (Launch):                                                    │
│   • English (default)                                               │
│   • Hindi (हिंदी) — Indian market priority                          │
│                                                                      │
│ Phase 2:                                                             │
│   • Tamil, Telugu, Kannada, Marathi (Indian languages)             │
│   • Spanish, Portuguese (Latin America markets)                     │
│                                                                      │
│ Phase 3:                                                             │
│   • German, French (European markets)                               │
│   • Japanese (Asian market)                                         │
│   • Arabic (RTL support required)                                   │
│                                                                      │
│ ── Design Considerations ──                                         │
│                                                                      │
│ • All UI strings externalized in JSON locale files                 │
│ • Labels sized with 40% expansion buffer for German/Hindi           │
│ • Truncation: ellipsis with tooltip for overflow                   │
│ • Number formatting: locale-aware (1,00,000 for Indian English)    │
│ • Date formatting: locale-aware (DD/MM/YYYY for India)             │
│ • RTL layout: mirrored flex direction, text alignment              │
│ • Engineering symbols: universal (kN, MPa, mm — not translated)    │
│ • Indian Standard code references: kept in English (IS 456)        │
│                                                                      │
│ Settings > General > Language:                                       │
│ [English ▾]                                                         │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 22.13 Security UX

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ ── Session Timeout Warning ──                                       │
│                                                                      │
│ After 25 minutes of inactivity:                                     │
│ ┌──────────────────────────────────────────────────────────┐       │
│ │ ⏱️ Session Expiring Soon                                │       │
│ │                                                          │       │
│ │ Your session will expire in 5:00 minutes due to          │       │
│ │ inactivity. Unsaved changes will be preserved.          │       │
│ │                                                          │       │
│ │ [Stay Signed In]  [Sign Out]                            │       │
│ └──────────────────────────────────────────────────────────┘       │
│                                                                      │
│ Countdown timer updates every second in the dialog.                │
│                                                                      │
│                                                                      │
│ ── Content Security ──                                              │
│                                                                      │
│ Shared project links show permission level clearly:                  │
│ • 🔓 Public link — Anyone with link can view                      │
│ • 🔒 Private — Only invited members                               │
│ • Password indicator: 🔑 visible when password-protected          │
│                                                                      │
│                                                                      │
│ ── Data Export Confirmation ──                                      │
│                                                                      │
│ Before exporting sensitive project data:                            │
│ ┌──────────────────────────────────────────────────────────┐       │
│ │ 📤 Export Confirmation                                   │       │
│ │                                                          │       │
│ │ You're about to export:                                  │       │
│ │ • Full structural model data                            │       │
│ │ • Analysis results                                      │       │
│ │ • Design calculations                                    │       │
│ │                                                          │       │
│ │ This file may contain proprietary design data.          │       │
│ │ Ensure recipient is authorized.                          │       │
│ │                                                          │       │
│ │ [Export Anyway]  [Cancel]                                │       │
│ └──────────────────────────────────────────────────────────┘       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 22.14 Performance Monitoring Dashboard (Dev/Admin)

```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Performance Monitor (Ctrl+Shift+P to toggle)                          [✕]   │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│ │ FPS: 58    │ │ Draw: 2.1ms│ │ Heap: 124MB│ │ Nodes: 342 │ │ GPU: 45%   │ │
│ │ ████████░░ │ │ ████░░░░░░ │ │ ██████░░░░ │ │ ██████████ │ │ ████░░░░░░ │ │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘ └────────────┘ │
│                                                                               │
│ FPS History (last 60s):                                                      │
│  60│────────────╲╱───────────────────────────────────                        │
│  30│                                                                          │
│   0│─────────────────────────────────────────────────                        │
│    0s                                              60s                       │
│                                                                               │
│ Memory Allocation:                                                            │
│  Three.js Geometries: 45MB  |  Textures: 12MB  |  State: 8MB               │
│  WASM heap: 32MB  |  Worker pools: 4MB  |  Other: 23MB                     │
│                                                                               │
│ Render Pipeline:                                                              │
│  Scene traverse: 0.3ms → Frustum cull: 0.1ms → Draw calls: 128            │
│  Shadow pass: 0.4ms → Main pass: 1.2ms → Post-process: 0.1ms              │
│                                                                               │
│ [Export Diagnostics]  [Clear History]  [Send to Support]                    │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘

This overlay is developer-only, hidden in production.
Shortcut: Ctrl+Shift+P toggles visibility.
Position: bottom-left corner, semi-transparent bg.
```
