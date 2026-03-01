# 07 — Geometry & Modeling Tools
## BeamLab Ultimate Figma Specification

---

## 7.1 Node Creation Mode

### Active Mode Indicator
```
When "Add Node" is active:
┌──────────────────────────────────────────────────────────────────────┐
│ ● Adding Nodes — Click viewport to place, or enter coordinates     │
│   [Tab] between X/Y/Z  │  [Enter] confirm  │  [Esc] cancel        │
└──────────────────────────────────────────────────────────────────────┘
Position: top of viewport, full-width banner
bg: primary/10, border: 1px primary/20
Text: 13px, text-primary
Height: 32px
Animation: slideDown 200ms on enter
```

### Crosshair Cursor
```
When in node placement mode:
  Cursor: crosshair (CSS)
  Snap indicator: dotted circle (r=8px) at snap points
  Snap line: dashed line from cursor to nearest axis/grid
  Ghost node: semi-transparent cyan dot at cursor position
  Coordinate readout: floating label near cursor showing X, Y, Z
  
  ┌── Ghost node ──┐
  │    · (cyan 50%) │  + coord label: "5.000, 0.000, 3.000"
  └─────────────────┘
```

### Node Display Styles
```
Default node:     ● 6px, fill: #22d3ee (cyan)
Selected node:    ● 8px, fill: #3b82f6 (primary), ring: 2px primary glow
Hover node:       ● 8px, fill: #22d3ee, ring: 1px primary/50
Supported node:   ▲ (fixed), ● on ▽ (pinned), ● on ○ (roller)
Spring support:   ● on ⏜⏜ (zigzag spring symbol)
New/unsaved node: ● 6px, fill: #22c55e (green, pulsing)
Error node:       ● 6px, fill: #ef4444 (red), ring: 2px red glow
```

---

## 7.2 Member Creation Mode

### Two-Click Member
```
Step 1: Click start node (or point)
  → Start node highlights blue
  → Elastic rubber-band line follows cursor

Step 2: Click end node (or point)
  → Member created with preview
  → Auto-creates nodes at endpoints if needed
  → Status: "Member M4 created (N2 → N5, length = 4.500 m)"

Visual Feedback:
  ┌─────────────────────────────────┐
  │    N1 ●──────────── · cursor   │
  │    (blue)  (dashed line, 1px)  │
  │           (length shown: 4.5m) │
  └─────────────────────────────────┘
  
  Rubber-band line: dashed 1px primary/50
  Length label: floating, 11px mono, bg-surface-dark/80
```

### Member Display Styles
```
Default member:     ── 2px, stroke: #94a3b8 (slate-400)
Selected member:    ── 3px, stroke: #3b82f6 (primary), glow
Hover member:       ── 3px, stroke: #60a5fa (primary-400)
Beam:               ── 2px solid
Column:             ── 2px solid (rendered vertically)
Brace:              ── 2px dashed
Cable:              ── 2px, catenary curve
Plate edge:         ── 1px, stroke: #8b5cf6 (purple)

With section rendering (optional):
  I-section shown as filled outline around centerline
  Opacity: 0.3
  Fill: primary/10
  Stroke: primary/30
```

---

## 7.3 Grid Generation Dialog

```
┌───────────────────────────────────────────────────────────────────┐
│ Generate Grid / Structure                                   [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Structure Type:                                                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │ ┌──┬──┐ │ │ △△△△△ │ │ ┌──┐   │ │   ┌──┐  │ │ ══════ │  │
│  │ │  │  │ │ │  Truss  │ │ │  │   │ │   │  │  │ │ Contin │  │
│  │ ├──┼──┤ │ │         │ │ Portal│ │ │ Multi│ │ │ uous   │  │
│  │ │  │  │ │ │         │ │ Frame │ │ │ Bay  │ │ │ Beam   │  │
│  │ └──┴──┘ │ │         │ │       │ │ │      │ │ │        │  │
│  │ Building│ │         │ │       │ │ │      │ │ │        │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
│                                                                   │
│  ── Grid Parameters ──                                           │
│                                                                   │
│  Number of Bays (X): [  3  ]     Bay Width: [ 6.000 ] m         │
│  Number of Stories:  [  5  ]     Story Ht:  [ 3.500 ] m         │
│  Number of Bays (Z): [  2  ]     Bay Depth: [ 5.000 ] m         │
│                                                                   │
│  ☑ Equal bay widths                                              │
│  ☐ Custom bay widths:                                            │
│     Bay 1: [6.0]  Bay 2: [6.0]  Bay 3: [6.0] m                │
│                                                                   │
│  ☑ Equal story heights                                           │
│  ☐ Custom story heights:                                        │
│     Story 1: [4.0]  Story 2: [3.5]  Story 3: [3.5] m           │
│                                                                   │
│  ── Options ──                                                   │
│  ☑ Add fixed supports at base                                   │
│  ☑ Auto-assign default section                                  │
│  ☐ Add bracing (X-brace pattern)                                │
│  ☐ Add floor plates                                             │
│  ☐ Add stairwell opening                                        │
│                                                                   │
│  ── Preview ──                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                                                             │  │
│  │  ┌──┬──┬──┐                                                │  │
│  │  │  │  │  │    5-story, 3-bay building                     │  │
│  │  ├──┼──┼──┤    Nodes: 24                                   │  │
│  │  │  │  │  │    Members: 38                                 │  │
│  │  ├──┼──┼──┤    Total height: 17.5 m                        │  │
│  │  │  │  │  │    Total width: 18.0 m                         │  │
│  │  ├──┼──┼──┤                                                │  │
│  │  │  │  │  │                                                │  │
│  │  ├──┼──┼──┤                                                │  │
│  │  │  │  │  │                                                │  │
│  │  ▲──▲──▲──▲                                                │  │
│  │                                                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                    [Cancel]   [Generate Structure →]             │
└───────────────────────────────────────────────────────────────────┘

Preview: Live 2D wireframe preview updating as parameters change
Width: 720px dialog
Responsive preview on the right (or below on smaller screens)
```

---

## 7.4 Structure Wizard (AI-Enhanced)

```
┌───────────────────────────────────────────────────────────────────┐
│ Structure Wizard                                            [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Step 1 of 4: [●──●──○──○] Structure Type                       │
│                                                                   │
│  What would you like to build?                                   │
│                                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ 🏢       │ │ 🏭       │ │ 🌉       │ │ △        │           │
│  │ Building │ │ Industrial│ │ Bridge   │ │ Truss    │           │
│  │          │ │ Shed      │ │          │ │          │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ 🗼       │ │ 🏗       │ │ 💧       │ │ 🤖       │           │
│  │ Tower    │ │ Retaining│ │ Water    │ │ AI Gen   │           │
│  │          │ │ Wall     │ │ Tank     │ │ (Custom) │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                   │
│  ── Or describe in natural language: ──                          │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │ "5-story residential building with 3 bays of 6m each,     │  │
│  │  story height 3.5m, fixed base, seismic zone IV"           │  │
│  └─────────────────────────────────────────────────────────────┘  │
│  [🤖 Generate with AI]                                           │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│           [Cancel]              [Next: Dimensions →]             │
└───────────────────────────────────────────────────────────────────┘

Step 2: Dimensions (numeric inputs for span, height, bays, etc.)
Step 3: Properties (default section, material, supports)
Step 4: Preview & Confirm (3D preview, summary table, [Create] button)
```

---

## 7.5 Snap & Grid Settings Panel

```
Click grid icon in status bar:
┌──────────────────────────────────────────┐
│ Grid & Snap Settings                     │
├──────────────────────────────────────────┤
│                                          │
│ Grid Display    [═══●] ON               │
│ Grid Spacing:   [ 1.000 ] m             │
│ Grid Type:      [Rectangular ▾]         │
│                 ○ Rectangular            │
│                 ○ Polar                  │
│                 ○ Custom                 │
│ Grid Color:     [█] opacity: [30%]      │
│                                          │
│ ── Snap ──                              │
│ Snap to Grid    [═══●] ON              │
│ Snap Distance:  [ 0.500 ] m            │
│ ☑ Snap to Nodes                        │
│ ☑ Snap to Midpoints                    │
│ ☐ Snap to Intersections               │
│ ☑ Snap to Endpoints                    │
│ ☐ Snap to Perpendicular               │
│                                          │
│ ── Display ──                           │
│ ☑ Show Grid Lines                      │
│ ☑ Show Axis Labels                     │
│ ☑ Show Dimensions                      │
│ ☐ Show Member Numbers                 │
│ ☐ Show Node Numbers                   │
│ ☑ Show Section Outlines               │
│                                          │
│ [Reset to Defaults]                      │
└──────────────────────────────────────────┘

Position: popover from status bar
Width: 300px
bg: surface-dark, border: border-dark
shadow: elevation-3
```

---

## 7.6 Selection Panel

### Multi-Select Info
```
When multiple items selected:
┌──────────────────────────────────┐
│ Selection (5 items)       [✕]   │
├──────────────────────────────────┤
│                                  │
│ ☑ M1 — ISMB 200, Beam, 6.0m   │
│ ☑ M2 — ISMB 200, Column, 3.5m │
│ ☑ M3 — ISMB 200, Beam, 6.0m   │
│ ☑ M4 — ISMB 200, Column, 3.5m │
│ ☑ M5 — ISMB 200, Beam, 6.0m   │
│                                  │
│ ── Bulk Actions ──              │
│ Section: [ISMB 200 ▾] [Apply]  │
│ Material:[Fe 345  ▾]  [Apply]  │
│                                  │
│ [Delete All]  [Deselect All]    │
│                                  │
└──────────────────────────────────┘
```

---

## 7.7 Plate Element Creation

```
Click 4 nodes to define plate:
  Step 1: Click node 1 → highlighted
  Step 2: Click node 2 → edge drawn
  Step 3: Click node 3 → triangle shown
  Step 4: Click node 4 → quad plate shown
  
Plate Display:
  Fill: rgba(139,92,246,0.1) — purple tint
  Outline: 1px #8b5cf6
  Selected: fill rgba(59,130,246,0.15), outline 2px #3b82f6
  Mesh overlay: thin grid lines within plate

Plate Properties Panel:
┌──────────────────────────────────┐
│ Plate P1                         │
│                                  │
│ Type: [Shell ▾]                 │
│   ○ Membrane (in-plane only)    │
│   ○ Plate (bending only)       │
│   ● Shell (membrane + bending) │
│                                  │
│ Thickness: [ 200 ] mm           │
│ Material: [M30 Concrete ▾]     │
│                                  │
│ Mesh Size: [ 500 ] mm           │
│ Mesh Type: [Quad ▾]            │
│ [Auto-Mesh]  [Preview Mesh]     │
│                                  │
│ Nodes: N1, N2, N3, N4          │
│ Area: 30.00 m²                  │
└──────────────────────────────────┘
```

---

## 7.8 Measurement Tool

```
Active Measurement Mode:
┌──────────────────────────────────────────────────────┐
│  Click two points to measure distance                │
│  [Esc to cancel]                                     │
└──────────────────────────────────────────────────────┘

Display:
  N1 ●──────── 6.000 m ────────● N2
      ← dimension line with arrows →
      
  Angle measurement:
          / 45.0°
  N1 ●──/──────● N3
       ╲
        ╲──────● N2

Measurement Popup:
┌──────────────────────────────────┐
│ Distance: 6.000 m               │
│ ΔX: 6.000 m  ΔY: 0.000 m      │
│ ΔZ: 0.000 m                    │
│ Angle (XZ): 0.0°               │
│                                  │
│ [Copy] [Add Dimension]          │
└──────────────────────────────────┘
```

---

## 7.9 Edit Operations

### Move Mode
```
Active: "Move" tool selected
  1. Select entities
  2. Click base point
  3. Click destination or enter displacement

  Displacement Input:
  ┌──────────────────────────────────────┐
  │ Move Selected (3 members)            │
  │ ΔX: [ 2.000 ] m                     │
  │ ΔY: [ 0.000 ] m                     │
  │ ΔZ: [ 0.000 ] m                     │
  │ ☐ Copy (keep original)              │
  │ [Apply]                              │
  └──────────────────────────────────────┘
  
  Visual: ghost outline of entities at new position
  Ghost style: dashed, primary/30
```

### Copy / Mirror / Rotate
```
Mirror Dialog:
┌──────────────────────────────────────┐
│ Mirror Selected                      │
│ Mirror Plane:                        │
│ ○ X-Z Plane (mirror about Y)       │
│ ● X-Y Plane (mirror about Z)       │
│ ○ Y-Z Plane (mirror about X)       │
│ ○ Custom plane                      │
│ ☑ Copy (keep original)             │
│ [Apply]                              │
└──────────────────────────────────────┘

Rotate Dialog:
┌──────────────────────────────────────┐
│ Rotate Selected                      │
│ Center: N1 (0, 0, 0) [Pick]        │
│ Axis: [Z ▾]                        │
│ Angle: [ 90.0 ] degrees            │
│ Copies: [ 3 ] (0 = just rotate)    │
│ [Apply]                              │
└──────────────────────────────────────┘

Array Dialog:
┌──────────────────────────────────────┐
│ Linear Array                         │
│ Direction: [X ▾]                    │
│ Spacing: [ 6.000 ] m               │
│ Count: [ 4 ]                        │
│                                      │
│ Preview:                             │
│ ●──●──●──●──●                       │
│ (original + 4 copies)               │
│ [Apply]                              │
└──────────────────────────────────────┘
```
