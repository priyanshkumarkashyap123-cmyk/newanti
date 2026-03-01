# 01 — Design System & Tokens
## BeamLab Ultimate Figma Specification

---

## 1.1 Color System

### Primary Palette — Blue (Engineering Trust)
| Token | Hex | RGB | Usage |
|-------|-----|-----|-------|
| `primary-50` | `#eff6ff` | 239, 246, 255 | Hover backgrounds, selected row bg |
| `primary-100` | `#dbeafe` | 219, 234, 254 | Light badges, info backgrounds |
| `primary-200` | `#bfdbfe` | 191, 219, 254 | Focus rings (light mode) |
| `primary-300` | `#93c5fd` | 147, 197, 253 | Active tab indicators |
| `primary-400` | `#60a5fa` | 96, 165, 250 | Links, interactive text |
| `primary-500` | `#3b82f6` | 59, 130, 246 | **Primary brand color** — buttons, accents |
| `primary-600` | `#2563eb` | 37, 99, 235 | Button hover, active states |
| `primary-700` | `#1d4ed8` | 29, 78, 216 | Button pressed |
| `primary-800` | `#1e40af` | 30, 64, 175 | Dark accent |
| `primary-900` | `#1e3a8a` | 30, 58, 138 | Darkest accent |

### Secondary Palette — Purple (Innovation/AI)
| Token | Hex | Usage |
|-------|-----|-------|
| `secondary` | `#8b5cf6` | AI features, secondary CTA |
| `secondary-light` | `#a78bfa` | AI panel backgrounds |
| `secondary-dark` | `#7c3aed` | AI button hover |

### Accent Palette — Cyan/Teal (Engineering Precision)
| Token | Hex | Usage |
|-------|-----|-------|
| `accent` | `#06b6d4` | Accent highlights, data viz |
| `accent-light` | `#22d3ee` | Accent hover |
| `accent-dark` | `#0891b2` | Accent pressed |
| `teal` | `#14b8a6` | Success variant, analysis complete |
| `emerald` | `#10b981` | Positive values, success |

### Construction Accent — Gold (Industry Heritage)
| Token | Hex | Usage |
|-------|-----|-------|
| `gold` | `#f59e0b` | Premium features, construction accents |
| `gold-light` | `#fbbf24` | Highlight, star ratings |
| `gold-dark` | `#d97706` | Premium badge |

### Status Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `success` | `#22c55e` | Pass, OK, completed |
| `success-light` | `#4ade80` | Success backgrounds |
| `warning` | `#f59e0b` | Warnings, approaching limits |
| `warning-light` | `#fbbf24` | Warning backgrounds |
| `error` | `#ef4444` | Fail, errors, overstressed |
| `error-light` | `#f87171` | Error backgrounds |
| `info` | `#3b82f6` | Information, tips |

### Dark Theme — Navy System (Default)
| Token | Hex | Usage |
|-------|-----|-------|
| `background-dark` | `#0f172a` | **Main app background** (Slate-900) |
| `surface-dark` | `#1e293b` | Cards, panels, sidebar (Slate-800) |
| `surface-elevated` | `#334155` | Dropdowns, popovers, elevated panels (Slate-700) |
| `border-dark` | `#475569` | Visible borders (Slate-600) |
| `border-subtle` | `#334155` | Subtle separators (Slate-700) |
| `text-primary` | `#f1f5f9` | Primary text — headings, values (Slate-100) |
| `text-secondary` | `#cbd5e1` | Body text (Slate-300) |
| `text-muted` | `#94a3b8` | Labels, placeholders (Slate-400) |
| `text-disabled` | `#64748b` | Disabled elements (Slate-500) |

### Light Theme
| Token | Hex | Usage |
|-------|-----|-------|
| `background-light` | `#f8fafc` | Main background (Slate-50) |
| `surface-light` | `#ffffff` | Cards, panels |
| `border-light` | `#e2e8f0` | Borders (Slate-200) |
| `text-primary-light` | `#1e293b` | Primary text (Slate-800) |
| `text-secondary-light` | `#475569` | Body text (Slate-600) |
| `text-muted-light` | `#94a3b8` | Muted (Slate-400) |

### Engineering Result Colors (Stress/Force Visualization)
| Token | Hex | Usage |
|-------|-----|-------|
| `stress-tension` | `#ef4444` | Tension (+), positive moment |
| `stress-compression` | `#3b82f6` | Compression (–), negative moment |
| `stress-low` | `#22c55e` | Low stress / utilization <0.5 |
| `stress-medium` | `#f59e0b` | Medium stress / utilization 0.5–0.8 |
| `stress-high` | `#ef4444` | High stress / utilization 0.8–1.0 |
| `stress-critical` | `#dc2626` | Over-stressed / utilization >1.0 |
| `deformation` | `#8b5cf6` | Deformed shape overlay |
| `undeformed` | `#475569` | Original/undeformed geometry |
| `support-color` | `#f59e0b` | Support symbols |
| `load-color` | `#ef4444` | Load arrows |
| `node-color` | `#22d3ee` | Nodes/joints |
| `member-color` | `#94a3b8` | Members/beams/columns |
| `selected-color` | `#3b82f6` | Selected entities |

### Gradient Definitions
```
gradient-hero: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%)
gradient-sidebar: linear-gradient(180deg, #1e293b 0%, #0f172a 100%) [dark]
gradient-sidebar: linear-gradient(180deg, #f1f5f9 0%, #e2e8f0 100%) [light]
gradient-button-primary: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)
gradient-button-premium: linear-gradient(135deg, #f59e0b 0%, #d97706 100%)
gradient-text: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 50%, #06b6d4 100%)
gradient-card-glow: radial-gradient(600px at 50% 0%, rgba(59,130,246,0.1), transparent 70%)
gradient-success-bar: linear-gradient(90deg, #22c55e 0%, #10b981 100%)
gradient-stress-spectrum: linear-gradient(0deg, #3b82f6 0%, #22c55e 25%, #f59e0b 50%, #ef4444 75%, #dc2626 100%)
```

---

## 1.2 Typography

### Font Families
| Token | Stack | Usage |
|-------|-------|-------|
| `font-display` | Space Grotesk, Inter, system-ui, sans-serif | Headings, hero text, brand |
| `font-body` | Inter, Noto Sans, system-ui, sans-serif | Body text, UI labels |
| `font-mono` | JetBrains Mono, Fira Code, monospace | Engineering values, code, coordinates |

### Type Scale
| Name | Size | Weight | Line Height | Letter Spacing | Usage |
|------|------|--------|-------------|----------------|-------|
| `display-xl` | 48px / 3rem | 700 Bold | 1.1 | -0.02em | Landing hero title |
| `display-lg` | 36px / 2.25rem | 700 Bold | 1.15 | -0.02em | Section titles |
| `display-md` | 30px / 1.875rem | 600 Semi | 1.2 | -0.01em | Page titles |
| `h1` | 24px / 1.5rem | 600 Semi | 1.3 | -0.01em | Page headings |
| `h2` | 20px / 1.25rem | 600 Semi | 1.35 | -0.01em | Section headings |
| `h3` | 18px / 1.125rem | 600 Semi | 1.4 | -0.005em | Sub-section headings |
| `h4` | 16px / 1rem | 600 Semi | 1.4 | 0 | Panel titles |
| `h5` | 14px / 0.875rem | 600 Semi | 1.4 | 0 | Group titles |
| `h6` | 12px / 0.75rem | 600 Semi | 1.5 | 0.05em | Overlines (UPPERCASE) |
| `body` | 14px / 0.875rem | 400 Regular | 1.5 | 0 | Default body text |
| `body-sm` | 12px / 0.75rem | 400 Regular | 1.5 | 0 | Secondary text |
| `caption` | 11px / 0.6875rem | 400 Regular | 1.4 | 0.01em | Captions, footnotes |
| `code` | 12px / 0.75rem | 400 Regular | 1.5 | 0 | Code, values (mono) |
| `label` | 12px / 0.75rem | 500 Medium | 1.3 | 0.02em | Form labels |
| `value` | 14px / 0.875rem | 500 Medium | 1.3 | 0 | Engineering values (mono) |
| `unit` | 10px / 0.625rem | 400 Regular | 1.2 | 0.02em | Unit suffixes (kN, mm) |
| `button` | 14px / 0.875rem | 500 Medium | 1 | 0.01em | Button labels |
| `button-sm` | 12px / 0.75rem | 500 Medium | 1 | 0.01em | Small button labels |
| `tab` | 13px / 0.8125rem | 500 Medium | 1 | 0.01em | Tab labels |
| `menu` | 13px / 0.8125rem | 400 Regular | 1.4 | 0 | Menu items |
| `tooltip` | 12px / 0.75rem | 400 Regular | 1.4 | 0 | Tooltip text |
| `status-bar` | 11px / 0.6875rem | 400 Regular | 1 | 0 | Status bar text (mono) |

### Engineering Value Display
```
┌─────────────────────────────────┐
│ Moment (kN·m)                   │  ← label (12px, medium, text-muted)
│ 245.67                          │  ← value (14px, medium, mono, text-primary)
│        kN·m                     │  ← unit (10px, regular, text-muted, ml-1)
└─────────────────────────────────┘

Compact:  245.67 kN·m    (value + unit inline)
Stacked:  Moment (kN·m)  (label on top, value below)
```

---

## 1.3 Spacing System (4px Base Grid)

| Token | Value | Usage |
|-------|-------|-------|
| `space-0` | 0px | Reset |
| `space-0.5` | 2px | Micro gaps (icon-text tight) |
| `space-1` | 4px | Inline element gap, icon padding |
| `space-1.5` | 6px | Tight padding (badges, chips) |
| `space-2` | 8px | Small padding, between related items |
| `space-3` | 12px | Input padding, card inner spacing |
| `space-4` | 16px | Standard padding, section gap |
| `space-5` | 20px | Medium spacing |
| `space-6` | 24px | Panel padding, large gaps |
| `space-8` | 32px | Section padding |
| `space-10` | 40px | Large section padding |
| `space-12` | 48px | Page section margins |
| `space-16` | 64px | Hero section padding |
| `space-20` | 80px | Marketing page section gaps |
| `space-24` | 96px | Major page divisions |

### Layout Constants
| Element | Value |
|---------|-------|
| Header bar height | 36px (h-9) |
| Ribbon toolbar height | 100px collapsed / 140px expanded |
| Sidebar width | 192px (w-48) collapsed: 48px (w-12) |
| Right panel width | 280px–360px |
| Status bar height | 24px |
| Bottom results panel | 200px–400px (draggable) |
| Minimum viewport | 400px × 300px |
| Tab bar height | 32px |
| Tool button (large) | 56 × 56px |
| Tool button (normal) | 50 × 50px |
| Tool button (compact) | 32px height |

---

## 1.4 Elevation / Shadow System

| Level | Shadow | Usage |
|-------|--------|-------|
| `elevation-0` | none | Flat elements, inline |
| `elevation-1` | `0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08)` | Cards, sidebar |
| `elevation-2` | `0 4px 6px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.08)` | Dropdowns, popovers |
| `elevation-3` | `0 10px 15px rgba(0,0,0,0.15), 0 4px 6px rgba(0,0,0,0.10)` | Modals, dialogs |
| `elevation-4` | `0 20px 25px rgba(0,0,0,0.18), 0 8px 10px rgba(0,0,0,0.12)` | Floating panels |
| `glow-primary` | `0 0 20px rgba(59,130,246,0.3)` | Selected/active accent glow |
| `glow-success` | `0 0 20px rgba(34,197,94,0.3)` | Success state glow |
| `glow-error` | `0 0 20px rgba(239,68,68,0.3)` | Error state glow |
| `inner-shadow` | `inset 0 2px 4px rgba(0,0,0,0.06)` | Pressed buttons, input focus |

---

## 1.5 Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `radius-none` | 0px | Tables, engineering data grids |
| `radius-sm` | 4px | Small buttons, badges, chips |
| `radius-md` | 6px | Inputs, cards, panels |
| `radius-lg` | 8px | Modals, larger cards |
| `radius-xl` | 12px | Hero cards, marketing elements |
| `radius-2xl` | 16px | Landing page feature cards |
| `radius-full` | 9999px | Pills, avatars, circular buttons |

---

## 1.6 Border Widths

| Token | Value | Usage |
|-------|-------|-------|
| `border-0` | 0px | Borderless cards in dark mode |
| `border-1` | 1px | Standard borders — inputs, cards, dividers |
| `border-2` | 2px | Focus rings, active tabs, selected items |
| `border-3` | 3px | Strong emphasis borders |

---

## 1.7 Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `z-base` | 0 | Normal flow |
| `z-dropdown` | 10 | Dropdowns, select menus |
| `z-sticky` | 20 | Sticky header, ribbon |
| `z-overlay` | 30 | Sidebar overlay (mobile) |
| `z-modal` | 40 | Modals, dialogs |
| `z-popover` | 50 | Tooltips, popovers |
| `z-toast` | 60 | Toast notifications |
| `z-command` | 70 | Command palette |
| `z-max` | 100 | Loading overlay |

---

## 1.8 Icon System

### Icon Library: Lucide React (Primary) + Custom Engineering Icons

**Size Scale:**
| Size | px | Usage |
|------|-----|-------|
| `xs` | 12px | Inline with caption text |
| `sm` | 14px | Inline with body text, badges |
| `md` | 16px | Default — menu items, buttons |
| `lg` | 20px | Toolbar buttons, feature icons |
| `xl` | 24px | Panel headers, empty states |
| `2xl` | 32px | Feature cards, dashboard |
| `3xl` | 48px | Hero section, onboarding |

**Engineering-Specific Icons Required (Custom SVG):**
```
Structural:
  beam-horizontal, beam-vertical, beam-inclined
  column, brace-x, brace-v, brace-k
  truss-warren, truss-pratt, truss-howe
  frame-portal, frame-multi-story
  arch, cable, shell, plate
  node-fixed, node-pinned, node-roller, node-free, node-spring
  support-fixed, support-pinned, support-roller, support-spring

Loading:
  load-point, load-udl, load-varying, load-moment
  load-triangular, load-trapezoidal
  load-thermal, load-prestress
  load-seismic, load-wind, load-dead, load-live
  load-combination

Analysis:
  analysis-linear, analysis-nonlinear
  analysis-modal, analysis-buckling
  analysis-pdelta, analysis-pushover
  analysis-dynamic, analysis-seismic
  analysis-time-history
  stress-contour, displacement
  bending-moment, shear-force, axial-force

Design:
  steel-section-i, steel-section-c, steel-section-l
  steel-section-tube, steel-section-pipe
  rebar, stirrup, reinforcement
  bolt, weld
  footing-isolated, footing-combined, footing-pile
  slab, wall, column-rc

Tools:
  mesh, mesh-quad, mesh-tri
  measure, dimension
  grid-structural, grid-axis
  coordinate-global, coordinate-local
  section-database, material-database
```

---

## 1.9 Grid & Layout System

### 12-Column Grid
```
Marketing Pages: max-width 1280px, 12 columns, 24px gutter, 32px margin
Application:     full-width, flex-based layout, no max-width constraint
```

### Application Layout Grid
```
┌─────────────────────────────────────────────────────────────────┐
│ Header (36px, full width, z-20)                                 │
├──────┬──────────────────────────────────────────────┬───────────┤
│      │ Ribbon Toolbar (100px, flexible width)        │           │
│ Left │                                               │ Right     │
│ Side │                                               │ Inspector │
│ bar  │                                               │ Panel     │
│      │ 3D Viewport (flex-1, min 400×300)             │           │
│ 192px│                                               │ 280-360px │
│      │                                               │           │
│      ├──────────────────────────────────────────────┤           │
│      │ Bottom Panel (200-400px, draggable)            │           │
├──────┴──────────────────────────────────────────────┴───────────┤
│ Status Bar (24px, full width)                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Responsive Breakpoints
| Name | Min Width | Layout Changes |
|------|-----------|----------------|
| `mobile` | 0px | Single column, hamburger menu, no sidebar |
| `tablet` | 640px | Collapsible sidebar, stacked panels |
| `laptop` | 1024px | Sidebar visible, right panel overlay |
| `desktop` | 1280px | Full layout, all panels docked |
| `wide` | 1440px | Extra width for tables and results |
| `ultra` | 1920px | 4K optimized, larger viewport area |

---

## 1.10 Motion & Animation Tokens

| Token | Duration | Easing | Usage |
|-------|----------|--------|-------|
| `transition-fast` | 100ms | ease-out | Hover states, toggles |
| `transition-normal` | 200ms | ease-out | Panel open/close, tabs |
| `transition-slow` | 300ms | ease-in-out | Modal entrance, page transitions |
| `transition-spring` | 400ms | cubic-bezier(0.34, 1.56, 0.64, 1) | Bounce effects, success pop |
| `transition-smooth` | 500ms | cubic-bezier(0.4, 0, 0.2, 1) | Large layout shifts |

| Animation | Duration | Usage |
|-----------|----------|-------|
| `fadeIn` | 300ms | Component mount |
| `slideUp` | 250ms | List items, cards entering |
| `slideInRight` | 300ms | Side panels, toasts |
| `float` | 6000ms (infinite) | Landing page decorative elements |
| `shimmer` | 2000ms (infinite) | CTA button shimmer effect |
| `pulse` | 2000ms (infinite) | Loading indicators |
| `buttonPress` | 150ms | Tactile button feedback |
| `successPop` | 400ms | Success confirmations |
| `bounceIn` | 500ms | Modals, important elements |
| `gradientShift` | 6000ms (infinite) | Hero background gradient |
| `skeletonPulse` | 1500ms (infinite) | Skeleton loading placeholders |

---

## 1.11 Figma Styles Naming Convention

```
Colors/
  Primary/50, Primary/100, ..., Primary/900
  Secondary/Default, Secondary/Light, Secondary/Dark
  Accent/Default, Accent/Light, Accent/Dark
  Gold/Default, Gold/Light, Gold/Dark
  Status/Success, Status/Warning, Status/Error, Status/Info
  Dark/Background, Dark/Surface, Dark/Surface Elevated, Dark/Border, Dark/Border Subtle
  Dark/Text Primary, Dark/Text Secondary, Dark/Text Muted, Dark/Text Disabled
  Light/Background, Light/Surface, Light/Border
  Engineering/Tension, Engineering/Compression, Engineering/Deformation
  Engineering/Node, Engineering/Member, Engineering/Support, Engineering/Load

Typography/
  Display/XL, Display/LG, Display/MD
  Heading/H1, Heading/H2, Heading/H3, Heading/H4, Heading/H5, Heading/H6
  Body/Default, Body/Small, Body/Caption
  Engineering/Value, Engineering/Unit, Engineering/Label, Engineering/Code
  UI/Button, UI/Button Small, UI/Tab, UI/Menu, UI/Tooltip, UI/Status Bar

Effects/
  Shadow/Elevation 1, Shadow/Elevation 2, Shadow/Elevation 3, Shadow/Elevation 4
  Glow/Primary, Glow/Success, Glow/Error
  Shadow/Inner

Grids/
  Marketing/12 Column
  App/Workspace Layout
```
