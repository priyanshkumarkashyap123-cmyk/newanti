# 21 — Interactions & Animations
## BeamLab Ultimate Figma Specification

---

## 21.1 Global Animation Tokens

### Timing Functions
| Token | Value | Usage |
|-------|-------|-------|
| `--ease-default` | `cubic-bezier(0.4, 0, 0.2, 1)` | General transitions |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Elements exiting |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Elements entering |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Two-state toggles |
| `--ease-spring` | `cubic-bezier(0.175, 0.885, 0.32, 1.275)` | Playful bounces |
| `--ease-overshoot` | `cubic-bezier(0.34, 1.56, 0.64, 1)` | Attention-grabbing |

### Duration Scale
| Token | Value | Usage |
|-------|-------|-------|
| `--duration-instant` | `75ms` | Micro-feedback (color change) |
| `--duration-fast` | `150ms` | Hover states, small movements |
| `--duration-normal` | `250ms` | General transitions |
| `--duration-slow` | `400ms` | Complex state changes |
| `--duration-slower` | `600ms` | Large layout shifts |
| `--duration-dramatic` | `1000ms` | Page transitions, reveals |
| `--duration-loop` | `2000ms` | Pulsing, breathing animations |

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 21.2 Button Interactions

### All button states with transitions

```
┌──────────────────────────────────────────────────────────────────────┐
│ Button State Machine                                                 │
│                                                                      │
│  Default ──hover(150ms)──→ Hover ──press(75ms)──→ Active            │
│    │                        │ │                      │               │
│    │                        │ ←──leave(150ms)───────┘               │
│    │                        │                                        │
│    ├──focus(0ms)──→ Focus   │                                       │
│    │                        │                                        │
│    ├──disable──→ Disabled   │                                       │
│    │                        │                                        │
│    └──loading──→ Loading ───┘                                       │
│                    (spinner)                                          │
│                                                                      │
│ Primary Button:                                                      │
│                                                                      │
│ Default:   bg: #3b82f6  text: white  shadow: sm  scale: 1           │
│ Hover:     bg: #2563eb  text: white  shadow: md  scale: 1           │
│            ↳ translate-y: -1px                                       │
│ Active:    bg: #1d4ed8  text: white  shadow: sm  scale: 0.98        │
│            ↳ translate-y: 0px                                        │
│ Focus:     ring: 2px #93c5fd  offset: 2px                           │
│ Disabled:  bg: #3b82f6/50  text: white/50  cursor: not-allowed      │
│ Loading:   bg: #3b82f6  text: hidden  spinner: white 16px revolve   │
│                                                                      │
│ Loading spinner:                                                     │
│ ┌──────────────────┐                                                │
│ │  ◌ Running...    │   Spinner: 16×16, 2px border                  │
│ └──────────────────┘   Animation: rotate 360° linear 750ms infinite│
│                                                                      │
│ Icon button hover: icon rotates 15° on hover (if gear/settings)     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 21.3 Input Field Interactions

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ ── Text Input States ──                                             │
│                                                                      │
│ Default:                                                             │
│ ┌──────────────────────────────┐                                    │
│ │ Placeholder text             │  border: 1px slate-600             │
│ └──────────────────────────────┘  bg: slate-800                     │
│                                    transition: border 150ms          │
│                                                                      │
│ Focus:                                                               │
│ ┌──────────────────────────────┐                                    │
│ │ |                            │  border: 2px blue-500              │
│ └──────────────────────────────┘  ring: 0 0 0 3px blue-500/20      │
│  Label floats up ↑                 label: scale(0.85) translateY(-24)│
│  ┌─Label────┐                      transition: all 200ms ease-out   │
│                                                                      │
│ Filled:                                                              │
│ ┌──────────────────────────────┐                                    │
│ │ 150.5                        │  border: 1px slate-500              │
│ └──────────────────────────────┘  label stays floated               │
│  Label (floated)                                                     │
│                                                                      │
│ Error:                                                               │
│ ┌──────────────────────────────┐                                    │
│ │ -50                          │  border: 2px red-500               │
│ └──────────────────────────────┘  ring: 0 0 0 3px red-500/20       │
│  ⚠ Value must be positive          shake animation: 300ms           │
│                                                                      │
│ Error shake keyframes:                                               │
│ 0%, 100%: translateX(0)                                             │
│ 10%, 30%, 50%, 70%, 90%: translateX(-4px)                          │
│ 20%, 40%, 60%, 80%: translateX(4px)                                │
│ Duration: 300ms                                                      │
│                                                                      │
│ ── Numeric Input with Scrub ──                                      │
│ Click + drag horizontally on value to scrub:                        │
│ Cursor changes to ↔ (col-resize)                                   │
│ Value updates live, 3D viewport updates simultaneously              │
│ Ctrl + drag: fine mode (0.1 step)                                   │
│ Shift + drag: coarse mode (10 step)                                 │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 21.4 Dropdown / Select Interactions

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ Closed state:                                                        │
│ ┌──────────────────────────┐                                        │
│ │ ISMB 400            ▾   │                                        │
│ └──────────────────────────┘                                        │
│                                                                      │
│ Opening animation:                                                   │
│ ┌──────────────────────────┐                                        │
│ │ ISMB 400            ▴   │ ← chevron rotates 180° (200ms)        │
│ ├──────────────────────────┤                                        │
│ │ 🔍 Search sections...   │ ← auto-focused                        │
│ ├──────────────────────────┤                                        │
│ │ ISMB 200                 │ ← items enter with stagger:           │
│ │ ISMB 250                 │   each item fades in + slides up      │
│ │ ISMB 300                 │   4px from bottom                     │
│ │ █████████████████████████│   delay: index × 30ms                 │
│ │ ISMB 400 ← selected ✓  │   duration: 150ms                     │
│ │ ISMB 450                 │   max visible stagger: 8 items        │
│ │ ISMB 500                 │                                        │
│ │ ISMB 550                 │ List max-height animates from 0       │
│ │ ISMB 600                 │ to auto (scaleY 0→1 from transform    │
│ └──────────────────────────┘ origin top)                            │
│                                                                      │
│ Hover on item:                                                       │
│ Background: slate-700 (150ms)                                       │
│ Slight indent left border: 2px blue-500 appears                    │
│                                                                      │
│ Selection:                                                           │
│ Checkmark ✓ fades in (150ms) next to selected item                 │
│ Dropdown closes with reverse animation (150ms)                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 21.5 Dialog / Modal Interactions

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ Opening sequence (total: ~300ms):                                    │
│                                                                      │
│ 1. Backdrop fades in: opacity 0 → 0.5                               │
│    bg: #000, duration: 200ms, ease-out                              │
│                                                                      │
│ 2. Dialog enters (starts 50ms after backdrop):                       │
│    - Scale: 0.95 → 1.0                                              │
│    - Opacity: 0 → 1                                                  │
│    - TranslateY: 10px → 0                                           │
│    - Duration: 250ms                                                 │
│    - Easing: ease-spring                                            │
│                                                                      │
│ 3. Focus trapped inside modal                                        │
│    First focusable element receives focus                           │
│                                                                      │
│ Closing sequence (total: ~200ms):                                    │
│                                                                      │
│ 1. Dialog exits:                                                     │
│    - Scale: 1.0 → 0.95                                              │
│    - Opacity: 1 → 0                                                  │
│    - Duration: 150ms                                                 │
│    - Easing: ease-in                                                 │
│                                                                      │
│ 2. Backdrop fades out: opacity 0.5 → 0                              │
│    Duration: 150ms (starts 50ms after dialog)                       │
│                                                                      │
│ 3. Focus returns to trigger element                                 │
│                                                                      │
│ Trigger: Escape key, backdrop click, close button                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 21.6 Sidebar / Panel Interactions

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ ── Left Sidebar (Workflow Panel) ──                                 │
│                                                                      │
│ Open (default):  width: 280px                                       │
│ Collapsed:       width: 48px (icons only)                           │
│                                                                      │
│ Collapse animation:                                                  │
│   width: 280px → 48px                                               │
│   duration: 300ms                                                    │
│   ease: ease-in-out                                                 │
│   labels: opacity 1→0 (first 150ms), then width shrinks            │
│   icons: remain visible, centered                                    │
│   tooltip: appears on icon hover when collapsed                     │
│                                                                      │
│ Expand animation:                                                    │
│   width: 48px → 280px                                               │
│   duration: 300ms                                                    │
│   ease: ease-in-out                                                 │
│   width expands first, then labels: opacity 0→1 (last 150ms)       │
│                                                                      │
│                                                                      │
│ ── Right Panel (Properties) ──                                      │
│                                                                      │
│ Slide in from right:                                                 │
│   transform: translateX(100%) → translateX(0)                       │
│   duration: 250ms                                                    │
│   ease: ease-out                                                    │
│   shadow appears simultaneously                                     │
│                                                                      │
│ Slide out to right:                                                  │
│   transform: translateX(0) → translateX(100%)                       │
│   duration: 200ms                                                    │
│   ease: ease-in                                                      │
│                                                                      │
│                                                                      │
│ ── Panel Resize (Draggable Border) ──                               │
│                                                                      │
│ Drag handle: 4px wide, transparent                                   │
│ Hover: cursor col-resize, handle bg: blue-500/30                    │
│ Active drag: handle bg: blue-500/60                                 │
│ Content reflows in real-time during drag                            │
│ Min width: 240px, Max width: 480px                                  │
│ Snap points: 280px (default), 360px (wide), 240px (narrow)         │
│ Snap threshold: 16px from snap point                                │
│ Visual snap feedback: brief blue flash on handle                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 21.7 Tab Switching

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ ── Ribbon Tab Transition ──                                         │
│                                                                      │
│ [Geometry] [Properties] [Loading] [Analysis] [Results]              │
│  ▔▔▔▔▔▔▔▔                                                         │
│                                                                      │
│ Active indicator (blue underline):                                   │
│   Slides horizontally from old tab to new tab                       │
│   Duration: 250ms                                                    │
│   Ease: ease-in-out                                                 │
│   Width morphs to match target tab width                            │
│                                                                      │
│ Tab content area:                                                    │
│   Outgoing tab: opacity 1→0 (100ms)                                │
│   Incoming tab: opacity 0→1 (150ms), delay 50ms                   │
│   Slide direction: left-to-right or right-to-left based on         │
│   tab position (translateX ±8px)                                    │
│                                                                      │
│ Active tab label:                                                    │
│   Color: white (#ffffff) ← from slate-400                          │
│   Font-weight: 500 → 600                                            │
│   Transition: color 150ms, font-weight 0ms                         │
│                                                                      │
│                                                                      │
│ ── Sub-tab / Segmented Control ──                                   │
│                                                                      │
│ [ BMD | SFD | AFD | Deformed | Stress ]                            │
│   ████                                                               │
│                                                                      │
│ Active pill background slides behind tabs:                           │
│   bg: blue-500/20                                                    │
│   border-radius: 6px                                                │
│   Duration: 200ms                                                    │
│   Ease: ease-spring (slight overshoot)                              │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 21.8 Toast / Notification Animations

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ Toast enters from bottom-right:                                      │
│                                                                      │
│ Enter:                                                               │
│   translateY: 100% → 0                                              │
│   opacity: 0 → 1                                                     │
│   scale: 0.9 → 1.0                                                  │
│   duration: 350ms                                                    │
│   ease: ease-spring                                                  │
│                                                                      │
│ ┌─────────────────────────────────────────┐                         │
│ │ ✓ Analysis completed successfully       │                         │
│ │   12 load cases · 0.8 seconds           │ ← auto-dismiss         │
│ │   ████████████████████░░░░ progress bar │   countdown: 5s         │
│ └─────────────────────────────────────────┘                         │
│                                                                      │
│ Progress bar: width animates 100% → 0% over auto-dismiss duration  │
│ Color: matches toast type (green/red/yellow/blue)                   │
│                                                                      │
│ Dismiss:                                                             │
│   Swipe right: translateX 0 → 100% + opacity 0                    │
│   Duration: 200ms, ease-in                                           │
│                                                                      │
│ Auto-dismiss:                                                        │
│   opacity: 1 → 0                                                     │
│   translateY: 0 → -10px                                             │
│   duration: 300ms                                                    │
│                                                                      │
│ Stack behavior:                                                      │
│   New toasts push existing ones up by (height + 8px)                │
│   Each push animated with translateY, 200ms, ease-out               │
│   Max visible: 3 toasts                                             │
│   Overflow: oldest dismissed first                                   │
│                                                                      │
│ Hover on toast: pauses auto-dismiss timer                           │
│ Leave toast: timer resumes                                           │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 21.9 Context Menu Animations

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ Right-click trigger:                                                 │
│                                                                      │
│ Enter:                                                               │
│   Origin: top-left (or adjusted to viewport bounds)                 │
│   Scale: 0.9 → 1.0                                                  │
│   Opacity: 0 → 1                                                     │
│   Duration: 150ms                                                    │
│   Ease: ease-out                                                     │
│                                                                      │
│ ┌────────────────────────────┐                                      │
│ │ ✏️ Edit Properties        │ ← items enter with stagger           │
│ │ 📋 Copy            Ctrl+C │   30ms delay between items            │
│ │ 📋 Paste           Ctrl+V │   translateY: -4px → 0               │
│ │ ──────────────────────── │   opacity: 0 → 1                      │
│ │ 🗑️ Delete          Delete │                                      │
│ │ ──────────────────────── │                                       │
│ │ ▸ More Actions...        │ ← submenu indicator                   │
│ └────────────────────────────┘                                      │
│                                                                      │
│ Hover on item:                                                       │
│   bg: blue-500/10 → blue-500/20 (150ms)                            │
│   text: slight brightening                                           │
│                                                                      │
│ Submenu:                                                             │
│   Slides in from left edge of parent                                │
│   Duration: 150ms                                                    │
│   Delay: 200ms (prevents jitter)                                    │
│                                                                      │
│ Exit:                                                                │
│   opacity: 1 → 0                                                     │
│   scale: 1.0 → 0.95                                                 │
│   duration: 100ms                                                    │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 21.10 Loading & Progress States

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ ── Skeleton Screens ──                                              │
│                                                                      │
│ Used for: Dashboard project cards, data tables, properties panel    │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────────┐│
│ │ ░░░░░░░░░░░░░░░░░░░░░  ← skeleton shimmer                     ││
│ │ ░░░░░░░░░░░░░░░░░                                               ││
│ │ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░                                   ││
│ │ ░░░░░░░░░░░░░░░░░░░░░                                           ││
│ └──────────────────────────────────────────────────────────────────┘│
│                                                                      │
│ Shimmer animation:                                                   │
│   background: linear-gradient(                                       │
│     90deg,                                                           │
│     slate-800 25%,                                                   │
│     slate-700 37%,                                                   │
│     slate-800 63%                                                    │
│   )                                                                  │
│   background-size: 400% 100%                                        │
│   animation: shimmer 1.5s ease-in-out infinite                      │
│                                                                      │
│   @keyframes shimmer {                                               │
│     0%   { background-position: 100% 50% }                         │
│     100% { background-position: 0% 50% }                           │
│   }                                                                  │
│                                                                      │
│ Transition to real content:                                          │
│   Skeleton fades out (150ms)                                        │
│   Real content fades in (250ms)                                     │
│   Overlap: 100ms                                                     │
│                                                                      │
│                                                                      │
│ ── Analysis Progress Overlay ──                                     │
│                                                                      │
│ ┌──────────────────────────────────────────────────────────────┐    │
│ │                                                              │    │
│ │          ◌ ← rotating ring (2s, linear, infinite)          │    │
│ │         ╱ ╲                                                  │    │
│ │        │ 45%│ ← percentage counter (animated counting)      │    │
│ │         ╲ ╱                                                  │    │
│ │                                                              │    │
│ │  Assembling stiffness matrix...                             │    │
│ │  ═══════════════════════░░░░░░░░░░░░░                       │    │
│ │                                                              │    │
│ │  Step 3 of 6: Solving equations                            │    │
│ │  ✓ Step 1: Pre-check (0.1s)                               │    │
│ │  ✓ Step 2: Assembly (0.3s)                                │    │
│ │  ◉ Step 3: Solving... (estimating)                        │    │
│ │  ○ Step 4: Post-process                                    │    │
│ │  ○ Step 5: Design checks                                   │    │
│ │  ○ Step 6: Report                                          │    │
│ │                                                              │    │
│ │  Step checkmark animation:                                  │    │
│ │  Circle → checkmark: stroke-dasharray animates             │    │
│ │  Duration: 300ms, ease: ease-out                           │    │
│ │  Color: green-500 on complete                              │    │
│ │                                                              │    │
│ └──────────────────────────────────────────────────────────────┘    │
│                                                                      │
│                                                                      │
│ ── Indeterminate Progress Bar ──                                    │
│                                                                      │
│ Used when duration is unknown (imports, AI generation)              │
│                                                                      │
│ ┌──────────────────────────────────────────────────┐                │
│ │  ════░░░░░░░░░░░░░═══════░░░░░░░░░░░░            │                │
│ └──────────────────────────────────────────────────┘                │
│                                                                      │
│ Two gradient bars sliding left → right + right → left              │
│ Duration: 1.5s each, offset by 750ms                               │
│ Ease: ease-in-out                                                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 21.11 3D Viewport Interactions

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ ── Orbit / Pan / Zoom ──                                            │
│                                                                      │
│ Orbit (middle mouse drag):                                           │
│   Camera rotates around model center                                │
│   Inertia: continues moving after release with deceleration         │
│   Deceleration: 0.95 damping factor per frame                       │
│   Stops when velocity < 0.001                                       │
│                                                                      │
│ Pan (Shift + middle mouse):                                          │
│   1:1 movement with cursor                                          │
│   Smooth, no inertia                                                │
│                                                                      │
│ Zoom (scroll wheel):                                                 │
│   Smooth zoom toward cursor position                                │
│   Zoom factor: 1.1x per scroll tick                                 │
│   Animation: ease-out 200ms per step                                │
│   Min zoom: 0.01 (far)                                              │
│   Max zoom: 1000 (close)                                            │
│                                                                      │
│ Fit All (F key or double-click ViewCube center):                    │
│   Camera animates to encompass all geometry                         │
│   Duration: 600ms                                                    │
│   Ease: ease-in-out                                                 │
│   Maintains current orientation                                      │
│                                                                      │
│ View presets (ViewCube click):                                       │
│   Camera orientation animates (quaternion slerp)                    │
│   Duration: 500ms                                                    │
│   Ease: ease-in-out                                                 │
│                                                                      │
│                                                                      │
│ ── Element Hover ──                                                 │
│                                                                      │
│ Member hover:                                                        │
│   Line thickness: 2px → 4px (instant)                               │
│   Color: original → highlight yellow (#fbbf24)                      │
│   Glow effect: 4px yellow blur                                      │
│   Cursor: pointer                                                    │
│   Info popup appears after 500ms:                                    │
│     "Member 23: ISMB 400, L=6.0m"                                  │
│                                                                      │
│ Node hover:                                                          │
│   Circle size: 6px → 10px (150ms)                                  │
│   Color: white → cyan (#06b6d4)                                    │
│   Ring pulse animation: radiating ring fading out                   │
│   Info popup: "Node 5: (6.0, 3.6, 0.0)"                           │
│                                                                      │
│                                                                      │
│ ── Selection ──                                                     │
│                                                                      │
│ Click to select:                                                     │
│   Element color → blue (#3b82f6), instant                           │
│   Selection ring pulse: 1 outward ring, 400ms, fading opacity      │
│   Properties panel updates (slide transition)                       │
│                                                                      │
│ Box selection (drag):                                                │
│   Dashed blue rectangle drawn from mousedown to current             │
│   Border: 1px dashed blue-400                                       │
│   Fill: blue-500/10                                                  │
│   Updates in real-time as mouse moves                               │
│   On release: enclosed elements highlight simultaneously            │
│                                                                      │
│                                                                      │
│ ── Node/Member Creation ──                                          │
│                                                                      │
│ Node placement:                                                      │
│   Snap indicator: green cross-hair at snap point                    │
│   On click: node appears with "pop" animation                      │
│     scale: 0 → 1.2 → 1.0 (200ms, ease-spring)                     │
│     Small particle burst (6 particles, outward, 300ms, fade)       │
│                                                                      │
│ Member drawing:                                                      │
│   Rubber-band line from start node to cursor                        │
│   Dashed while drawing, solid on confirm                            │
│   Length label follows midpoint                                      │
│   On confirm: line solidifies with brief glow (200ms)              │
│                                                                      │
│                                                                      │
│ ── Result Animations ──                                             │
│                                                                      │
│ Deformed shape transition:                                           │
│   Morph from undeformed → deformed                                  │
│   Duration: 800ms                                                    │
│   Ease: ease-in-out                                                 │
│   Linear interpolation of displacement scale 0→1                   │
│                                                                      │
│ BMD/SFD reveal:                                                      │
│   Diagrams draw from left to right (or start to end)               │
│   Duration: 600ms per member                                        │
│   Stagger: 30ms between adjacent members                           │
│   Fill opacity: 0 → 0.3                                             │
│                                                                      │
│ Stress contour:                                                      │
│   Color flood fills across elements                                  │
│   Duration: 500ms                                                    │
│   Fade-in of legend simultaneously                                   │
│                                                                      │
│ Mode shape animation:                                                │
│   Sinusoidal oscillation between +φ and −φ                          │
│   Period: 2000ms                                                     │
│   Ease: sinusoidal (smooth back-and-forth)                          │
│   Scale factor controlled by slider                                  │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 21.12 Page & Route Transitions

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ ── Landing → Dashboard ──                                           │
│ After login, crossfade with slight zoom:                            │
│   Landing: opacity 1→0, scale 1→1.02 (400ms)                      │
│   Dashboard: opacity 0→1, scale 0.98→1 (400ms, delay 100ms)       │
│                                                                      │
│ ── Dashboard → Workspace ──                                         │
│ Project card click triggers expansion:                              │
│   Card scales up: fills viewport (500ms, ease-in-out)              │
│   Card content fades: opacity 1→0 (200ms)                          │
│   Workspace content fades in: opacity 0→1 (300ms, delay 300ms)    │
│   FLIP animation if supported                                       │
│                                                                      │
│ ── Workspace → Dashboard (back) ──                                  │
│ Reverse: workspace shrinks back to card position                    │
│   Duration: 400ms total                                              │
│                                                                      │
│ ── Settings pages ──                                                │
│ Slide left/right based on sidebar selection direction               │
│   Duration: 250ms                                                    │
│   Ease: ease-out                                                     │
│                                                                      │
│ ── Route change fallback ──                                         │
│ Simple crossfade:                                                    │
│   Out: opacity 1→0 (150ms)                                         │
│   In: opacity 0→1 (250ms, delay 100ms)                             │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 21.13 Drag & Drop Interactions

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│ ── Section Assignment (drag from library to member) ──              │
│                                                                      │
│ Pickup:                                                              │
│   Source item: opacity 0.5, scale 0.95                              │
│   Ghost element: follows cursor with offset (8px, 8px)             │
│   Ghost: section name badge, shadow-lg, slight rotation (2°)       │
│   Cursor: grabbing                                                   │
│                                                                      │
│ Over valid target (member):                                          │
│   Member highlights green (#22c55e)                                 │
│   Ghost: green border glow                                          │
│   Drop indicator: "Assign ISMB 400 to Member 23"                   │
│                                                                      │
│ Over invalid target:                                                 │
│   Ghost: red border, 🚫 cursor                                     │
│                                                                      │
│ Drop:                                                                │
│   Ghost snaps to member (200ms, ease-out, scale 1→0)               │
│   Member flashes green briefly (300ms)                              │
│   Properties panel updates with slide animation                     │
│   Toast: "Section assigned: ISMB 400 → Member 23"                 │
│                                                                      │
│ Cancel (Escape or release on invalid):                              │
│   Ghost returns to original position (300ms, ease-spring)           │
│   Source item: opacity back to 1                                    │
│                                                                      │
│                                                                      │
│ ── Project Card Reorder (Dashboard) ──                              │
│                                                                      │
│ Pickup: card lifts (shadow-xl, scale 1.02, z-index: 1000)          │
│ Other cards: shift to make space (200ms, ease-out)                  │
│ Drop: card settles into new position (200ms, ease-spring)           │
│ FLIP animation for smooth list reordering                           │
│                                                                      │
│                                                                      │
│ ── Load Value Drag (in viewport) ──                                 │
│                                                                      │
│ Arrow tip of load indicator is draggable:                           │
│   Drag vertically/horizontally to change magnitude                  │
│   Value label updates live next to arrow                            │
│   Snap to increments: 0.5 kN for point loads                       │
│   Release: value committed, undo point created                      │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 21.14 Micro-Interactions Summary Table

| Interaction | Trigger | Animation | Duration | Easing |
|-------------|---------|-----------|----------|--------|
| Button hover | mouseenter | bg color shift, translateY -1px | 150ms | ease-out |
| Button press | mousedown | scale 0.98, translateY 0 | 75ms | ease-in |
| Input focus | focus | border → blue, ring glow | 200ms | ease-out |
| Input error | validation | shake 4px, border → red | 300ms | ease-in-out |
| Checkbox toggle | click | check draws via stroke-dashoffset | 200ms | ease-out |
| Switch toggle | click | thumb slides, bg fills | 200ms | ease-spring |
| Slider drag | drag | thumb follows, track fills | 0ms (live) | — |
| Tooltip show | hover 800ms | opacity 0→1, translateY 4→0 | 150ms | ease-out |
| Tooltip hide | mouseleave | opacity 1→0 | 100ms | ease-in |
| Accordion open | click | height 0→auto, chevron rotate 180° | 250ms | ease-in-out |
| Accordion close | click | height auto→0, chevron rotate 0° | 200ms | ease-in-out |
| Badge count change | value update | scale 1→1.3→1, bg flash | 300ms | ease-spring |
| Command palette | Ctrl+K | scaleY 0.95→1, opacity, backdrop | 200ms | ease-out |
| Mini-map highlight | hover region | region outline pulses | 1000ms | linear infinite |
| Copy confirmation | click copy | icon → checkmark → icon | 1500ms | step |
| Scroll to top | click button | scrollY → 0 | 500ms | ease-in-out |
| Progress ring | analysis | stroke-dashoffset decreases | live | linear |
| Confetti | milestone | 40 particles, gravity, fade | 2000ms | physics-based |
