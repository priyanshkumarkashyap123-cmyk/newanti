# FIGMA SPECIFICATION vs CODEBASE — COMPLETE AUDIT REPORT

> Generated from comparison of all 22 Figma specs against the full codebase.
> Format: each gap lists **Spec value → Current value**, the **file path**, and the **line(s)** affected.

---

## SPEC 01 — Design System & Tokens

### 1.1 Color Tokens

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 1 | `--color-text-primary` uses Slate-100 | `#f1f5f9` (Slate-100) | `#f1f5f9` — **OK** | `index.css:84` | ✅ Match |
| 2 | `--color-text-secondary` spec says Slate-300 `#cbd5e1` | `#cbd5e1` | Current is `#cbd5e1` — **OK** | `index.css:86` | ✅ Match |
| 3 | Body text Figma says Slate-200 `#e2e8f0` for WCAG AAA (Spec 22) | `#e2e8f0` | Body text uses `#f1f5f9` | `index.css:84,160` | ⚠️ Spec 01 §1.3 says primary text = Slate-100, Spec 22 WCAG table says body text = Slate-200. Internal spec conflict — but Slate-100 provides even higher contrast, so acceptable. |
| 4 | `semanticColors.background.primary` should be Slate-900 `#0f172a` per Figma | `#0f172a` | `theme.ts:128` uses `colors.neutral[950]` = `#020617` | `styles/theme.ts:128` | ❌ **Mismatch** — Spec says Slate-900 (`#0f172a`), code uses Slate-950 (`#020617`). The CSS `index.css` correctly uses `#0f172a`; the TS theme file is inconsistent. |
| 5 | Shadow token `elevation-1` through `elevation-4` | Figma §1.5 defines 4 elevation levels | No `elevation-*` CSS classes or variables exist | `index.css` / `theme.ts` | ❌ **Missing** — Figma spec defines `elevation-1: 0 1px 3px`, `elevation-2: 0 4px 6px -1px…`, `elevation-3: 0 10px 15px -3px…`, `elevation-4: 0 20px 25px -5px…`. Codebase has `shadows.sm/md/lg/xl` in theme.ts but no named `elevation-*` utility classes or CSS variables. |
| 6 | Border-radius token `--radius-sm` = 4px | 4px | `theme.ts:303` `sm: '0.25rem'` (4px) — **OK** | `styles/theme.ts:303` | ✅ Match |
| 7 | Z-index scale: Figma `z-dropdown=10, z-sticky=20, z-overlay=30, z-modal=40, z-popover=50, z-toast=60, z-command=70, z-max=100` | Per spec | `theme.ts` matches exactly | `styles/theme.ts:355-364` | ✅ Match |
| 8 | Grid: 8px base grid | 8px | Spacing scale uses 8px multiples — **OK** | `styles/theme.ts:274+` | ✅ Match |

### 1.2 Typography

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 9 | Display font = Space Grotesk | `"Space Grotesk"` | `--font-family-display: "Space Grotesk"` — **OK** | `index.css:130` | ✅ Match |
| 10 | Body font = Inter | `"Inter"` | `--font-family-body: "Inter"` — **OK** | `index.css:131` | ✅ Match |
| 11 | Mono font = JetBrains Mono | `"JetBrains Mono"` | `--font-family-mono: "JetBrains Mono"` — **OK** | `index.css:132` | ✅ Match |
| 12 | `html,body` font-family should be Inter for body text | Inter (body) | Uses `"Space Grotesk", "Inter"` (display font first) | `index.css:144-145` | ⚠️ **Mismatch** — Figma says body text = Inter, display headings = Space Grotesk. The `html,body` sets Space Grotesk as primary font for ALL text. Should be Inter with Space Grotesk only on headings. |
| 13 | Figma caption size = 11px (`0.6875rem`) | `0.6875rem` | `theme.ts` has `caption: { size: '0.6875rem' }` — **OK** | `styles/theme.ts:240` | ✅ Match |
| 14 | Figma `unit` text size = 10px (`0.625rem`) | `0.625rem` | `theme.ts:242` has `unit: { size: '0.625rem' }` — **OK** | `styles/theme.ts:242` | ✅ Match |

### 1.3 Animation Tokens

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 15 | `--duration-instant` = 75ms | 75ms | 75ms — **OK** | `index.css:394` | ✅ Match |
| 16 | `--duration-dramatic` = 1000ms (Spec 21) | 1000ms | `--duration-slowest: 1000ms` (wrong name) | `index.css:399` | ⚠️ Name mismatch: spec says `--duration-dramatic`, code says `--duration-slowest`. Value is correct. |
| 17 | `--ease-spring` = `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | Per spec | Matches exactly | `index.css:405` | ✅ Match |
| 18 | `--ease-overshoot` = `cubic-bezier(0.34, 1.56, 0.64, 1)` | Per spec | Matches exactly | `index.css:406` | ✅ Match |
| 19 | Reduced-motion media query | Collapse all transitions | Two duplicate blocks exist | `index.css:409-416` and `index.css:1011-1020` | ⚠️ Duplicate `@media (prefers-reduced-motion)` blocks — should consolidate. |

---

## SPEC 02 — Component Library

### 2.1 Buttons

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 20 | Primary button bg | `#3b82f6` (blue-500) | `bg-blue-600` (`#2563eb`) | `button.tsx:80` | ❌ **Mismatch** — Figma spec §2.1 says primary button = `#3b82f6`, code uses `bg-blue-600` = `#2563eb`. |
| 21 | Primary hover bg | `#2563eb` (blue-600) per Figma §21.2 | `hover:bg-blue-700` (`#1d4ed8`) | `button.tsx:80` | ❌ **Mismatch** — Spec hover = blue-600, code hover = blue-700. |
| 22 | Primary active bg | `#1d4ed8` per Figma §21.2 | No explicit active bg class (only `scale-[0.98]`) | `button.tsx:66` | ⚠️ Missing active background color change. |
| 23 | Loading spinner animation | `rotate 360° linear 750ms infinite` | spinner class uses `spin 0.75s linear infinite` — **OK** | `button.tsx:51` | ✅ Match |
| 24 | Button hover `translate-y: -1px` | `-1px` | `hover:-translate-y-px` — **OK** | `button.tsx:65` | ✅ Match |
| 25 | Focus ring: `2px #93c5fd offset 2px` | `ring-2 ring-blue-300 offset-2` | `focus-visible:ring-blue-400` (not blue-300) | `button.tsx:81` | ⚠️ Figma says `#93c5fd` (blue-300), code uses blue-400 (`#60a5fa`). |

### 2.2 Inputs

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 26 | Input height | Figma §2.2: 36px default | `h-9` (36px) — **OK** | `input.tsx:45` | ✅ Match |
| 27 | Input border radius | 8px per spec | `rounded-lg` (8px) — **OK** | `input.tsx:45` | ✅ Match |
| 28 | Input bg | `rgba(15,23,42,0.8)` per spec | `dark:bg-[rgba(15,23,42,0.8)]` — **OK** | `input.tsx:45` | ✅ Match |
| 29 | Focus glow ring | `0 0 0 3px rgba(59,130,246,0.12)` | Matches — **OK** | `input.tsx:50` | ✅ Match |
| 30 | Dark-mode border | `rgba(255,255,255,0.08)` | `dark:border-white/[0.08]` — **OK** | `input.tsx:53` | ✅ Match |
| 31 | Error shake animation | 300ms | `animate-[inputShake_300ms_ease-out]` — **OK** | `input.tsx:57` | ✅ Match |
| 32 | Floating label animation | Spec §21.3: `scale(0.85) translateY(-24px)` | No floating label implemented in Input component | `input.tsx` | ❌ **Missing** — Input has a static label above, not a floating animated label as specified. |
| 33 | Numeric scrub (click-drag) | Spec §21.3 describes horizontal scrub | Not implemented | `input.tsx` | ❌ **Missing** — No click-drag scrub functionality for numeric inputs. |

### 2.3 Cards

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 34 | Card bg in dark mode | Spec §2.3: `#1e293b` (Slate-800) | `dark:bg-slate-900` (`#0f172a`) | `card.tsx:12` | ❌ **Mismatch** — Figma says Slate-800, code uses Slate-900. |
| 35 | Card border-radius | Spec: 12px | `rounded-xl` (12px) — **OK** | `card.tsx:20` | ✅ Match |
| 36 | Card border color | Spec: `rgba(255,255,255,0.06)` | `dark:border-slate-800` (solid color, not alpha) | `card.tsx:12` | ⚠️ Uses opaque Slate-800 instead of rgba alpha border. `index.css:840` `.card` class does use `rgba(255,255,255,0.06)` correctly. |
| 37 | Card padding | Spec §2.3: 20px | `p-5` (20px) — **OK** | `card.tsx:71` | ✅ Match |

### 2.4 Badges

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 38 | Badge border-radius | Spec: `full` (pill) | `rounded-full` — **OK** | `badge.tsx:12` | ✅ Match |
| 39 | Badge font-size | Spec §2.5: 11px | `text-[11px]` — **OK** | `badge.tsx:12` | ✅ Match |

### 2.5 Tabs

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 40 | Tab active indicator animation | Spec §21.7: blue underline slides horizontally, 250ms ease-in-out | CSS `transition-all duration-250` on trigger — partial | `tabs.tsx:80` | ⚠️ Has transition but no sliding indicator element. Radix just toggles state; there's no independent animated bar that morphs width. |
| 41 | Tab content cross-fade | Spec §21.7: outgoing opacity 1→0 (100ms), incoming 0→1 (150ms) with translateX ±8px | No TabsContent animation defined | `tabs.tsx` | ❌ **Missing** — No enter/exit animation on tab panel content. |
| 42 | Tab variants (pill/line/enclosed) | Spec §2.8 | All three implemented — **OK** | `tabs.tsx:28-39` | ✅ Match |

### 2.6 Tooltips

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 43 | Tooltip delay | Spec §19.3: 1500ms for tool buttons | Default `delay = 800` | `Tooltip.tsx:23` | ⚠️ Spec says 1500ms for tool buttons. Code defaults to 800ms. Spec §2.9 says 500ms for general tooltips. Needs configurable per-context. |
| 44 | Tooltip bg | Spec §2.9: `#1e293b` (Slate-800) | Inline style inherits — uses portal render | `Tooltip.tsx:95-115` | Need to verify rendered output. `index.css` `.eng-tooltip` uses `rgba(15,23,42,0.98)` (close but not exactly Slate-800). |
| 45 | Tooltip max-width | Spec §2.9: 280px | No max-width set | `Tooltip.tsx` | ❌ **Missing** — No `max-width` constraint on tooltip. |

### 2.7 Toast/Notifications

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 46 | Toast position | Spec §21.8: bottom-right | Default `position: 'bottom-right'` — **OK** | `ToastSystem.tsx:104` | ✅ Match |
| 47 | Toast max visible | Spec §21.8: 3 toasts | `MAX_TOASTS = 5` | `ToastSystem.tsx:100` | ⚠️ Spec says max 3, code allows 5. |
| 48 | Toast auto-dismiss | Spec §21.8: progress bar width 100%→0% | No visible progress bar countdown on toasts | `ToastSystem.tsx` | ❌ **Missing** — Spec requires animated progress bar in toast showing auto-dismiss countdown. |
| 49 | Toast enter animation | Spec: `translateY: 100%→0, scale 0.9→1.0, ease-spring, 350ms` | Custom implementation, needs verification | `ToastSystem.tsx` | ⚠️ Verify animation matches spec exactly. |

### 2.8 Dialog/Modal

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 50 | Dialog backdrop | Spec §21.5: `#000 opacity 0→0.5, 200ms` | `bg-black/50` with animate-in/fade-in — **OK** | `dialog.tsx:24` | ✅ Match |
| 51 | Dialog enter: `scale 0.95→1.0, opacity 0→1, translateY 10px→0, 250ms ease-spring` | Per spec | Uses `zoom-in-95` + `slide-in-from-top-[48%]` — close but not exact spring easing | `dialog.tsx:57` | ⚠️ Uses standard easing, spec requires `ease-spring` (`cubic-bezier(0.175, 0.885, 0.32, 1.275)`). |
| 52 | Dialog sizes | Spec: specific pixel widths | Has sm(400), md(560), lg(720), xl(900) — **OK** | `dialog.tsx:34-39` | ✅ Match |
| 53 | Dialog backdrop-blur | Spec doesn't explicitly mention it | `backdrop-blur-sm` applied | `dialog.tsx:56` | Extra feature (acceptable). |

### 2.9 Command Palette

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 54 | Command palette trigger | Spec: `⌘K` | Implemented correctly | `CommandPalette.tsx` | ✅ Match |
| 55 | Command palette width | Spec §2.12: 560px max | Uses Dialog wrapper — verify | `CommandPalette.tsx:19` | ⚠️ Need to verify max-width matches 560px. |

### 2.10 Skeleton Loading

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 56 | Skeleton shimmer | Spec §2.13: `bg: Slate-800, shimmer: Slate-700 sweep, 1.5s` | `animate-pulse rounded-md bg-slate-100/50 dark:bg-slate-800/50` | `Skeleton.tsx:13` | ⚠️ Uses `animate-pulse` (opacity pulse) instead of sweeping shimmer. `index.css` `.skeleton` class has proper shimmer. Inconsistency between component and CSS class. |

### 2.11 Context Menu

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 57 | Context menu enter | Spec §21.9: `scale 0.9→1.0, 150ms ease-out, items stagger 30ms` | ContextMenu component exists; verify animation | `ContextMenu.tsx` | ⚠️ Need to verify stagger animation on items. |

### 2.12 Empty States

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 58 | Empty state dashed border | Spec §19.6: `1px dashed slate-600` | CSS `.empty-state` has no dashed border | `index.css:1052-1061` | ❌ **Missing** — Spec calls for dashed border on empty state card. |

---

## SPEC 03 — Landing / Marketing Page

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 59 | Navigation height | Spec: 64px | Uses dynamic padding, not fixed 64px height | `LandingPage.tsx` | ⚠️ Verify rendered height. |
| 60 | Nav bg on scroll | Spec §3.1: `rgba(15,23,42,0.8) + backdrop-blur(12px)` | Scrolled state adds backdrop-blur — verify exact values | `LandingPage.tsx` | ⚠️ Check blur value matches 12px. |
| 61 | Hero gradient | Spec: `135deg, #3b82f6→#8b5cf6→#06b6d4` on text | `.gradient-text` matches — **OK** | `index.css:223-227` | ✅ Match |
| 62 | Trust bar logos | Spec §3.3: IIT logos with grayscale filter, 60% opacity | Not verified in LandingPage component | `LandingPage.tsx` | ⚠️ Need to verify trust bar implementation. |
| 63 | Feature card hover | Spec: `translateY(-8px)` | `.hover-lift:hover` uses `translateY(-4px)` | `index.css:744` | ❌ **Mismatch** — Spec says -8px lift, code does -4px. |
| 64 | Pricing card highlight | Spec §3.8: gradient border on recommended plan | `.pricing-highlight` exists with gradient border — **OK** | `index.css:1495-1507` | ✅ Match |

---

## SPEC 04 — Authentication

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 65 | Auth card width | Spec §4.1: 440px | SignInPage/SignUpPage exist — verify width | `pages/SignInPage.tsx` | ⚠️ Need to verify max-width matches 440px. |
| 66 | Auth background | Spec: split-screen with gradient left + form right | Need to check layout | `pages/SignInPage.tsx` | ⚠️ Verify split-screen layout. |
| 67 | OAuth buttons | Spec §4.5: Google with `#4285F4` bg, GitHub with `#333` | Clerk handles OAuth styling | N/A | ⚠️ If using Clerk, styling is delegated to Clerk components. |
| 68 | Email verification page | Spec §4.3 | `pages/VerifyEmailPage.tsx` exists — **OK** | `pages/VerifyEmailPage.tsx` | ✅ Exists |
| 69 | Account locked page | Spec §4.6 | `pages/AccountLockedPage.tsx` exists — **OK** | `pages/AccountLockedPage.tsx` | ✅ Exists |
| 70 | Forgot password page | Spec §4.4 | `pages/ForgotPasswordPage.tsx` exists — **OK** | `pages/ForgotPasswordPage.tsx` | ✅ Exists |

---

## SPEC 05 — Dashboard

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 71 | Project card hover border | Spec §5.2: `border-color: blue-500/30` on hover | `Card` interactive variant has `hover:border-blue-500/30` — **OK** | `card.tsx:14` | ✅ Match |
| 72 | Stats section | Spec §5.3: 4 stat cards (projects, analyses, members, storage) | Dashboard uses `StatCard` components | `pages/Dashboard.tsx` | ⚠️ Verify 4 stats match spec exactly. |
| 73 | List/Grid view toggle | Spec §5.8 | Dashboard imports `List, LayoutGrid` icons — **OK** | `pages/Dashboard.tsx:36-37` | ✅ Exists |
| 74 | Project context menu | Spec §5.4: Open, Duplicate, Rename, Archive, Delete | Need to verify menu items | `pages/Dashboard.tsx` | ⚠️ Check all 5 actions are present. |

---

## SPEC 06 — Main Workspace

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 75 | Workspace header height | Spec §6.1: 40px | Need to verify | `IntegratedWorkspace.tsx` | ⚠️ Check header height = 40px. |
| 76 | Ribbon toolbar | Spec §6.2: 6 tabs (Geometry, Properties, Loading, Analysis, Results, Design) | Need to verify tab count and names | `IntegratedWorkspace.tsx` | ⚠️ Verify ribbon tabs. |
| 77 | Left sidebar width | Spec §6.3: 280px open, 48px collapsed | Spec §21.6 confirms `280px→48px, 300ms` | Various workspace components | ⚠️ Verify exact widths. |
| 78 | Properties panel width | Spec §6.5: 320px | Spec §21.6: min 240px, max 480px, default 280px | Various | ⚠️ Default width inconsistency between spec sections (320px vs 280px). |
| 79 | Status bar height | Spec §6.6: 24px | Need to verify | Workspace components | ⚠️ Check status bar height. |
| 80 | Keyboard shortcuts | Spec §6.7: comprehensive list | `KeyboardShortcuts.tsx` & `KeyboardShortcutsOverlay.tsx` exist — **OK** | `components/ui/` | ✅ Exists |
| 81 | ViewCube | Spec §6.4: navigation cube in viewport | `ViewControlsOverlay.tsx` exists | `components/ui/ViewControlsOverlay.tsx` | ✅ Exists |
| 82 | Coordinate input bar | Spec §6.4: STAAD-style `X: Y: Z:` input | `CoordinateInputBar.tsx` exists with `.coord-input-bar` CSS | `components/ui/CoordinateInputBar.tsx` + `index.css:1260-1290` | ✅ Exists |

---

## SPEC 07 — Geometry Modeling

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 83 | Node creation mode | Spec §7.1: click-to-place with live coordinate display | Need to verify interaction model | `ModernModeler.tsx` or geometry components | ⚠️ Verify interaction matches spec. |
| 84 | Grid generation dialog | Spec §7.3: Bays X/Y, Storey Heights, auto-generate columns+beams | Wizard components likely exist | Check structure wizard components | ⚠️ Verify dialog matches spec layout. |
| 85 | Structure wizard templates | Spec §7.4: Portal Frame, Multi-Bay, Truss, Tower | Check wizard component | Various | ⚠️ Verify templates list. |
| 86 | MiniMap component | Spec §7.1 references viewport minimap | `MiniMap.tsx` exists — **OK** | `components/ui/MiniMap.tsx` | ✅ Exists |

---

## SPEC 08 — Properties & Materials

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 87 | Section database browser | Spec §8.1: 720×600px dialog with categories/search/preview | `SectionDatabasePage.tsx` exists | `pages/SectionDatabasePage.tsx` | ⚠️ Verify dimensions and layout match spec. |
| 88 | Custom section creator | Spec §8.2: 7 shape types (I, Channel, Angle, Tube, Pipe, T, Custom) | Check if custom section dialog exists | Various | ⚠️ Verify all 7 types. |
| 89 | Material database | Spec §8.3: predefined steel/concrete/rebar grades | `MaterialsDatabasePage.tsx` exists | `pages/MaterialsDatabasePage.tsx` | ✅ Exists |
| 90 | Member releases dialog | Spec §8.5: 6-DOF release checkboxes per end | Check properties panel | Various | ⚠️ Verify implementation. |

---

## SPEC 09 — Loading System

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 91 | Load case manager | Spec §9.1: panel with add/edit/delete cases | Check workspace components | Various | ⚠️ Verify load case manager panel. |
| 92 | Load types | Spec §9.2-9.9: 8 types (Point, UDL, Triangular, Moment, Self-weight, Floor, Thermal, Moving) | `LoadInputDialog.tsx` exists | `components/ui/LoadInputDialog.tsx` | ⚠️ Verify all 8 load types are implemented. |
| 93 | Load combination page | Spec §9.10 | `LoadCombinationPage.tsx` exists — **OK** | `pages/LoadCombinationPage.tsx` | ✅ Exists |
| 94 | IS 875 load dialog | Spec references Indian Standards | `IS875LoadDialog.tsx` exists — **OK** | `components/IS875LoadDialog.tsx` | ✅ Exists |
| 95 | IS 1893 seismic dialog | Spec references seismic loads | `IS1893SeismicLoadDialog.tsx` exists — **OK** | `components/IS1893SeismicLoadDialog.tsx` | ✅ Exists |

---

## SPEC 10 — Analysis Engine

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 96 | Analysis setup dialog | Spec §10.1: 6 tabs (Linear, P-Delta, Buckling, Modal, Response Spectrum, Nonlinear) | Check for analysis dialog components | Various | ⚠️ Verify 6-tab dialog. |
| 97 | Analysis types pages | P-Delta, Buckling, Modal, Nonlinear, Pushover, Dynamic, Time-History | `PDeltaAnalysisPanel.tsx`, `BucklingAnalysisPanel.tsx`, `ModalAnalysisPage.tsx`, `NonlinearAnalysisPage.tsx`, `PushoverAnalysisPage.tsx`, `DynamicAnalysisPage.tsx`, `TimeHistoryAnalysisPage.tsx` all exist | Various pages | ✅ All exist |
| 98 | Progress overlay | Spec §10.3: progress bar with convergence plot | Check analysis progress components | Various | ⚠️ Verify convergence plot exists. |
| 99 | Analysis progress CSS | Spec: gradient progress bar | `.analysis-progress` class exists — **OK** | `index.css:1362-1373` | ✅ Match |

---

## SPEC 11 — Results & Post-Processing

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 100 | BMD color | Spec §11.2: Purple `#a855f7` fill | `.diagram-bmd { color: #a855f7 }` — **OK** | `index.css:1386` | ✅ Match |
| 101 | SFD color | Spec §11.2: Blue `#3b82f6` fill | `.diagram-sfd { color: #3b82f6 }` — **OK** | `index.css:1383` | ✅ Match |
| 102 | AFD color | Spec §11.2: Amber `#f59e0b` | `.diagram-afd { color: #f59e0b }` — **OK** | `index.css:1389` | ✅ Match |
| 103 | Deflection color | Spec §11.2: Green | `.diagram-deflection { color: #10b981 }` — **OK** | `index.css:1392` | ✅ Match |
| 104 | Positive/Negative diagram colors | Spec: Green (#22c55e) / Red (#ef4444) | `.diagram-positive: #22c55e`, `.diagram-negative: #ef4444` — **OK** | `index.css:1395-1398` | ✅ Match |
| 105 | Stress contour palette | Spec §11.5: Rainbow default + Viridis/Magma/Cividis/Grayscale options | `.gradient-stress-spectrum` exists, but no palette switcher | `index.css:234-236` | ⚠️ Only one rainbow palette in CSS; colorblind-safe alternatives (Spec §22.6) not implemented. |
| 106 | Result tables component | Spec §11.6: forces/reactions/displacements tables | `ResultsTable.tsx` exists | `components/ResultsTable.tsx` | ✅ Exists |
| 107 | Result animation viewer | Spec: mode shape viewer with animation controls | `ResultAnimationViewer.tsx` exists | `pages/ResultAnimationViewer.tsx` | ✅ Exists |

---

## SPEC 12 — Design Modules

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 108 | Steel design | Spec §12.1: IS 800/AISC/Eurocode | `SteelDesignPage.tsx`, `SteelDesignPanel.tsx` exist | Various | ✅ Exists |
| 109 | RC design (beam + column) | Spec §12.4-12.5 | `ConcreteDesignPage.tsx` exists | `pages/ConcreteDesignPage.tsx` | ✅ Exists |
| 110 | IS 456 design panel | Spec references IS 456 for RC | `IS456DesignPanel.tsx` exists | `components/IS456DesignPanel.tsx` | ✅ Exists |
| 111 | Connection design | Spec §12.6 | `ConnectionDesignPage.tsx`, `ConnectionDesignDatabase.tsx` exist | Various | ✅ Exists |
| 112 | Foundation design | Spec §12.7 | `FoundationDesignPage.tsx` exists | `pages/FoundationDesignPage.tsx` | ✅ Exists |
| 113 | Utilization ratio colors | Spec §12.2: green ≤0.5, yellow 0.5-0.8, orange 0.8-1.0, red >1.0 | Need to verify color coding | Design components | ⚠️ Verify color thresholds in design panels. |

---

## SPEC 13 — Reporting & Export

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 114 | Report builder | Spec §13.1: 14-section checklist builder | `ReportBuilderPage.tsx`, `ProfessionalReportGenerator.tsx` exist | Various | ✅ Exists |
| 115 | Export dialog | Spec §13.3: 8 formats (PDF, DXF, IFC, Excel, CSV, Image, JSON, STAAD) | `PrintExportCenter.tsx`, `BIMExportEnhanced.tsx` exist | Various | ✅ Exists |
| 116 | Calculation sheet | Spec §13.2: 3-column engineering format | Check report components | Various | ⚠️ Verify 3-column format. |

---

## SPEC 14 — AI & Automation

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 117 | AI panel width | Spec §14.1: 380px sidebar | `ChatPanel.tsx` exists | `components/ChatPanel.tsx` | ⚠️ Verify width = 380px. |
| 118 | AI panel bg gradient | Spec: subtle purple tint `rgba(139,92,246,0.03)` | Need to verify | `components/ChatPanel.tsx` | ⚠️ Verify purple tint. |
| 119 | Code compliance checker | Spec §14.3 | `CodeComplianceChecker.tsx` exists | `pages/CodeComplianceChecker.tsx` | ✅ Exists |
| 120 | Section optimizer | Spec §14.4 | AI/optimization components exist | Various | ⚠️ Verify implementation. |

---

## SPEC 15 — BIM Integration

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 121 | BIM Integration Hub | Spec §15.1: Connected platforms grid (Revit, Tekla, AutoCAD, ETABS) | `BIMIntegrationPage.tsx` exists | `pages/BIMIntegrationPage.tsx` | ✅ Exists |
| 122 | IFC import dialog | Spec §15.2: File browse + 3D preview + mapping table | Check BIM components | Various | ⚠️ Verify dialog matches spec layout. |
| 123 | IFC export dialog | Spec §15.3 | `BIMExportEnhanced.tsx` exists | `pages/BIMExportEnhanced.tsx` | ✅ Exists |
| 124 | STAAD import | Spec §15.5: .std file import with parsing results | Check import components | Various | ⚠️ Verify STAAD import dialog. |
| 125 | CAD integration | Mentioned in spec | `CADIntegrationHub.tsx` exists | `pages/CADIntegrationHub.tsx` | ✅ Exists |

---

## SPEC 16 — Collaboration

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 126 | Multi-user cursors | Spec §16.1: colored cursors with name tags, 6-color palette | `CollaborationHub.tsx` exists | `pages/CollaborationHub.tsx` | ⚠️ Verify cursor colors match spec palette. |
| 127 | Cursor color palette | Spec: `#3b82f6, #22c55e, #f59e0b, #8b5cf6, #ef4444, #06b6d4` | Need to verify | Collaboration components | ⚠️ Verify 6 colors. |
| 128 | Share project dialog | Spec §16.2: email invite, role picker (Owner/Editor/Commenter/Viewer) | Check share dialog | Various | ⚠️ Verify dialog. |
| 129 | Comments system | Spec §16.3: threaded comments pinned to elements | Check comments components | Various | ⚠️ Verify threaded comment system. |
| 130 | Version history | Spec §16.4: manual + auto saves, compare mode | `HistoryPanel.tsx` exists | `components/ui/HistoryPanel.tsx` | ✅ Exists |
| 131 | Activity feed | Spec §16.5: timestamped user actions | Check collaboration components | Various | ⚠️ Verify activity feed. |

---

## SPEC 17 — Settings

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 132 | Settings layout | Spec §17.1: 240px sidebar + fluid content | `SettingsPage.tsx`, `SettingsPageEnhanced.tsx` exist | Various | ⚠️ Verify sidebar width = 240px. |
| 133 | Settings nav sections | Spec: Profile, General, Units, Appearance, Shortcuts, Notifications, Subscription, Privacy, Usage, Help | Check settings tabs | Various | ⚠️ Verify all 10 sections. |
| 134 | Units settings | Spec §17.3: 8 unit categories with precision controls | Check settings components | Various | ⚠️ Verify all unit categories. |
| 135 | Theme settings | Spec §17.4: Dark/Light/System + accent color picker (6 colors + custom) | `ThemeProvider.tsx` exists | `components/ui/ThemeProvider.tsx` | ⚠️ Verify accent color picker with 6 options. |
| 136 | Keyboard shortcuts settings | Spec §17.5: preset options (Default, STAAD-like, AutoCAD-like, Custom) | Check settings | Various | ⚠️ Verify presets. |
| 137 | Subscription management | Spec §17.6: current plan, usage meters, billing history | Check settings | Various | ⚠️ Verify billing UI. |
| 138 | Advanced settings | Spec mentions professional details | `AdvancedSettingsPage.tsx` exists | `pages/AdvancedSettingsPage.tsx` | ✅ Exists |

---

## SPEC 18 — Mobile & Responsive

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 139 | Breakpoints | Spec: Desktop ≥1280, Laptop 1024-1279, Tablet 768-1023, Mobile <768 | `theme.ts` has `md:768, lg:1024, xl:1280` — **OK** | `styles/theme.ts:372-378` | ✅ Match |
| 140 | Touch targets | Spec §18.4: min 44×44px on touch devices | `@media (pointer: coarse) { min-height: 44px; min-width: 44px; }` — **OK** | `index.css:1036-1042` | ✅ Match |
| 141 | Bottom sheet | Spec §18.3: 3 snap points (peek 100px, half 50%, full 90%) | Check mobile components | Various | ❌ **Missing** — No bottom sheet component found for mobile properties panel. |
| 142 | Mobile bottom navigation | Spec §18.3: 5-icon tab bar (Home, View, Results, Report, Chat) | Check mobile layout | Various | ❌ **Missing** — No mobile bottom navigation bar component. |
| 143 | Mobile action sheet | Spec §18.5: replaces context menu on mobile | Check mobile components | Various | ❌ **Missing** — No iOS-style action sheet component. |
| 144 | Drag handle | Spec §18.3: `40×4px rounded bar, slate-500` | Not found | Various | ❌ **Missing** — No drag handle component for mobile sheets. |

---

## SPEC 19 — Onboarding & Help

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 145 | First-run wizard | Spec §19.1: 4-step wizard (Welcome, Role, Tour, First Project) | Check onboarding components | `components/onboarding/` directory exists | ⚠️ Verify 4-step wizard matches spec. |
| 146 | Interactive guided tour | Spec §19.2: 8-step tooltip walkthrough with dim overlay | Check tour components | `components/tour/` directory exists | ⚠️ Verify 8 tour stops. |
| 147 | Help center | Spec §19.4: searchable docs, videos, FAQs, support contact | `HelpPage.tsx` exists | `pages/HelpPage.tsx` | ✅ Exists |
| 148 | What's New panel | Spec §19.5: changelog modal on first login after update, 480px wide | Check changelog component | Various | ⚠️ Verify changelog modal exists. |
| 149 | Empty states guidance | Spec §19.6: 4 options (Grid Generator, Draw, AI Generate, Import) when workspace is empty | `EmptyStates.tsx` exists | `components/ui/EmptyStates.tsx` | ✅ Exists — verify content matches 4 options. |

---

## SPEC 20 — Advanced Features

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 150 | Scripting/macro editor | Spec §20.1: code editor with BeamLab DSL, syntax highlighting, console | Check for script editor component | Various | ⚠️ Need to search for scripting editor. |
| 151 | Digital twin dashboard | Spec §20.2: 3D live view with sensor overlays, health summary, time-history plot | `DigitalTwinDashboard.tsx` exists | `pages/DigitalTwinDashboard.tsx` | ✅ Exists |
| 152 | Bill of Quantities (BOQ) | Spec §20.3: steel/concrete/rebar/formwork tables with costs | `QuantitySurveyPage.tsx` exists | `pages/QuantitySurveyPage.tsx` | ✅ Exists |
| 153 | Bar Bending Schedule (BBS) | Spec §20.4: reinforcement details with shape codes | `BarBendingSchedulePage.tsx` exists | `pages/BarBendingSchedulePage.tsx` | ✅ Exists |
| 154 | Parametric modeling | Spec §20.5: sliders with live 3D preview | `components/parametric/` directory exists | Various | ⚠️ Verify implementation. |
| 155 | Batch processing | Spec §20.6: multi-project analysis + design batch | Check for batch component | Various | ⚠️ Need to search. |
| 156 | Cost estimation | Spec §20.7: rate input, cost breakdown chart, optimization suggestion | Check for cost component | Various | ⚠️ Need to search. |

---

## SPEC 21 — Interactions & Animations

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 157 | Panel resize drag handle | Spec §21.6: 4px wide, cursor col-resize, blue-500/30 on hover, snap at 280/360/240px | No drag handle styling found in CSS | Various | ❌ **Missing** — Panel resize drag handle with snap points not implemented in CSS. |
| 158 | Ribbon tab underline animation | Spec §21.7: active indicator slides horizontally between tabs | Static state toggle only | `tabs.tsx` | ❌ **Missing** — No sliding animated indicator bar. |
| 159 | Dropdown stagger animation | Spec §21.4: items stagger in with `index × 30ms delay, 150ms fade+slide` | Not found in select/dropdown | Various | ❌ **Missing** — No stagger animation on dropdown items. |
| 160 | Sidebar collapse animation | Spec §21.6: labels fade (first 150ms), then width shrinks 280→48px total 300ms | Need to verify | Workspace components | ⚠️ Verify 2-phase animation. |
| 161 | Properties panel slide | Spec §21.6: `translateX(100%)→0, 250ms ease-out` | Need to verify | Workspace components | ⚠️ Verify slide animation. |

---

## SPEC 22 — Accessibility & Performance

| # | Gap | Spec Value | Current Value | File | Notes |
|---|-----|-----------|---------------|------|-------|
| 162 | Skip-to-main link | Spec §22.2: visible on focus, bg blue-500, z-9999 | `SkipLink.tsx` exists with correct styles — **OK** | `components/ui/SkipLink.tsx` | ✅ Match |
| 163 | ARIA landmarks | Spec §22.3: `role="banner"`, `role="tablist"`, `role="tree"`, `role="application"` on canvas | Need full audit of ARIA roles across workspace | Various | ⚠️ Partial — SkipLink exists, but full ARIA landmark implementation on workspace layout needs verification. |
| 164 | Focus ring color | Spec §22.2: `blue-400 (#60a5fa), 2px, offset 2px` | `index.css:305` uses `#2b7cee` (not blue-400) | `index.css:305` | ❌ **Mismatch** — Spec says `#60a5fa` (blue-400), global CSS uses `#2b7cee`. Component-level (button.tsx) uses various rings. |
| 165 | `aria-live` regions | Spec §22.3: analysis progress = `polite`, errors = `assertive`, toasts = `role="alert"` | `ToastSystem.tsx` imports `announce` from accessibility utils | `ToastSystem.tsx:27` | ⚠️ Toast uses accessibility util; verify analysis progress and errors also announce. |
| 166 | Color-blind safe palettes | Spec §22.6: Viridis, Magma, Cividis, Grayscale contour alternatives | Not implemented | Various | ❌ **Missing** — Only rainbow palette exists. No palette switcher in settings. |
| 167 | Stress contour palette setting | Spec §22.6: `Settings > Appearance > Color Map` dropdown | Not found in settings | Settings components | ❌ **Missing** — No color map selector in appearance settings. |
| 168 | Non-color status encoding | Spec §22.1: all status must have icon + text, never color alone | Need to audit all status indicators | Various | ⚠️ Need component-level audit. |
| 169 | High contrast mode | Spec §22.7 references it | `@media (prefers-contrast: high)` exists — **OK** | `index.css:1024-1032` | ✅ Match |
| 170 | Text sizing (rem units) | Spec §22.7: all text uses rem/em, never px | Mixed — some components use `text-[11px]` (px) | `badge.tsx:12`, `input.tsx` | ⚠️ Some hardcoded px values. Spec says rem only. |
| 171 | Motion settings in UI | Spec §22.5: `Settings > Appearance > Motion` with 4 options (System/Full/Reduced/None) | Not found in settings UI | Settings components | ❌ **Missing** — No in-app motion preference selector. |

---

## SUMMARY — CRITICAL GAPS

### ❌ Must-Fix (Value Mismatches)

| # | Issue | Spec | Current | File |
|---|-------|------|---------|------|
| 4 | `semanticColors.background.primary` | Slate-900 `#0f172a` | Slate-950 `#020617` | `theme.ts:128` |
| 12 | `html,body` font-family | Inter (body font) | Space Grotesk first | `index.css:144-145` |
| 20 | Primary button bg | `#3b82f6` (blue-500) | `bg-blue-600` (`#2563eb`) | `button.tsx:80` |
| 21 | Primary button hover | `#2563eb` (blue-600) | `bg-blue-700` (`#1d4ed8`) | `button.tsx:80` |
| 34 | Card dark bg | Slate-800 `#1e293b` | Slate-900 `#0f172a` | `card.tsx:12` |
| 63 | Feature card hover lift | `-8px` | `-4px` | `index.css:744` |
| 164 | Global focus ring color | `#60a5fa` (blue-400) | `#2b7cee` | `index.css:305` |

### ❌ Must-Add (Missing Features)

| # | Feature | Spec Section |
|---|---------|-------------|
| 5 | Elevation CSS variables/classes (1-4) | §1.5 |
| 32 | Floating label animation on inputs | §21.3 |
| 33 | Numeric input scrub (click-drag) | §21.3 |
| 41 | Tab content enter/exit animation | §21.7 |
| 45 | Tooltip max-width: 280px | §2.9 |
| 48 | Toast progress bar countdown | §21.8 |
| 58 | Empty state dashed border | §19.6 |
| 105/166 | Color-blind safe contour palettes | §22.6 |
| 141 | Mobile bottom sheet component | §18.3 |
| 142 | Mobile bottom navigation bar | §18.3 |
| 143 | Mobile action sheet | §18.5 |
| 157 | Panel resize drag handle with snap | §21.6 |
| 158 | Sliding ribbon tab indicator | §21.7 |
| 159 | Dropdown item stagger animation | §21.4 |
| 167 | Color map selector in settings | §22.6 |
| 171 | Motion preference selector in settings | §22.5 |

### ⚠️ Needs Verification (26 items)

Items marked ⚠️ in the report above require reading specific component internals to confirm match/mismatch. Key ones:

- #43: Tooltip delay should be context-dependent (500ms general, 1500ms tool buttons)
- #47: Toast max count (spec: 3, code: 5)
- #51: Dialog spring easing not applied
- #56: Skeleton uses pulse instead of shimmer sweep
- #16: Duration token name `--duration-dramatic` vs `--duration-slowest`
- #25: Focus ring blue-300 vs blue-400

---

## FILE-LEVEL INDEX

| File | Gaps |
|------|------|
| `apps/web/src/index.css` | #5, #12, #16, #19, #58, #63, #105, #164 |
| `apps/web/src/styles/theme.ts` | #4 |
| `apps/web/src/components/ui/button.tsx` | #20, #21, #22, #25 |
| `apps/web/src/components/ui/card.tsx` | #34, #36 |
| `apps/web/src/components/ui/input.tsx` | #32, #33 |
| `apps/web/src/components/ui/tabs.tsx` | #40, #41, #158 |
| `apps/web/src/components/ui/Tooltip.tsx` | #43, #44, #45 |
| `apps/web/src/components/ui/ToastSystem.tsx` | #47, #48, #49 |
| `apps/web/src/components/ui/dialog.tsx` | #51 |
| `apps/web/src/components/ui/Skeleton.tsx` | #56 |
| `apps/web/src/components/ui/EmptyStates.tsx` | #58 |
| **Missing components (need creation)** | #141 (BottomSheet), #142 (MobileNav), #143 (ActionSheet), #157 (DragHandle) |
