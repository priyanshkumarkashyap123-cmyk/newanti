# BeamLab Ultimate — Complete Figma Specification Audit

> **Audit Date:** Auto-generated from 23 Figma spec documents  
> **Source:** `/docs/figma/00_MASTER_INDEX.md` through `22_ACCESSIBILITY_PERFORMANCE.md`  
> **Product:** BeamLab Ultimate v3.0 (Target: Feb 2026)  
> **Stack:** React + TypeScript, Three.js/R3F, Rust/WASM, FastAPI, MongoDB Atlas, Azure  

---

## TABLE OF CONTENTS

1. [Spec File Inventory](#1-spec-file-inventory)
2. [Design Tokens](#2-design-tokens)
3. [UI Components](#3-ui-components)
4. [Pages & Screens](#4-pages--screens)
5. [Backend Endpoints & Services](#5-backend-endpoints--services)
6. [Animations & Micro-Interactions](#6-animations--micro-interactions)
7. [Keyboard Shortcuts](#7-keyboard-shortcuts)
8. [Accessibility (WCAG)](#8-accessibility-wcag)
9. [Performance Budgets](#9-performance-budgets)
10. [Responsive / Mobile](#10-responsive--mobile)
11. [i18n & Security UX](#11-i18n--security-ux)

---

## 1. Spec File Inventory

| # | File | Topic | Lines |
|---|------|-------|-------|
| 00 | `00_MASTER_INDEX.md` | Document map, design principles (7), Figma file hierarchy, 7 target resolutions | ~100 |
| 01 | `01_DESIGN_SYSTEM.md` | Full token system: colors, typography, spacing, elevation, motion, icons, grid | ~700 |
| 02 | `02_COMPONENT_LIBRARY.md` | 23 reusable components (Button → Color Legend) | ~850 |
| 03 | `03_LANDING_MARKETING.md` | 10 landing sections + Pricing/About/Contact/Capabilities pages + mobile landing | ~611 |
| 04 | `04_AUTHENTICATION.md` | Sign In/Up, OAuth, verification, forgot/reset password, error states, mobile auth | ~500 |
| 05 | `05_DASHBOARD.md` | Dashboard layout, project cards, new project, template browser, notifications | ~600 |
| 06 | `06_MAIN_WORKSPACE.md` | Header, ribbon, toolbar panels, sidebar, 3D viewport, properties, status bar | ~700 |
| 07 | `07_GEOMETRY_MODELING.md` | Node/member/plate creation, grid generator, wizard, snap, edit ops (move/copy/mirror/rotate/array) | ~700 |
| 08 | `08_PROPERTIES_MATERIALS.md` | Section database, custom section creator, material DB, supports, member releases, offsets | ~600 |
| 09 | `09_LOADING_SYSTEM.md` | Load cases, point/UDL/trapezoidal/moment/self-weight/floor/thermal/moving loads, combos, seismic, wind generators | ~690 |
| 10 | `10_ANALYSIS_ENGINE.md` | Linear/P-Delta/Buckling/Modal/Response Spectrum/Nonlinear analysis setup, progress, validation | ~600 |
| 11 | `11_RESULTS_POSTPROCESSING.md` | BMD/SFD/AFD/deformed/mode shapes/stress contours, tables, pushover curve, drift chart | ~600 |
| 12 | `12_DESIGN_MODULES.md` | Steel (IS 800), RC (IS 456), connection, foundation design; results overlay | ~600 |
| 13 | `13_REPORTING_EXPORT.md` | Report builder, calculation sheet, export (8 formats), print/drawing layout | ~500 |
| 14 | `14_AI_AUTOMATION.md` | AI Architect panel, generative design, code compliance, section optimizer, voice command, chat | ~550 |
| 15 | `15_BIM_INTEGRATION.md` | BIM Hub, IFC import/export, Revit sync, STAAD.Pro import, API access | ~500 |
| 16 | `16_COLLABORATION.md` | Multi-user cursors, share dialog, comments, version history, activity feed | ~500 |
| 17 | `17_SETTINGS.md` | Profile, units, appearance/theme, keyboard shortcuts, subscription mgmt | ~500 |
| 18 | `18_MOBILE_RESPONSIVE.md` | Tablet/mobile layouts, touch gestures, bottom sheets, action sheets, mobile toasts | ~400 |
| 19 | `19_ONBOARDING_HELP.md` | 4-step wizard, guided tour (8 stops), contextual help, help center, what's new, empty states | ~400 |
| 20 | `20_ADVANCED_FEATURES.md` | Scripting/macro editor, digital twin, BOQ, BBS, parametric modeling, batch processing, cost estimation, optimization, templates, what-if, earthquake sim, drafting, stamp editor | ~696 |
| 21 | `21_INTERACTIONS_ANIMATIONS.md` | Animation tokens, all component transitions, 3D viewport interactions, page transitions, drag & drop, micro-interaction summary table | ~707 |
| 22 | `22_ACCESSIBILITY_PERFORMANCE.md` | WCAG 2.1 AA, keyboard nav, ARIA landmarks, focus management, reduced motion, color-blind palettes, text sizing, perf budgets, lazy loading, caching, error UX, i18n, security UX, perf monitor | ~795 |

**Total: 23 files, ~13,000+ lines of specification.**

---

## 2. Design Tokens

### 2.1 Color System

#### Primary Palette
| Token | Value | Usage |
|-------|-------|-------|
| `blue-50` – `blue-950` | 10 shades | Primary brand, actions, links |
| `purple-50` – `purple-950` | 10 shades | Secondary / AI features |
| `cyan-50` – `cyan-950` | 10 shades | Accent / engineering highlights |
| `gold-50` – `gold-950` | 10 shades | Premium features |

#### Status Colors
| Status | Token | Hex |
|--------|-------|-----|
| Success | `green-500` | `#22c55e` |
| Warning | `yellow-500` | `#eab308` |
| Error | `red-500` | `#ef4444` |
| Info | `blue-500` | `#3b82f6` |

#### Dark Theme (Navy System)
| Token | Hex | Usage |
|-------|-----|-------|
| `surface-darkest` | `#020617` | App background |
| `surface-dark` | `#0f172a` | Primary background |
| `surface-dark-2` | `#1e293b` | Cards, panels |
| `surface-dark-3` | `#334155` | Elevated surfaces |
| `surface-dark-4` | `#475569` | Borders |
| `text-primary` | `#f8fafc` | Primary text |
| `text-secondary` | `#94a3b8` | Secondary text |
| `text-tertiary` | `#64748b` | Tertiary text |
| `text-disabled` | `#475569` | Disabled text |

#### Light Theme
| Token | Hex | Usage |
|-------|-----|-------|
| `surface-light` | `#ffffff` | Background |
| `surface-light-2` | `#f8fafc` | Cards |
| `surface-light-3` | `#f1f5f9` | Borders |
| `text-light-primary` | `#0f172a` | Text |
| `text-light-secondary` | `#475569` | Secondary |
| `text-light-tertiary` | `#94a3b8` | Tertiary |

#### Engineering Result Colors
| Token | Hex | Usage |
|-------|-----|-------|
| `stress-low` | `#3b82f6` | Low stress (blue) |
| `stress-mid` | `#22c55e` | Medium stress (green) |
| `stress-high` | `#eab308` | High stress (yellow) |
| `stress-critical` | `#ef4444` | Critical stress (red) |
| `deformation-min` | `#06b6d4` | Min displacement (cyan) |
| `deformation-max` | `#dc2626` | Max displacement (red) |
| `node-default` | `#94a3b8` | Node normal |
| `node-selected` | `#3b82f6` | Node selected |
| `node-hover` | `#06b6d4` | Node hover |
| `member-default` | `#cbd5e1` | Member normal |
| `member-selected` | `#3b82f6` | Member selected |
| `member-hover` | `#fbbf24` | Member hover |
| `support-fixed` | `#f97316` | Fixed support |
| `support-pinned` | `#a855f7` | Pinned support |

#### Gradients (10 defined)
1. `gradient-primary` — blue-600 → blue-400
2. `gradient-hero` — blue-600 → purple-600 → cyan-500
3. `gradient-stress` — blue-500 → green-500 → yellow-500 → red-500 (engineering rainbow)
4. `gradient-card-hover` — blue-500/5 → purple-500/5
5. `gradient-gold` — yellow-500 → amber-400
6. `gradient-success` — green-500 → emerald-400
7. `gradient-danger` — red-500 → rose-400
8. `gradient-dark-fade` — slate-900 → transparent
9. `gradient-glass` — white/5 → white/10 (glassmorphism)
10. `gradient-rainbow` — 6-color spectrum for stress contours

### 2.2 Typography

#### Font Families
| Family | Font | Usage |
|--------|------|-------|
| Display | Space Grotesk (600, 700) | Headings, hero |
| Body | Inter (400, 500, 600, 700) | All body text |
| Mono | JetBrains Mono (400, 500) | Code, coordinates, engineering values |

#### Type Scale (22 entries)
| Token | Size | Weight | Line Height | Usage |
|-------|------|--------|-------------|-------|
| `display-xl` | 48px | 700 | 1.1 | Hero heading |
| `display-lg` | 36px | 700 | 1.15 | Page titles |
| `display-md` | 30px | 600 | 1.2 | Section titles |
| `h1` | 24px | 600 | 1.3 | Panel headers |
| `h2` | 20px | 600 | 1.35 | Card titles |
| `h3` | 18px | 600 | 1.4 | Sub-headers |
| `h4` | 16px | 600 | 1.4 | Group labels |
| `body-lg` | 16px | 400 | 1.6 | Primary body |
| `body-md` | 14px | 400 | 1.5 | Default body |
| `body-sm` | 13px | 400 | 1.5 | Compact text |
| `caption` | 12px | 400 | 1.4 | Helper text |
| `overline` | 11px | 600 / uppercase | 1.5 | Category labels |
| `code-lg` | 14px | 400 (mono) | 1.6 | Script editor |
| `code-md` | 13px | 400 (mono) | 1.5 | Inline code |
| `code-sm` | 12px | 400 (mono) | 1.4 | Coordinate bar |
| `label-lg` | 14px | 500 | 1 | Input labels |
| `label-md` | 13px | 500 | 1 | Button text |
| `label-sm` | 12px | 500 | 1 | Tab labels |
| `label-xs` | 11px | 500 | 1 | Badge text |
| `tooltip` | 12px | 400 | 1.4 | Tooltip text |
| `engineering-value` | 13px | 500 (mono) | 1. | Result values |
| `status-bar` | 11px | 400 | 1 | Status bar text |

### 2.3 Spacing

- **Base grid:** 4px
- **Tokens:** `space-0` (0) through `space-24` (96px) — 16 tokens
- **Layout constants:**

| Element | Size |
|---------|------|
| Header bar | 36px height |
| Ribbon tab bar | 32px |
| Ribbon tool panel | 80–100px (expandable to 140px) |
| Sidebar (expanded) | 192px (220px dashboard) |
| Sidebar (collapsed) | 48px (56px dashboard) |
| Right properties panel | 280–360px |
| Status bar | 24px |
| Bottom panel | 200–400px (resizable) |

### 2.4 Elevation / Shadows

| Level | Shadow | Usage |
|-------|--------|-------|
| `elevation-0` | none | Flat elements |
| `elevation-1` | `0 1px 2px rgba(0,0,0,0.3)` | Cards |
| `elevation-2` | `0 2px 8px rgba(0,0,0,0.3)` | Dropdowns |
| `elevation-3` | `0 4px 16px rgba(0,0,0,0.3)` | Modals |
| `elevation-4` | `0 8px 32px rgba(0,0,0,0.4)` | Popovers |
| `elevation-5` | `0 16px 48px rgba(0,0,0,0.5)` | Drag ghost |
| `glow-blue` | `0 0 20px rgba(59,130,246,0.3)` | Active primary |
| `glow-cyan` | `0 0 20px rgba(6,182,212,0.3)` | Engineering highlight |
| `glow-gold` | `0 0 20px rgba(234,179,8,0.3)` | Premium |
| `inner-shadow` | `inset 0 1px 2px rgba(0,0,0,0.2)` | Recessed inputs |

### 2.5 Border Radius

| Token | Value |
|-------|-------|
| `radius-none` | 0 |
| `radius-sm` | 4px |
| `radius-md` | 6px |
| `radius-lg` | 8px |
| `radius-xl` | 12px |
| `radius-2xl` | 16px |
| `radius-full` | 9999px |

### 2.6 Z-Index Scale

| Token | Value | Usage |
|-------|-------|-------|
| `z-base` | 0 | Default |
| `z-dropdown` | 10 | Dropdowns |
| `z-sticky` | 20 | Sticky headers |
| `z-overlay` | 30 | Overlays |
| `z-modal` | 40 | Modals |
| `z-popover` | 50 | Popovers |
| `z-toast` | 60 | Toast notifications |
| `z-tooltip` | 70 | Tooltips |
| `z-maximum` | 100 | Force-on-top |

### 2.7 Icons

- **Primary library:** Lucide React (200+ icons)
- **Custom engineering icons:** 60+ SVG across 4 categories:
  - **Structural:** node, member, plate, support-fixed, support-pinned, support-roller, spring, hinge, rigid-link
  - **Loading:** point-load, UDL, moment, thermal, self-weight, moving-load, wind-load, seismic
  - **Analysis:** BMD, SFD, AFD, deformed, mode-shape, stress-contour, convergence
  - **Design:** section-I, section-rect, section-pipe, rebar, stirrup, bolt, weld, foundation

### 2.8 Motion Tokens

#### Durations
| Token | Value | Usage |
|-------|-------|-------|
| `--duration-instant` | 75ms | Micro-feedback (color change) |
| `--duration-fast` | 150ms | Hover states, small movements |
| `--duration-normal` | 250ms | General transitions |
| `--duration-slow` | 400ms | Complex state changes |
| `--duration-slower` | 600ms | Large layout shifts |
| `--duration-dramatic` | 1000ms | Page transitions, reveals |
| `--duration-loop` | 2000ms | Pulsing, breathing |

#### Easing Functions
| Token | Value | Usage |
|-------|-------|-------|
| `--ease-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | General |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Exiting |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Entering |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Two-state toggles |
| `--ease-spring` | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | Bounces |
| `--ease-overshoot` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Attention |

#### Named Animations (11)
`fadeIn`, `fadeOut`, `slideUp`, `slideDown`, `slideLeft`, `slideRight`, `scaleIn`, `shimmer`, `pulse`, `bounceIn`, `spin`

---

## 3. UI Components

### 3.1 Core Component Library (Spec 02)

| # | Component | Variants | Key Specs |
|---|-----------|----------|-----------|
| 1 | **Button** | 8 variants (Primary, Secondary, Outline, Ghost, Destructive, Success, Icon, Link) × 5 sizes (xs–xl) × 6 states | Shimmer CTA, icon+label, loading spinner |
| 2 | **Input** | 10 variants (Text, Number, Coordinate Bar, Unit Input, Password, Search, Textarea, Date, Color, File) × 6 states | Floating label, unit suffix, scrub drag, error shake |
| 3 | **Card** | 6 variants (Default, Interactive, Stat, Project, Feature, Pricing) | 280px project cards, 3D thumbnail |
| 4 | **Badge** | 7 variants (Default, Primary, Success, Warning, Error, Info, Outline) | dot indicator, closable, icon |
| 5 | **Dialog/Modal** | 4 sizes (sm 400, md 560, lg 720, full) | Focus trap, spring scale entry, engineering-specific dialogs |
| 6 | **Table/DataTable** | Engineering-optimized | Virtual scrolling, sort, filter, export, density, heat-map bars |
| 7 | **Tabs** | 3 variants (Line, Pill, Enclosed) × 3 sizes | Sliding active indicator |
| 8 | **Tooltip** | Standard + Rich (with links/images) | 500ms show delay, 320px max |
| 9 | **Context Menu** | Desktop + mobile action sheet | Keyboard shortcuts, separators, submenus |
| 10 | **Toast/Notification** | 4 variants (Success, Error, Warning, Info) | 5s auto-dismiss, max 3 stacked, swipe dismiss, progress bar |
| 11 | **Command Palette** | Single | 560px, search + categories, Ctrl+K |
| 12 | **Skeleton/Loading** | Text, Card, Table, Analysis Progress | Shimmer animation 1.5s, step indicators |
| 13 | **Empty State** | No Projects, No Results, No Members, No Analysis, Search Empty | Illustration + CTA |
| 14 | **Drawer/Sheet** | Right-sliding | 280–360px width |
| 15 | **Accordion** | Single | Arrow rotate 180°, height animation |
| 16 | **Switch/Toggle** | 3 sizes (sm, md, lg) | Spring transition for thumb |
| 17 | **Slider** | Single value + Range | Thumb follow, track fill |
| 18 | **Checkbox** | Standard + Indeterminate | Stroke-dashoffset check draw |
| 19 | **Radio** | Standard | Dot scale animation |
| 20 | **Progress** | Linear (determinate + indeterminate), Circular/Ring, Step Progress | Gradient bar, percentage counter |
| 21 | **Dropdown/Select** | Searchable, categorized | Chevron rotate, stagger items, 320px max |
| 22 | **MiniMap** | 160×120px, bottom-right | Current view rectangle, click-to-navigate |
| 23 | **ViewCube** | 80×80px, top-right | Click face → snap to view (quaternion slerp 500ms) |
| 24 | **Color Legend** | Gradient bar for stress contours | Horizontal, min/max labels |

### 3.2 Engineering-Specific Components

| Component | Spec File | Key Specs |
|-----------|-----------|-----------|
| **Coordinate Input Bar** | 02, 06 | Triple X/Y/Z fields, mono font, Tab to cycle |
| **Section SVG Preview** | 08 | Cross-section rendering with dimensions |
| **Support Symbols** | 08 | 6 types: Fixed/Pinned/Roller/Inclined Roller/Spring/Free |
| **Load Arrows** | 09 | Point/UDL/Moment/Triangular/Self-weight/Floor/Thermal/Moving |
| **BMD/SFD/AFD Diagrams** | 11 | Filled polygons, color-coded, values at critical points |
| **Deformed Shape Overlay** | 11 | Gradient blue→red, original dashed gray, animate morph |
| **Mode Shape Viewer** | 11 | Animated sinusoidal, play/pause, frequency table |
| **Stress Contour Display** | 11 | Smooth/stepped/isolines, engineering rainbow, component selector |
| **Utilization Ratio Bar** | 12 | 4-tier color 0→1.0+, pulsing failed members |
| **Interaction Diagram** | 12 | Pu-Mu column design curve with RC section |
| **Pushover Curve** | 11 | Capacity curve with IO/LS/CP points, hinge status |
| **Inter-Storey Drift Chart** | 11 | Horizontal bars, code limit line |
| **Design Spectrum Chart** | 09, 10 | IS 1893 Sa/g vs T plot |
| **Convergence Monitor** | 10 | Log-scale error plot with tolerance line |
| **Bar Bending Schedule** | 20 | Cross-section SVG + rebar + schedule table |
| **Cost Breakdown Chart** | 20 | Horizontal bars + pie chart |
| **Optimization Convergence** | 20 | Weight vs iteration line chart |
| **Time-History Plot** | 20 | Ground acceleration + roof displacement |
| **Sparkline Charts** | 20 | Sensor trend mini-charts (Digital Twin) |

### 3.3 Layout Components

| Component | Spec | Key Specs |
|-----------|------|-----------|
| **Header Bar** | 06 | 36px, Zone A: logo, project name, undo/redo, search, chat, UserButton |
| **Ribbon Tab Bar** | 06 | 32px, Zone B: 6 tabs with color-coded top borders |
| **Ribbon Tool Panels** | 06 | 80–100px, Zone C: tool groups per tab |
| **Workflow Sidebar** | 06 | 192/48px, category tree + model tree |
| **Properties Panel** | 06 | 280px right, context-sensitive |
| **Status Bar** | 06 | 24px, Zone D: status, model counts, load case, units, snap, grid, zoom |
| **Bottom Panel** | 20 | 200–400px, script editor console |
| **Mobile Bottom Sheet** | 18 | 3 snap points (Peek 100px / Half 50% / Full 90%) |
| **Mobile Action Sheet** | 18 | Full-width bottom overlay replacing context menu |
| **Mobile Bottom Nav** | 18 | 5-icon tab bar |

---

## 4. Pages & Screens

### 4.1 Marketing / Public Pages

| Page | Spec | Sections/Features |
|------|------|-------------------|
| **Landing Page** | 03 | Nav bar (64px fixed), Hero (gradient blobs, 3D preview, stat counters), Trust Bar (logos), Features (4×3 grid), Comparison Table (vs STAAD/ETABS/SkyCiv), Interactive Demo (tabbed, auto-cycling), Testimonials (carousel), Pricing Preview (3 tiers), CTA, Footer (4-col) |
| **Pricing Page** | 03 | 4 tiers (Academic FREE / Professional ₹999/mo / Team ₹2,499/mo / Enterprise Custom), feature comparison matrix, FAQ accordion |
| **About Page** | 03 | Mission, timeline, tech stack, contact |
| **Contact Page** | 03 | Split layout: info + form |
| **Capabilities Page** | 03 | Sidebar nav + capability cards grid |
| **Documentation / Blog** | 03 | 6 category cards, popular articles |
| **Mobile Landing** | 03 | Single-column, hamburger nav, stacked pricing |

### 4.2 Auth Screens

| Screen | Spec | Features |
|--------|------|----------|
| **Sign In** | 04 | Split 50/50 (brand + form), 3 OAuth (Google/GitHub/LinkedIn), email+password, remember device |
| **Sign Up** | 04 | Name, email, password (strength meter 5-level), company, role selector, terms |
| **Email Verification** | 04 | Centered, 6-digit code, resend timer, successPop animation |
| **Forgot Password** | 04 | Email input, success illustration |
| **Reset Password** | 04 | New password + confirm with strength meter |
| **OAuth Loading** | 04 | Spinner, progress bar, auto-redirect |
| **Account Locked** | 04 | Countdown timer, contact support |
| **Mobile Auth** | 04 | 375×812, no brand panel, stacked, 44px touch targets |

### 4.3 Dashboard

| View | Spec | Features |
|------|------|----------|
| **Main Dashboard** | 05 | Sidebar (220/56px), 4 stat cards, recent projects grid, quick actions 2×4, activity, learning |
| **Project Cards** | 05 | 280px, 3D thumbnail, badges, favorites, context menu (12 actions) |
| **New Project Dialog** | 05 | 4 start options (Blank/Template/AI/Import), units, code, structure type, tags |
| **Template Browser** | 05, 20 | Categories, search, ratings, pagination, customizable parameters |
| **Project List View** | 05 | Table alternative with sort/filter |
| **Notification Panel** | 05 | 360px dropdown, grouped by day |
| **User Profile Dropdown** | 05 | 240px, dark mode toggle, unit switch |
| **Import Project** | 05 | 5 formats (.STD/.IFC/.DXF/.E2K/.CSV), drag-drop |

### 4.4 Main Workspace

| Zone | Spec | Features |
|------|------|----------|
| **Zone A: Header** | 06 | Logo, project name (editable), undo/redo, global search, AI chat, collaborator avatars, bell, UserButton, settings |
| **Zone B: Ribbon Tabs** | 06 | Geometry (green) / Properties (blue) / Loading (orange) / Analysis (purple) / Design (gold) / Civil Engg (teal) |
| **Zone C: Ribbon Panels** | 06–12 | Per-tab tool groups (detailed below) |
| **3D Viewport** | 06, 07 | Navigation (orbit/pan/zoom), display styles, selection modes (click/Ctrl/box/Shift), grid, snap, overlays |
| **Properties Panel** | 06, 08 | Node selected / Member selected / Nothing selected (model summary) |
| **Workflow Sidebar** | 06 | Model tree: Nodes, Members, Plates, Supports, Load Cases |
| **Status Bar** | 06 | Ready/Computing/Error, counts, active LC, units, snap, grid, zoom % |

### 4.5 Geometry / Modeling Screens

| Screen | Spec | Features |
|--------|------|----------|
| **Node Creation Mode** | 07 | Crosshair cursor, snap indicator, ghost node, 6 display styles |
| **Member Creation Mode** | 07 | Two-click, rubber-band, auto-create nodes, 7 display + section rendering |
| **Grid Generation Dialog** | 07 | 5 structure types, custom bays/storeys, live 2D preview |
| **Structure Wizard** | 07 | 4-step, 8 structure types + AI NLP input |
| **Snap & Grid Settings** | 07 | Popover: grid type/color/opacity, 5 snap options, 6 display toggles |
| **Plate Element Creation** | 07 | 4-click, fill/outline, mesh overlay |
| **Measurement Tool** | 07 | Distance + angle, ΔX/ΔY/ΔZ popup |
| **Move/Copy/Mirror/Rotate/Array** | 07 | Displacement input, ghost preview, planes, angles, counts |

### 4.6 Properties / Materials Screens

| Screen | Spec | Features |
|--------|------|----------|
| **Section Database Browser** | 08 | 720×600, tree categories (Steel Indian/Amer/Euro/Brit/Aus, Concrete, Composite, Cold-Formed, Timber, Custom), table, SVG preview |
| **Custom Section Creator** | 08 | 7 shapes (I/Rect/Pipe/Tube/Angle/Channel/Tee), live SVG, auto-calc properties |
| **Material Database** | 08 | Searchable: Steel IS2062/ASTM/EN, Concrete IS456/EN, Rebar Fe415-550D; stress-strain curve |
| **Support Assignment Panel** | 08 | 6 types + Custom, spring constants, viewport symbols |
| **Member Release Editor** | 08 | Presets (Fixed/Pinned/Universal/Truss/Custom), 6 DOF/end, partial fixity |
| **Member Offset Editor** | 08 | Rigid offset vs manual, auto-calc from section |

### 4.7 Loading System Screens

| Screen | Spec | Features |
|--------|------|----------|
| **Load Case Manager** | 09 | Sidebar, checkboxes, color-coded, context menu |
| **New Load Case Dialog** | 09 | 8 types: Dead/Live/Wind/Seismic/Thermal/Snow/Construction/Impact |
| **Point Load Dialog** | 09 | Node/along member, Fx/Fy/Fz + Mx/My/Mz, direction, preview |
| **UDL Dialog** | 09 | Full/partial, 3 directions, preview |
| **Triangular/Trapezoidal** | 09 | 4 patterns, start/end intensity |
| **Moment Load** | 09 | 3-axis, right-hand rule |
| **Self-Weight** | 09 | Direction, factor, all/selected |
| **Floor/Area Load** | 09 | One-way/two-way/auto, 10 IS 875-II categories, tributary distribution |
| **Thermal Load** | 09 | Uniform ΔT + gradient |
| **Moving Load** | 09 | IRC Class AA/A, Railway, Custom; vehicle diagram; path; envelope |
| **Load Combination Generator** | 09 | Manual + auto by code (IS/ASCE/EN/AS/NZS), ULS+SLS, ± signs |
| **Seismic Load Generator IS 1893** | 09 | Zone, soil, importance, R, spectrum chart, storey force table |
| **Wind Load Generator IS 875-III** | 09 | City picker, terrain/risk/topography, height-wise pressure, Cp, auto-distribute |
| **Load Display in Viewport** | 09 | 8 visualization styles, color legend, scale slider |
| **Load Table View** | 09 | Per-case table, ΣFy summary |

### 4.8 Analysis Screens

| Screen | Spec | Features |
|--------|------|----------|
| **Analysis Setup Dialog (6 tabs)** | 10 | Linear Static, P-Delta, Buckling, Modal, Response Spectrum, Nonlinear |
| **Linear Static** | 10 | Load case selection, solver engine (WASM Rust/JS/Backend Python), pre-check 8 items |
| **P-Delta** | 10 | Iterative/linearized, convergence criteria |
| **Buckling** | 10 | 3 methods (Subspace/Lanczos/Inverse), effective length factors |
| **Modal** | 10 | Mass source, lumping, 3 eigensolvers, frequency range |
| **Response Spectrum** | 10 | IS 1893 / custom, CQC/SRSS/ABS, 100-30 rule, missing mass |
| **Nonlinear Pushover** | 10 | 4 push patterns, displacement control, ASCE 41-17 hinges, IO/LS/CP |
| **Analysis Progress Overlay** | 10 | Step-by-step, gradient bar, solver info, memory, cancel |
| **Convergence Monitor** | 10 | Log-scale error plot |
| **Analysis Complete Summary** | 10 | Key max values, warnings, error diagnosis |
| **Pre-Analysis Validation** | 10 | Geometry/properties/supports/loads/stability checks with fix/locate |

### 4.9 Results Screens

| Screen | Spec | Features |
|--------|------|----------|
| **Results Toolbar** | 11 | 7 result types, LC selector, scale slider, display toggles |
| **BMD** | 11 | Tension-side, blue(+)/red(−) fills @20% opacity, critical values |
| **SFD** | 11 | Stepped rectangles, green(+)/orange(−) |
| **AFD** | 11 | Width proportional, blue compression/red tension |
| **Deformed Shape** | 11 | Original dashed + deformed gradient, displacement spectrum, animate |
| **Mode Shape Viewer** | 11 | Sinusoidal oscillation, frequency/period/mass table, play controls |
| **Stress Contour** | 11 | Component/surface selector, smooth/stepped/isolines, legend |
| **Member Forces Table** | 11 | Heat-map bars, click-to-highlight, summary |
| **Reactions Table** | 11 | Equilibrium check ΣR + ΣLoad = 0 |
| **Displacement Table** | 11 | Span/deflection ratio check |
| **Result Query Popup** | 11 | Click member → BMD/SFD/AFD diagrams + critical values |
| **Pushover Curve** | 11 | Capacity curve, IO/LS/CP points, hinge status, step animation |
| **Inter-Storey Drift Chart** | 11 | Horizontal bars, code limit, color by % |

### 4.10 Design Module Screens

| Screen | Spec | Features |
|--------|------|----------|
| **Design Setup** | 12 | 5 tabs: Steel/RC/Connection/Foundation/Timber |
| **Steel Design IS 800** | 12 | 5 codes, safety factors, effective length, 8 checks |
| **Steel Results Table** | 12 | UR color bars 0→1.0+, viewport overlay |
| **Detailed Steel Report** | 12 | Classification, compression/bending/LTB/interaction checks, recommendation |
| **RC Design IS 456** | 12 | Beam/column/slab/wall, grades, cover, ductile detailing IS 13920 |
| **RC Beam Result** | 12 | Cross-section SVG + rebar, flexure/shear calcs, reinforcement schedule |
| **RC Column Result** | 12 | Interaction diagram Pu-Mu, cross-section with rebar |
| **Connection Design** | 12 | 5 types, bolt detail SVG, 5 checks, DXF generation |
| **Foundation Design** | 12 | 4 types (Isolated/Combined/Pile/Raft), soil params, checks, drawing |
| **Design Viewport Overlay** | 12 | 6-tier UR color scheme, pulsing failed members |

### 4.11 Reporting / Export Screens

| Screen | Spec | Features |
|--------|------|----------|
| **Report Builder** | 13 | 5 types, 14-section tree, PDF/DOCX/HTML, company header |
| **Report Preview** | 13 | Paginated, jump-to-section, print/download |
| **Calculation Sheet** | 13 | 3-col Reference|Calculations|Output, monospaced, hand-calc style |
| **Export Dialog** | 13 | 8 formats (PDF/DXF/IFC/Excel/CSV/Image/JSON/STAAD) |
| **Print/Drawing Layout** | 13 | Title block, paper/scale settings |

### 4.12 AI / Automation Screens

| Screen | Spec | Features |
|--------|------|----------|
| **AI Architect Panel** | 14 | 380px sidebar, Gemini 2.0 Pro, 6 quick actions, chat with apply/modify/discard |
| **Generative Design** | 14 | NLP + sketch upload, parsed parameters, auto-assign |
| **AI Code Compliance** | 14 | Multi-code (IS456/800/1893/875/13920), violations + auto-fix |
| **AI Section Optimizer** | 14 | 4 objectives, constraints, groups, weight savings |
| **Voice Command** | 14 | Ctrl+Shift+Space, waveform, interpretation, confirm/edit/redo |
| **AI Chat Explainer** | 14 | Markdown, step-by-step, IS code references, apply buttons |

### 4.13 BIM Integration Screens

| Screen | Spec | Features |
|--------|------|----------|
| **BIM Hub** | 15 | 4 platforms (Revit/Tekla/AutoCAD/ETABS), connection status |
| **IFC Import** | 15 | Preview, element mapping (IfcColumn/Beam/Slab/Wall/Footing) |
| **IFC Export** | 15 | IFC4/IFC2x3/IFC4.3, 7 content types |
| **Revit Sync** | 15 | Bidirectional, change detection, conflict resolution |
| **STAAD.Pro Import** | 15 | .std parsing, unsupported features notification |
| **API Access** | 15 | API key management, webhooks, documentation link |

### 4.14 Collaboration Screens

| Screen | Spec | Features |
|--------|------|----------|
| **Multi-User Workspace** | 16 | Colored cursors (up to 6), element locking, activity indicators |
| **Share Project Dialog** | 16 | Email invite, 4 roles (Owner/Editor/Commenter/Viewer), link sharing with expiry/password |
| **Comments System** | 16 | Threaded, pinned to elements, open/resolved, @mentions, attachments |
| **Version History** | 16 | Manual + auto saves (5min), side-by-side compare, restore/download |
| **Activity Feed** | 16 | Chronological, color-coded by user |

### 4.15 Settings Screens

| Screen | Spec | Features |
|--------|------|----------|
| **Profile** | 17 | Personal info, professional details for reports, stamp/seal upload, connected accounts |
| **Units** | 17 | Preset SI/Imperial/MKS/Custom, per-quantity units, number format |
| **Appearance / Theme** | 17 | Dark/Light/System, 6 accent colors, 3D viewport settings, node/member display sliders |
| **Keyboard Shortcuts** | 17 | Searchable, presets (Default/STAAD-like/AutoCAD-like/Custom), editable |
| **Subscription** | 17 | Plan, usage meters, billing history, payment method |

### 4.16 Onboarding / Help Screens

| Screen | Spec | Features |
|--------|------|----------|
| **Welcome Wizard (4 steps)** | 19 | Welcome → Role/Prefs → Tour Offer → First Project |
| **Guided Tour (8 stops)** | 19 | Tooltip-based, pulsing highlight, dark overlay, dots progress |
| **Contextual Help Tooltips** | 19 | 1.5s delay, shortcut, doc + video links |
| **Help Center** | 19 | Search, 4 quick links (Docs/Videos/Tips/Academy), getting started, FAQs, live chat |
| **What's New Panel** | 19 | Modal 480px, new features/improvements/bugs, checkbox suppress |
| **Empty States** | 19 | 4 start options (Grid/Manual/AI/Import) when workspace empty |

### 4.17 Advanced Feature Screens

| Screen | Spec | Features |
|--------|------|----------|
| **Script Editor** | 20 | TS-based DSL, file explorer, syntax highlighting, autocomplete, console, debug |
| **Digital Twin Dashboard** | 20 | Live 3D overlay, sensor data, sparklines, health bars, alerts, time-history |
| **Bill of Quantities (BOQ)** | 20 | Steel/Concrete/Rebar/Formwork tabs, grand total with GST |
| **Bar Bending Schedule** | 20 | Cross-section SVG, rebar curtailment, schedule table, shape codes IS SP:34 |
| **Parametric Modeling Panel** | 20 | Slider-driven params, live 3D preview, constraints |
| **Batch Processing** | 20 | Multi-project, progress, auto-report generation |
| **Cost Estimation Module** | 20 | Rate input (DSR 2024), breakdown bar/pie chart, optimization suggestion |
| **Section Optimization** | 20 | GA, convergence plot, weight/cost reduction results |
| **Template Library (Expanded)** | 20 | Categories (Frames/Trusses/Bridges/Foundations/Tanks/Towers/Slabs/Stairs/Retaining), ratings, upload |
| **What-If Comparison** | 20 | Side-by-side options, UR/weight/cost/drift comparison, recommendation |
| **Earthquake Simulation** | 20 | Animated 3D response, playback controls, timeline scrubber, accel/disp plots |
| **Drawing / Drafting Module** | 20 | 2D editor (Line/Arc/Dim/Text/Hatch/Symbol), layers, auto-generate from model |
| **Engineer's Stamp Editor** | 20 | Name/license/signature/seal, preview, include on reports |

### 4.18 Mobile-Specific Screens

| Screen | Spec | Features |
|--------|------|----------|
| **Tablet Layout** | 18 | Horizontal scrollable toolbar, properties slide-in, touch gestures |
| **Mobile Dashboard** | 18 | Project cards stacked, bottom nav (Home/Proj/New/AI/Settings) |
| **Mobile 3D Viewer** | 18 | Full-width viewport, result buttons, member info, bottom nav |
| **Mobile Bottom Sheet** | 18 | 3 snap points, drag handle, tabs (Properties/Forces/Design) |
| **Mobile Action Sheet** | 18 | Replaces context menu, 6 actions + cancel |
| **Mobile Toast** | 18 | Top of screen, swipe up dismiss, 4s duration |

---

## 5. Backend Endpoints & Services

### 5.1 Implied API Endpoints (extracted from UI specs)

#### Authentication
| Method | Endpoint | Source |
|--------|----------|--------|
| POST | `/auth/sign-in` | 04 |
| POST | `/auth/sign-up` | 04 |
| POST | `/auth/forgot-password` | 04 |
| POST | `/auth/reset-password` | 04 |
| POST | `/auth/verify-email` | 04 |
| GET | `/auth/oauth/:provider/callback` | 04 |
| POST | `/auth/session/refresh` | 22 |

#### Projects
| Method | Endpoint | Source |
|--------|----------|--------|
| GET | `/projects` | 05 |
| POST | `/projects` | 05 |
| GET | `/projects/:id` | 05, 06 |
| PUT | `/projects/:id` | 05 |
| DELETE | `/projects/:id` | 05 |
| POST | `/projects/:id/duplicate` | 05 |
| POST | `/projects/import` | 05 |
| GET | `/projects/:id/export/:format` | 13 |
| POST | `/projects/:id/auto-save` | 22 |

#### Structural Model
| Method | Endpoint | Source |
|--------|----------|--------|
| POST | `/projects/:id/nodes` | 07 |
| PUT | `/projects/:id/nodes/:nodeId` | 07 |
| DELETE | `/projects/:id/nodes/:nodeId` | 07 |
| POST | `/projects/:id/members` | 07 |
| PUT | `/projects/:id/members/:memberId` | 07 |
| DELETE | `/projects/:id/members/:memberId` | 07 |
| POST | `/projects/:id/plates` | 07 |
| POST | `/projects/:id/grid-generate` | 07 |
| POST | `/projects/:id/structure-wizard` | 07 |

#### Sections & Materials
| Method | Endpoint | Source |
|--------|----------|--------|
| GET | `/sections` | 08 |
| GET | `/sections/:id` | 08 |
| POST | `/sections/custom` | 08 |
| GET | `/materials` | 08 |
| POST | `/projects/:id/assign-section` | 08 |
| POST | `/projects/:id/assign-support` | 08 |
| POST | `/projects/:id/member-release` | 08 |

#### Loading
| Method | Endpoint | Source |
|--------|----------|--------|
| POST | `/projects/:id/load-cases` | 09 |
| PUT | `/projects/:id/load-cases/:lcId` | 09 |
| DELETE | `/projects/:id/load-cases/:lcId` | 09 |
| POST | `/projects/:id/loads` | 09 |
| PUT | `/projects/:id/loads/:loadId` | 09 |
| POST | `/projects/:id/load-combinations/generate` | 09 |
| POST | `/projects/:id/seismic-load/generate` | 09 |
| POST | `/projects/:id/wind-load/generate` | 09 |
| POST | `/projects/:id/moving-load/generate` | 09 |

#### Analysis
| Method | Endpoint | Source |
|--------|----------|--------|
| POST | `/projects/:id/analyze` | 10 |
| GET | `/projects/:id/analysis-status` | 10 |
| POST | `/projects/:id/analyze/cancel` | 10 |
| GET | `/projects/:id/results` | 11 |
| GET | `/projects/:id/results/:lcId` | 11 |
| POST | `/projects/:id/pre-check` | 10 |

#### Design
| Method | Endpoint | Source |
|--------|----------|--------|
| POST | `/projects/:id/design/steel` | 12 |
| POST | `/projects/:id/design/rc` | 12 |
| POST | `/projects/:id/design/connection` | 12 |
| POST | `/projects/:id/design/foundation` | 12 |
| GET | `/projects/:id/design/results` | 12 |

#### AI / Automation
| Method | Endpoint | Source |
|--------|----------|--------|
| POST | `/ai/chat` | 14 |
| POST | `/ai/generate-structure` | 14 |
| POST | `/ai/compliance-check` | 14 |
| POST | `/ai/optimize-sections` | 14 |
| POST | `/ai/voice-command` | 14 |
| POST | `/ai/interpret-sketch` | 14 |

#### Reporting
| Method | Endpoint | Source |
|--------|----------|--------|
| POST | `/projects/:id/report/generate` | 13 |
| GET | `/projects/:id/report/preview` | 13 |
| GET | `/projects/:id/export/pdf` | 13 |
| GET | `/projects/:id/export/dxf` | 13 |
| GET | `/projects/:id/export/ifc` | 13 |
| GET | `/projects/:id/export/excel` | 13 |

#### BIM
| Method | Endpoint | Source |
|--------|----------|--------|
| POST | `/bim/import/ifc` | 15 |
| POST | `/bim/export/ifc` | 15 |
| POST | `/bim/import/staad` | 15 |
| POST | `/bim/sync/revit` | 15 |
| GET | `/bim/sync/revit/status` | 15 |

#### Collaboration
| Method | Endpoint | Source |
|--------|----------|--------|
| POST | `/projects/:id/share` | 16 |
| GET | `/projects/:id/collaborators` | 16 |
| POST | `/projects/:id/comments` | 16 |
| GET | `/projects/:id/versions` | 16 |
| POST | `/projects/:id/versions/:vId/restore` | 16 |
| GET | `/projects/:id/activity` | 16 |

#### User / Settings
| Method | Endpoint | Source |
|--------|----------|--------|
| GET | `/user/profile` | 17 |
| PUT | `/user/profile` | 17 |
| PUT | `/user/preferences` | 17 |
| GET | `/user/subscription` | 17 |
| GET | `/user/notifications` | 05 |
| PUT | `/user/shortcuts` | 17 |

#### Templates
| Method | Endpoint | Source |
|--------|----------|--------|
| GET | `/templates` | 05, 20 |
| GET | `/templates/:id` | 20 |
| POST | `/templates/upload` | 20 |

#### Advanced
| Method | Endpoint | Source |
|--------|----------|--------|
| POST | `/projects/:id/boq` | 20 |
| POST | `/projects/:id/bbs` | 20 |
| POST | `/projects/:id/cost-estimate` | 20 |
| POST | `/projects/:id/batch-run` | 20 |
| POST | `/projects/:id/parametric/generate` | 20 |

#### Digital Twin
| Method | Endpoint | Source |
|--------|----------|--------|
| GET | `/digital-twin/:projectId/sensors` | 20 |
| GET | `/digital-twin/:projectId/health` | 20 |
| GET | `/digital-twin/:projectId/alerts` | 20 |

### 5.2 WebSocket Events (implied)

| Event | Direction | Source |
|-------|-----------|--------|
| `analysis:progress` | Server → Client | 10 |
| `analysis:complete` | Server → Client | 10 |
| `analysis:error` | Server → Client | 10 |
| `collaboration:cursor-move` | Bidirectional | 16 |
| `collaboration:element-lock` | Bidirectional | 16 |
| `collaboration:update` | Server → Client | 16 |
| `comment:new` | Server → Client | 16 |
| `notification:push` | Server → Client | 05 |
| `sensor:data` | Server → Client | 20 |
| `auto-save:sync` | Client → Server | 22 |
| `revit:sync-status` | Server → Client | 15 |

### 5.3 Services / Engines

| Service | Technology | Source |
|---------|------------|--------|
| **Solver Engine** | Rust/WASM (primary), JS fallback, Python backend | 10 |
| **AI Engine** | Gemini 2.0 Pro API | 14 |
| **Auth Provider** | Clerk (Google/GitHub/LinkedIn OAuth) | 04 |
| **Database** | MongoDB Atlas | 00 |
| **Cloud** | Azure | 00 |
| **File Storage** | Azure Blob (projects, thumbnails, reports) | 13 |
| **PDF Generation** | pdfmake/jsPDF (client-side) | 13, 22 |
| **IFC Parser** | Client-side chunk (80KB) | 15, 22 |
| **Section Database** | 10,000+ entries, cached in IndexedDB | 08, 22 |

---

## 6. Animations & Micro-Interactions

### 6.1 Global Animation Tokens

*(See Section 2.8 above for full duration + easing tables)*

**Reduced Motion:** All animations collapse to `0.01ms` when `prefers-reduced-motion: reduce` is active. Functional animations (spinners, progress) kept in simplified form.

### 6.2 Component Animations

| Component | Trigger | Animation | Duration | Easing |
|-----------|---------|-----------|----------|--------|
| Button hover | mouseenter | bg color shift, translateY −1px, shadow md | 150ms | ease-out |
| Button press | mousedown | scale 0.98, translateY 0 | 75ms | ease-in |
| Button loading | loading state | spinner 16px rotate 360° | 750ms | linear infinite |
| Icon button hover | mouseenter | icon rotate 15° (gear/settings) | 150ms | ease-out |
| Input focus | focus | border 1px→2px blue, ring glow 3px, label float up | 200ms | ease-out |
| Input error | validation | shake ±4px (5 cycles) + border red | 300ms | ease-in-out |
| Numeric scrub | click+drag | value live update, col-resize cursor | 0ms | — |
| Checkbox toggle | click | check draws via stroke-dashoffset | 200ms | ease-out |
| Switch toggle | click | thumb slides, bg color fills | 200ms | ease-spring |
| Slider drag | drag | thumb follows, track fills | 0ms (live) | — |
| Dropdown open | click | chevron rotate 180°, list scaleY 0→1 from top, items stagger (30ms each) | 200ms | ease-out |
| Dropdown item hover | mouseenter | bg slate-700, 2px blue left border | 150ms | — |
| Dropdown selection | click | ✓ checkmark fade in, close reverse | 150ms | ease-in |
| Tooltip show | hover+800ms | opacity 0→1, translateY 4→0 | 150ms | ease-out |
| Tooltip hide | mouseleave | opacity 1→0 | 100ms | ease-in |
| Accordion open | click | height 0→auto, chevron rotate 180° | 250ms | ease-in-out |
| Accordion close | click | height auto→0, chevron rotate 0° | 200ms | ease-in-out |
| Badge count change | value update | scale 1→1.3→1, bg flash | 300ms | ease-spring |
| Command palette open | Ctrl+K | scaleY 0.95→1, opacity, backdrop | 200ms | ease-out |
| MiniMap highlight | hover | region outline pulse | 1000ms | linear infinite |
| Copy confirmation | click copy | icon → checkmark → icon | 1500ms | step |
| Confetti | milestone | 40 particles, gravity, fade | 2000ms | physics-based |

### 6.3 Dialog / Modal Animations

| Phase | Property | Values | Duration | Easing |
|-------|----------|--------|----------|--------|
| **Open: Backdrop** | opacity | 0 → 0.5 | 200ms | ease-out |
| **Open: Dialog** | scale, opacity, translateY | 0.95→1, 0→1, 10→0 | 250ms (50ms delay) | ease-spring |
| **Close: Dialog** | scale, opacity | 1→0.95, 1→0 | 150ms | ease-in |
| **Close: Backdrop** | opacity | 0.5 → 0 | 150ms (50ms delay) | ease-out |

### 6.4 Sidebar / Panel Animations

| Panel | Animation | Duration | Easing |
|-------|-----------|----------|--------|
| Left sidebar collapse | width 280→48px, labels opacity 1→0 (first 150ms) | 300ms | ease-in-out |
| Left sidebar expand | width 48→280px, labels opacity 0→1 (last 150ms) | 300ms | ease-in-out |
| Right panel slide in | translateX 100%→0 | 250ms | ease-out |
| Right panel slide out | translateX 0→100% | 200ms | ease-in |
| Panel resize drag handle hover | bg transparent→blue-500/30, col-resize cursor | instant | — |
| Snap feedback | blue flash on handle | ~100ms | — |

### 6.5 Tab Transitions

| Element | Animation | Duration | Easing |
|---------|-----------|----------|--------|
| Active indicator (underline) | Slides horizontally to new tab, width morphs | 250ms | ease-in-out |
| Tab content outgoing | opacity 1→0 | 100ms | — |
| Tab content incoming | opacity 0→1, translateX ±8px | 150ms (50ms delay) | ease-out |
| Active label color | slate-400 → white, weight 500→600 | 150ms | — |
| Sub-tab pill bg | slides behind active tab | 200ms | ease-spring |

### 6.6 Toast / Notification Animations

| Phase | Property | Values | Duration | Easing |
|-------|----------|--------|----------|--------|
| Enter | translateY, opacity, scale | 100%→0, 0→1, 0.9→1 | 350ms | ease-spring |
| Auto-dismiss bar | width | 100%→0% | 5000ms | linear |
| Dismiss (swipe) | translateX, opacity | 0→100%, 1→0 | 200ms | ease-in |
| Auto-dismiss (timeout) | opacity, translateY | 1→0, 0→−10px | 300ms | — |
| Stack push | translateY (existing) | shift up (height+8px) | 200ms | ease-out |

### 6.7 Context Menu

| Phase | Property | Values | Duration | Easing |
|-------|----------|--------|----------|--------|
| Enter | scale, opacity | 0.9→1, 0→1 | 150ms | ease-out |
| Item stagger | translateY, opacity | −4→0, 0→1 (30ms between items) | 150ms | — |
| Item hover | bg | →blue-500/20 | 150ms | — |
| Submenu enter | slide from parent left edge | 150ms (200ms delay) | — |
| Exit | scale, opacity | 1→0.95, 1→0 | 100ms | — |

### 6.8 Loading & Progress Animations

| Animation | Spec | Duration | Details |
|-----------|------|----------|---------|
| **Skeleton shimmer** | 21 | 1.5s infinite | linear-gradient 400% bg-size, position 100%→0% |
| **Skeleton → content** | 21 | 150+250ms | Skeleton fade out, real content fade in, 100ms overlap |
| **Analysis progress ring** | 21 | 2s infinite | Rotating ring + percentage counter |
| **Step checkmark** | 21 | 300ms ease-out | stroke-dasharray animate, color → green-500 |
| **Indeterminate progress** | 21 | 1.5s×2 | Two gradient bars sliding opposite directions |
| **Analysis progress bar** | 10 | live | Gradient blue→purple fill proportional to % |

### 6.9 3D Viewport Interactions

| Interaction | Animation | Duration | Details |
|-------------|-----------|----------|---------|
| Orbit (middle drag) | Camera rotation | live | Inertia: 0.95 damping, stops < 0.001 velocity |
| Pan (Shift+middle) | 1:1 movement | live | No inertia |
| Zoom (scroll) | Smooth toward cursor | 200ms ease-out | 1.1× per tick, min 0.01, max 1000 |
| Fit All (F key) | Camera encompasses all | 600ms | ease-in-out, maintain orientation |
| ViewCube click | Quaternion slerp | 500ms | ease-in-out |
| Member hover | Line 2→4px, color→yellow, glow 4px | instant | Info popup after 500ms |
| Node hover | Circle 6→10px, color→cyan, ring pulse | 150ms | Radiating ring fade |
| Selection click | Color→blue, ring pulse 400ms fade | instant | Properties panel slide update |
| Box selection | Dashed blue rect, blue-500/10 fill | live | Enclosed elements highlight on release |
| Node creation pop | scale 0→1.2→1 + 6-particle burst | 200ms + 300ms | ease-spring + fade |
| Member confirm | Line glow | 200ms | — |
| Deformed morph | Displacement 0→1 interpolation | 800ms | ease-in-out |
| BMD/SFD reveal | Diagrams draw start→end | 600ms/member | 30ms stagger, fill 0→0.3 |
| Stress contour flood | Color fill across elements | 500ms | Legend fade simultaneous |
| Mode shape oscillation | Sinusoidal ±φ | 2000ms period | smooth, scale via slider |

### 6.10 Page / Route Transitions

| Transition | Animation | Duration | Easing |
|------------|-----------|----------|--------|
| Landing → Dashboard | Crossfade + zoom: out 1→1.02, in 0.98→1 | 400ms each (100ms gap) | ease-in-out |
| Dashboard → Workspace | Card expands to fill (FLIP), content crossfade | 500ms (200+300ms) | ease-in-out |
| Workspace → Dashboard | Reverse: workspace shrinks to card | 400ms | ease-in-out |
| Settings inter-page | Slide left/right based on sidebar direction | 250ms | ease-out |
| Fallback route change | Crossfade: out 150ms, in 250ms (100ms delay) | 400ms total | — |

### 6.11 Drag & Drop Interactions

| Phase | Animation | Duration | Details |
|-------|-----------|----------|---------|
| Pickup (section assign) | Source opacity 0.5, ghost follows cursor (8px offset, 2° rotation), shadow-lg | instant | — |
| Over valid target | Member highlights green, ghost green border glow | instant | — |
| Over invalid target | Ghost red border, 🚫 cursor | instant | — |
| Drop | Ghost snaps to member (scale 1→0), member flash green, toast | 200ms ease-out, 300ms flash | — |
| Cancel | Ghost returns to origin | 300ms | ease-spring |
| Dashboard card reorder | Card lifts (shadow-xl, scale 1.02), others shift | 200ms | ease-spring, FLIP |
| Load value drag | Arrow tip drag, value label live update, snap to 0.5kN | live | — |

### 6.12 Landing Page Animations

| Element | Animation | Details |
|---------|-----------|---------|
| Gradient blobs (hero) | Slow rotation, scale pulse | Continuous, subtle |
| Gradient text | Background-size animate | shimmer |
| Stats counters | Count-up from 0 | On scroll intersect |
| Feature cards | Stagger fade-in on scroll | 100ms between cards |
| Shimmer CTA button | Background gradient slide | Continuous loop |
| Trust bar logos | Grayscale → color on hover | 200ms |
| Testimonial carousel | Auto-cycle with dots | ~5s interval |
| Interactive demo tabs | Auto-cycle + manual | ~8s interval |
| Hero 3D preview | Slow orbit / auto-rotate | Continuous |
| Scroll indicator | Bounce animation | Continuous until scroll |

### 6.13 Auth Screen Animations

| Element | Animation | Details |
|---------|-----------|---------|
| Brand panel illustration | Subtle float/parallax | Continuous |
| Password strength meter | Width animate + color | 200ms per segment |
| Success verification | successPop scale animation | 400ms ease-spring |
| OAuth button loading | Spinner replace icon | 750ms rotate |

---

## 7. Keyboard Shortcuts

### 7.1 Global Shortcuts

| Action | Shortcut |
|--------|----------|
| Command palette | `Ctrl+K` |
| Open help | `F1` |
| Undo | `Ctrl+Z` |
| Redo | `Ctrl+Shift+Z` or `Ctrl+Y` |
| Save | `Ctrl+S` |
| New project | `Ctrl+N` |
| Open project | `Ctrl+O` |
| Close dialog | `Escape` |
| Confirm | `Enter` |
| Search | `Ctrl+F` |
| Theme toggle | — |

### 7.2 Modeling Shortcuts

| Action | Shortcut |
|--------|----------|
| Node mode | `N` |
| Member mode | `M` |
| Grid generator | `Ctrl+G` |
| Select all | `Ctrl+A` |
| Delete selected | `Delete` |
| Copy | `Ctrl+C` |
| Paste | `Ctrl+V` |
| Move | `Ctrl+M` |
| Mirror | `Ctrl+Shift+M` |
| Rotate | `Ctrl+R` |
| Duplicate | `Ctrl+D` |
| Measure | `Shift+M` |

### 7.3 View Shortcuts

| Action | Shortcut |
|--------|----------|
| Zoom in | `+` or `Ctrl+=` |
| Zoom out | `−` or `Ctrl+−` |
| Fit all | `F` |
| Top view | `Numpad 7` |
| Front view | `Numpad 1` |
| Right view | `Numpad 3` |
| Isometric | `Numpad 0` |
| Wireframe toggle | `W` |
| Toggle grid | `G` |
| Toggle properties | `P` |
| Toggle sidebar | `B` |
| Toggle snap | `S` |

### 7.4 Analysis / Results

| Action | Shortcut |
|--------|----------|
| Run analysis | `Ctrl+Enter` or `F5` |
| Previous load case | `Ctrl+←` |
| Next load case | `Ctrl+→` |
| Show BMD | `1` |
| Show SFD | `2` |
| Show AFD | `3` |
| Show deformed | `4` |
| Reset results | `5` |

### 7.5 Advanced

| Action | Shortcut |
|--------|----------|
| Voice command | `Ctrl+Shift+Space` |
| AI chat | `Ctrl+J` |
| Script editor | `Ctrl+Shift+E` |
| Performance monitor | `Ctrl+Shift+P` (dev only) |

### 7.6 Mobile Gestures

| Gesture | Action |
|---------|--------|
| Single tap | Select nearest node/member |
| Double tap | Zoom to selected / fit all |
| Long press (500ms) | Context menu (action sheet) |
| 1-finger drag | Orbit |
| 2-finger drag | Pan |
| Pinch | Zoom |
| 3-finger tap | Undo |
| 2-finger tap | Redo |
| Swipe from left | Open navigation drawer |
| Swipe from right | Open properties sheet |
| Force Touch peek | Preview properties |
| Force Touch pop | Full property view |

---

## 8. Accessibility (WCAG)

### 8.1 Color Contrast (WCAG 2.1 AA)

| Element | Contrast | Level |
|---------|----------|-------|
| Body text (slate-200 on slate-900) | 12.6:1 | AAA ✓ |
| Secondary text | 5.6:1 | AA ✓ |
| Primary button | 4.6:1 | AA ✓ |
| Destructive button | 4.5:1 | AA ✓ |
| Link text | 7.1:1 | AAA ✓ |
| Placeholder text | 4.6:1 | AA ✓ |
| Error text | 6.1:1 | AA ✓ |
| Warning text | 11.5:1 | AAA ✓ |
| Success text | 7.4:1 | AAA ✓ |
| Focus ring (non-text) | 3.1:1 | AA ✓ |
| Disabled text | 2.2:1 | Exempt ✓ |

### 8.2 Non-Color Encoding

- All statuses: **color + icon + text** (triple indicator)
- Utilization ratios: **color + pattern (hatch) + "FAIL" text**
- Load types: **color + unique arrow/symbol shape**
- Color-blind palettes: Viridis, Magma, Cividis, Grayscale
- UR overlay: **color + line thickness variation + dashed pattern**

### 8.3 Keyboard Navigation

- Skip-to-main link (visible on focus)
- Logical tab order: Header → Ribbon → Sidebar → Viewport → Properties → Status
- Focus ring: 2px blue-400, 2px offset, always visible
- Focus trap in modals
- Arrow key navigation in trees, tabs, dropdowns
- Type-ahead in dropdowns
- Viewport keyboard nav: Arrow keys pan, +/- zoom, N/M for modes

### 8.4 ARIA Landmarks

- `role="banner"` — header
- `role="navigation"` — main nav
- `role="tablist"` / `role="tab"` / `role="tabpanel"` — ribbon
- `role="toolbar"` — tool buttons
- `role="tree"` / `role="treeitem"` — model explorer
- `role="application"` — 3D canvas
- `role="complementary"` — sidebars, properties
- `role="contentinfo"` — status bar
- `aria-live="polite"` — analysis status
- `aria-live="assertive"` — error alerts
- `role="alert"` — toasts
- `role="progressbar"` — analysis progress

### 8.5 Focus Management

- **Dialog open:** save trigger ref → focus first element → trap Tab
- **Dialog close:** return focus to saved element
- **After deletion:** focus next element in list
- **After creation:** focus properties panel
- **After analysis:** focus results summary
- **Viewport focused:** Tab exits to next landmark

### 8.6 Reduced Motion

- **Replaced:** hover effects, dialog animations, sidebar, tab transitions, toasts, shimmer
- **Kept (simplified):** spinners (simple rotate), loading (opacity pulse)
- **Disabled:** mode shape animation, earthquake playback, node particles
- **User override in Settings:** System / Full / Reduced / None

### 8.7 Text Sizing

- All text in rem/em, never px
- Min interactive target: 24×24 (WCAG), recommended 44×44
- 200% zoom: layout reflows, no horizontal scroll
- 400% zoom: mobile layout triggers, viewport functional
- App font size setting: Small (14) / Default (16) / Large (18) / X-Large (20)

---

## 9. Performance Budgets

### 9.1 Initial Load

| Metric | Budget | Target |
|--------|--------|--------|
| FCP | < 1.5s | 1.2s |
| LCP | < 2.5s | 2.0s |
| TTI | < 3.5s | 3.0s |
| CLS | < 0.1 | 0.05 |
| FID | < 100ms | 50ms |
| Total bundle (gzipped) | < 500KB | ~420KB |
| WASM solver | < 2MB | ~1.5MB |
| Critical CSS | < 15KB | ~10KB |

### 9.2 Runtime

| Metric | Budget |
|--------|--------|
| 3D viewport | ≥ 30fps (target 60fps) |
| UI interaction | < 100ms |
| Analysis start | < 200ms |
| Property panel update | < 50ms |
| Undo/Redo | < 100ms |
| Auto-save | < 500ms (non-blocking) |
| Search results | < 200ms |
| Tree expand | < 100ms |

### 9.3 Model Size Targets

| Size | Members | FPS | Analysis Time |
|------|---------|-----|---------------|
| Small | < 100 | 60 | < 0.5s |
| Medium | 100–1,000 | 60 | < 3s |
| Large | 1K–10K | 30 | < 30s |
| Very Large | 10K–50K | 30 | < 120s |
| Massive | > 50K | 15 (LOD) | chunked |

### 9.4 Code Splitting (10 chunks)

| Chunk | Content | Target Size |
|-------|---------|-------------|
| Shell | React, Router, Zustand, Auth, Layout | ~120KB |
| Landing | Marketing, Framer Motion, hero | ~80KB |
| Dashboard | Project cards, templates, import | ~60KB |
| Workspace | Three.js, R3F, viewport, toolbar | ~200KB |
| WASM Solver | Rust solver, sparse ops | ~1.5MB |
| Design | Steel/RC/connection design | ~100KB |
| Reporting | PDF gen, chart rendering | ~150KB |
| AI | Chat, generative, optimizer | ~50KB |
| BIM | IFC parser, Revit sync | ~80KB |
| Settings | Settings, subscription | ~30KB |

### 9.5 Virtualization

- Section database (10K+ entries): `react-window`, 36px rows, 10 overscan
- Model explorer tree: virtualized for 500+ items
- Data tables: virtualized rows + columns, 100/page or infinite scroll
- 3D LOD: <1K full geometry → 1K-5K simplified → >5K lines only → >20K instanced+culled

### 9.6 Caching Strategy

- **Service Worker (PWA):** Cache-first for static, network-first for API, stale-while-revalidate for databases
- **IndexedDB:** Auto-save (30s), WASM binary, section DB, undo history (100 steps)
- **localStorage:** Preferences, layout state, last project ID, onboarding
- **sessionStorage:** Temp analysis results, clipboard
- **API SWR:** Sections 24h, materials 24h, templates 1h, project 5min, analyze never

---

## 10. Responsive / Mobile

### 10.1 Breakpoints

| Name | Width | Experience |
|------|-------|------------|
| Desktop XL | 1920×1080 | Full workspace |
| Desktop | 1440×900 | Full workspace |
| Laptop | 1280×800 | Compact, collapsible panels |
| Tablet Landscape | 1024×768 | Simplified, bottom sheets |
| Tablet Portrait | 768×1024 | Simplified |
| Mobile | 390×844 | Viewer + limited editing |
| Mobile SM | 375×812 | Viewer + limited editing |

### 10.2 Tablet Adaptations

- Sidebar behind hamburger ☰
- Properties: slide-in from right (240px)
- Toolbar: single horizontal scrollable row
- Dialogs: bottom sheets instead of centered modals
- Touch: double-tap select, long-press context menu

### 10.3 Mobile Features

- **Dashboard:** Project cards stacked, 5-icon bottom nav (Home/Proj/New/AI/Settings)
- **3D Viewer:** Full-width viewport, result buttons below, member info summary, 5-icon bottom nav (Home/View/Results/Report/Chat)
- **Bottom Sheet:** 3 snap points (Peek 100px / Half 50% / Full 90%), drag handle 40×4px
- **Action Sheet:** Replaces context menu, full-width bottom, cancel button
- **Toast:** Top of screen, 4s duration, swipe up dismiss

---

## 11. i18n & Security UX

### 11.1 Internationalization

**Phase 1 (Launch):** English (default) + Hindi  
**Phase 2:** Tamil, Telugu, Kannada, Marathi, Spanish, Portuguese  
**Phase 3:** German, French, Japanese, Arabic (RTL)

**Design rules:**
- All strings in JSON locale files
- 40% expansion buffer for labels
- Locale-aware number formatting (1,00,000 for Indian English)
- Engineering symbols (kN, MPa, mm) never translated
- IS code references kept in English

### 11.2 Security UX

- **Session timeout:** Warning at 25min inactivity, 5min countdown, "Stay Signed In" / "Sign Out"
- **Share permissions:** 🔓 Public / 🔒 Private / 🔑 Password-protected visually indicated
- **Export confirmation:** Dialog before sensitive data export
- **Crash recovery:** Auto-saved version restore dialog with timestamp + change count

### 11.3 Error Handling UX

- **Network error:** Offline mode banner, local save, retry button
- **Analysis error:** Singular matrix diagnosis with 3 likely causes + highlight/fix links + "Auto-Fix Supports"
- **Crash recovery:** "Restore Auto-Save" / "Open Last Manual Save" / "Start Fresh"
- **404 page:** Illustration + "Go to Dashboard" + "Contact Support"

### 11.4 Performance Monitor (Dev/Admin)

- Toggle: `Ctrl+Shift+P`
- Displays: FPS, draw time, heap, node count, GPU %
- FPS history (60s sparkline)
- Memory breakdown (Three.js/Textures/State/WASM/Workers)
- Render pipeline timing
- Bottom-left, semi-transparent, hidden in production

---

## Summary Statistics

| Category | Count |
|----------|-------|
| Spec files | 23 |
| Design tokens (colors) | ~80+ unique hex values |
| Typography entries | 22 |
| Spacing tokens | 16 |
| UI components (core) | 24 |
| Engineering components | 19 |
| Layout components | 10 |
| Total pages/screens | ~100+ unique views |
| API endpoints (implied) | ~80+ |
| WebSocket events | 11 |
| Keyboard shortcuts | 40+ |
| Mobile gestures | 12 |
| Animations/micro-interactions | 50+ unique |
| Responsive breakpoints | 7 |
| Code-splitting chunks | 10 |
| Languages planned | 12 |
| Named animation keyframes | 11 |
| Easing functions | 6 |
| Duration tokens | 7 |

---

*End of audit. Generated from complete reading of all 23 Figma specification documents.*
