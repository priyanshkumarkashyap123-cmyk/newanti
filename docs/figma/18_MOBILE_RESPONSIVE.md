# 18 — Mobile & Responsive
## BeamLab Ultimate Figma Specification

---

## 18.1 Responsive Breakpoints

```
Breakpoints:
  Desktop:  ≥ 1280px  (full workspace experience)
  Laptop:   1024-1279px (compact workspace, collapsible panels)
  Tablet:   768-1023px  (simplified workspace, bottom sheets)
  Mobile:   < 768px     (viewer mode + limited editing)

Frame sizes for Figma:
  Desktop XL:  1920 × 1080
  Desktop:     1440 × 900
  Laptop:      1280 × 800
  Tablet:      1024 × 768  (landscape)
  Tablet Port: 768 × 1024  (portrait)
  Mobile:      390 × 844   (iPhone 14)
  Mobile SM:   375 × 812   (iPhone 13 mini)
```

---

## 18.2 Tablet Layout (1024 × 768)

```
┌───────────────────────────────────────────────────────────────────┐
│ ☰  BeamLab  │ Project Name        │ [▶ Run] [👤] │   Header    │
├─────────────┴─────────────────────┴──────────────┴──────────────┤
│                                                                   │
│ ┌─── Toolbar (horizontal, scrollable) ──────────────────────────┐│
│ │ [Node][Membr][Grid][Sect][Supp][Load][Anal][Reslt][Dsgn]    ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                   │
│ ┌────────────────────────────────────────────┐ ┌────────────────┐│
│ │                                            │ │ Properties     ││
│ │              3D Viewport                   │ │                ││
│ │           (touch-enabled)                  │ │ Node N5        ││
│ │                                            │ │ X: 6.000       ││
│ │    Pinch to zoom                           │ │ Y: 3.500       ││
│ │    Two-finger rotate                       │ │ Z: 0.000       ││
│ │    Swipe to pan                            │ │                ││
│ │                                            │ │ [Edit]         ││
│ │                                            │ │                ││
│ │                                            │ │ Forces (C1):   ││
│ │                                            │ │ Fx: 0.0 kN     ││
│ │                                            │ │ Fy: -50.0 kN   ││
│ │                                            │ │ Fz: 0.0 kN     ││
│ │ ┌────────┐                                 │ │                ││
│ │ │ViewCube│                                 │ │                ││
│ │ └────────┘                                 │ │                ││
│ └────────────────────────────────────────────┘ └────────────────┘│
│                                                                   │
│ ┌─── Status Bar ────────────────────────────────────────────────┐│
│ │ Selection: 1 node │ Units: kN, m │ Snap: ✓ │ Grid: 1.0m    ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

Tablet adaptations:
  - Side sidebar collapses behind hamburger menu ☰
  - Properties panel: slide-in from right (240px wide)
  - Toolbar: single-row horizontal scroll instead of ribbon
  - 3D viewport: touch gestures enabled
  - Dialogs: use bottom sheets instead of centered modals
  - Double-tap to select element
  - Long-press for context menu
```

---

## 18.3 Mobile Layout (390 × 844)

### Mobile Dashboard
```
┌──────────────────────────────────┐
│ ┌──────────────────────────────┐ │
│ │ BeamLab         [🔔] [👤]   │ │
│ └──────────────────────────────┘ │
│                                  │
│ Welcome back, Rakshit            │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ 🔍 Search projects...       │ │
│ └──────────────────────────────┘ │
│                                  │
│ Recent Projects                  │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ 🏗️ 8-Storey RC Frame       │ │
│ │ Last edited: 2 hours ago    │ │
│ │ 24 nodes, 32 members        │ │
│ │ Status: ✅ Analysis complete│ │
│ │                    [Open →]  │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ 🏢 Industrial Warehouse     │ │
│ │ Last edited: 3 days ago     │ │
│ │ 12 nodes, 18 members        │ │
│ │ Status: Draft               │ │
│ │                    [Open →]  │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ 🌉 Pedestrian Bridge        │ │
│ │ Last edited: 1 week ago     │ │
│ │ 8 nodes, 14 members         │ │
│ │ Status: ✅ Designed         │ │
│ │                    [Open →]  │ │
│ └──────────────────────────────┘ │
│                                  │
│ [+ New Project]                  │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ 🏠   📊   ➕   🤖   ⚙️    │ │
│ │ Home Proj  New  AI  Settings│ │
│ └──────────────────────────────┘ │
│                                  │
└──────────────────────────────────┘
```

### Mobile 3D Viewer
```
┌──────────────────────────────────┐
│ ← 8-Storey RC Frame  [⋮]       │
├──────────────────────────────────┤
│                                  │
│ ┌──────────────────────────────┐ │
│ │                              │ │
│ │     3D Viewport              │ │
│ │     (full width)             │ │
│ │                              │ │
│ │     Touch gestures:          │ │
│ │     • 1 finger: orbit       │ │
│ │     • 2 fingers: pan        │ │
│ │     • Pinch: zoom           │ │
│ │     • Tap: select           │ │
│ │     • Long press: context   │ │
│ │                              │ │
│ │     ┌──────┐                 │ │
│ │     │ Cube │                 │ │
│ │     └──────┘                 │ │
│ │                              │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ View: [Model ▾]             │ │
│ │                              │ │
│ │ [BMD][SFD][AFD][Def][React] │ │
│ │                              │ │
│ │ LC: [C1: 1.5DL+1.5LL ▾]   │ │
│ └──────────────────────────────┘ │
│                                  │
│ ── Selected: Member M12 ──      │
│ ┌──────────────────────────────┐ │
│ │ Section: ISMB 300            │ │
│ │ Mz: 185.3 kN·m | Vy: 65.3kN│ │
│ │ UR: 0.72 ✅                 │ │
│ │        [View Details ▾]     │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ 🏠  👁  📊  📋  💬        │ │
│ │Home View Rslt Rprt Chat     │ │
│ └──────────────────────────────┘ │
│                                  │
└──────────────────────────────────┘
```

### Mobile Bottom Sheet (Properties)
```
┌──────────────────────────────────┐
│                                  │
│     [3D viewport visible         │
│      above the bottom sheet]     │
│                                  │
├──────── drag handle ─────────────┤
│ ════════════════════════         │
│                                  │
│ Member M12 — ISMB 300            │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ Properties │ Forces │ Design │ │
│ └──────────────────────────────┘ │
│                                  │
│ Section:  ISMB 300               │
│ Material: Fe 345                 │
│ Length:   5.000 m                │
│ Start:   N3 (0, 3.5, 0)        │
│ End:     N5 (6, 3.5, 0)        │
│                                  │
│ Beta Angle: 0°                   │
│ Releases: Fixed — Fixed          │
│ Offset: None                     │
│                                  │
│ [Edit Section]  [Edit Material]  │
│                                  │
└──────────────────────────────────┘

Bottom sheet behavior:
  Three snap points:
    • Peek (100px) — shows summary line
    • Half (50% screen) — shows key properties
    • Full (90% screen) — shows all details + scrollable
  Drag handle: 40×4px rounded bar, centered, slate-500
  Backdrop: viewport above dims slightly when sheet is open
  Swipe down from peek = dismiss
```

---

## 18.4 Touch Interaction Patterns

```
Touch Gestures for 3D Viewport:
───────────────────────────────

Single Tap:
  Select nearest node/member
  Deselect if tapping empty space
  Haptic feedback: light tap

Double Tap:
  Zoom to selected element
  If nothing selected: zoom to fit all

Long Press (500ms):
  Context menu appears
  Haptic feedback: medium impact
  Menu slides up from bottom as action sheet

One Finger Drag:
  Orbit camera (rotate around model center)
  Sensitivity: adjustable in settings

Two Finger Drag:
  Pan camera (move view)

Pinch (Two Fingers):
  Zoom in/out
  Smooth interpolation

Three Finger Tap:
  Undo last action

Two Finger Tap:
  Redo

Swipe from Left Edge:
  Open navigation/tools drawer

Swipe from Right Edge:
  Open properties sheet

Force Touch / 3D Touch (if available):
  Preview element properties (peek)
  Press deeper: full property view (pop)
```

---

## 18.5 Mobile-Specific Components

### Action Sheet (replaces context menu)
```
┌──────────────────────────────────┐
│                                  │
│ [dimmed viewport behind]         │
│                                  │
├──────── drag handle ─────────────┤
│ ════════════════════════         │
│                                  │
│ Member M12                       │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ 📊 View Forces              │ │
│ ├──────────────────────────────┤ │
│ │ ✏️ Edit Properties          │ │
│ ├──────────────────────────────┤ │
│ │ 📐 Change Section           │ │
│ ├──────────────────────────────┤ │
│ │ 🔗 View Connections         │ │
│ ├──────────────────────────────┤ │
│ │ 📋 Copy to Clipboard        │ │
│ ├──────────────────────────────┤ │
│ │ 🗑 Delete Member            │ │
│ └──────────────────────────────┘ │
│                                  │
│ ┌──────────────────────────────┐ │
│ │           Cancel             │ │
│ └──────────────────────────────┘ │
│                                  │
└──────────────────────────────────┘
```

### Mobile Toast Notification
```
┌──────────────────────────────────┐
│                                  │
│ ┌──────────────────────────────┐ │
│ │ ✅ Analysis complete (2.4s) │ │
│ │        [View Results]       │ │
│ └──────────────────────────────┘ │
│                                  │
│     [rest of screen below]       │
│                                  │
└──────────────────────────────────┘

Position: top of screen, 16px margin
Duration: 4 seconds (or tap to dismiss)
Swipe up to dismiss
Background: slate-800 with 1px border
Shadow: elevation-3
```
