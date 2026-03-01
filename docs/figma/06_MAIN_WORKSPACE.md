# 06 — Main Workspace (Modeler)
## BeamLab Ultimate Figma Specification

---

## 6.1 Complete Workspace Layout

### Desktop HD (1920×1080)
```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 🏗 BeamLab │ Office Building v2 │ ★ │ ↩ Undo │ ↪ Redo │          │ [👥 2] [🔔] [👤] [⚙]    │ A
├──────┬─────┴─────────────────────────────────────────────────────────────┬────────────────────────┤
│      │  [Geometry] [Properties] [Loading] [Analysis] [Design] [Civil]   │                        │ B
│      ├──────────────────────────────────────────────────────────────────┤                        │
│      │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ │ ┌─────┐  │   PROPERTIES PANEL     │ C
│ WORK │  │Node │ │Memb │ │Plate│ │Grid │ │Snap │ │Meas │ │ │Wizard│  │                        │
│ FLOW │  │     │ │     │ │     │ │Gen  │ │     │ │ure  │ │ │     │  │   ── Selected: M1 ──   │
│ SIDE │  │ 🔵  │ │ 🟢  │ │ 🟣  │ │ ⊞  │ │ 🧲  │ │ 📏  │ │ │ 🪄  │  │   Member: M1           │
│ BAR  │  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ └─────┘ │ └─────┘  │   Start: N1 (0,0,0)    │
│      │  [Node] [Beam] [Column] [Supp] [Move] [Copy] [Del]│ [AI Gen] │   End: N2 (6,0,0)      │
│ 192px│──────────────────────────────────────────────────────│──────────│   Length: 6.000 m       │
│      │                                                      │          │                        │
│ Cat  │                                                      │          │   ── Section ──        │
│ egor │            3D VIEWPORT                               │   280px  │   [ISMB 200 ▾]        │
│ ies: │            (Three.js Canvas)                          │          │   Area: 32.33 cm²      │
│      │                                                      │          │   Ix: 2235.4 cm⁴       │
│ 📐   │    ┌──────────────────────────────────────────┐      │          │   Zx: 223.5 cm³        │
│ Geom │    │                                          │      │          │                        │
│      │    │     N2──────────────M1──────────────N3   │      │          │   ── Material ──       │
│ 🔧   │    │     │                               │   │      │          │   [Fe 345 ▾]           │
│ Prop │    │     │M2                           M3│   │   ⊕  │          │   E: 200000 MPa        │
│      │    │     │                               │   │   ⊖  │          │   fy: 345 MPa          │
│ 📦   │    │     │                               │   │   🏠 │          │                        │
│ Load │    │     N1▲────────────────────────────▲N4   │   📐 │          │   ── Releases ──       │
│      │    │    ///                            ///  │   🎯 │          │   Start: [Fixed ▾]     │
│ 📊   │    │                                          │      │          │   End: [Pinned ▾]      │
│ Anal │    └──────────────────────────────────────────┘      │          │                        │
│      │                                                      │          │   ── Offset ──         │
│ 🔩   │    ┌──────┐  Modeling Toolbar (floating left)       │          │   X: [0.000] m         │
│ Dsgn │    │ ↖ Sel│  ┌──────────────────────┐               │          │   Y: [0.000] m         │
│      │    │ ⊕ Add│  │ X: 3.45  Y: 0.00    │ Coord Bar    │          │   Z: [0.000] m         │
│ 🏗   │    │ ✂ Cut│  │ Z: 2.10  m          │ (bottom)     │          │                        │
│ Civil│    │ 📋 Cp│  └──────────────────────┘               │          │   [Apply Changes]      │
│      │    │ 📐 Ms│                                          │          │                        │
│      │    │ 🔄 Rt│  ┌────────────┐ MiniMap (corner)        │          │                        │
│      │    └──────┘  │ ┌──┐ ·  · │                          │          │                        │
│      │              │ │  │  · · │                          │          │                        │
│      │              │ └──┘    · │                          │          │                        │
│      │              └────────────┘                          │          │                        │
│      │                                                      │          │                        │
│      │  ViewCube ┌─────┐                                   │          │                        │
│      │  (top-R)  │ TOP │                                   │          │                        │
│      │           └─────┘                                   │          │                        │
├──────┴──────────────────────────────────────────────────────┴──────────┴────────────────────────┤
│ Ready │ Nodes: 4 │ Members: 3 │ Loads: 2 │ Units: kN, m │ Snap: ON │ Grid: 1m │ Zoom: 100% │ D
└──────────────────────────────────────────────────────────────────────────────────────────────────┘

ZONE LABELS:
A = Header Bar (36px)
B = Ribbon Tab Bar (32px)  
C = Ribbon Tool Panels (80-100px)
D = Status Bar (24px)
```

---

## 6.2 Header Bar (Zone A) — Detail

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ 🏗 BeamLab │ Office Building v2 ▾ │ ★ │ ↩│↪│ ┃ │🔍│💬│ ┃ │[👥 2]│[🔔 3]│[👤▾]│[⚙]│
└──────────────────────────────────────────────────────────────────────────────────┘

Elements (left to right):
1. Logo: 🏗 BeamLab — 20px Space Grotesk bold, click → dashboard
2. Project Name: editable text, 14px, text-primary, click → rename
3. Favorite Star: toggle, gold when active
4. Undo/Redo: icon buttons, disabled when stack empty, tooltip with action name
5. Separator: 1px vertical line, border-subtle, h-4
6. Search: magnifier icon → opens command palette
7. Chat: 💬 icon → opens AI chat panel
8. Separator
9. Collaborators: avatar stack (overlapping 24px circles), "+2" badge
10. Notifications: bell with red dot badge
11. User avatar: 28px circle, dropdown
12. Settings: gear icon

Height: 36px
bg: #0f172a (slightly darker than workspace)
border-bottom: 1px border-subtle
All icons: 16px, text-muted, hover: text-primary
```

---

## 6.3 Ribbon Toolbar (Zone B+C) — Detail

### Tab Bar (Zone B)
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  [Geometry]  [Properties]  [Loading]  [Analysis]  [Design]  [Civil Engg]       │
└──────────────────────────────────────────────────────────────────────────────────┘

Active Tab:
  bg: surface-elevated
  border-top: 2px [tab-color] (Geometry=blue, Properties=purple, Loading=orange, 
                                Analysis=emerald, Design=rose, Civil=amber)
  text: text-primary, 13px medium
  
Inactive Tab:
  bg: transparent
  text: text-muted
  hover: text-secondary, bg surface-dark
  
Tab bar height: 32px
```

### Geometry Tab Content (Zone C)
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ╔═══════════════╗ ╔══════════════╗ ╔═══════════════╗ ╔════════════╗ ╔════════╗ │
│ ║ CREATE        ║ ║ EDIT         ║ ║ GENERATE      ║ ║ VIEW       ║ ║ TOOLS  ║ │
│ ║               ║ ║              ║ ║               ║ ║            ║ ║        ║ │
│ ║ ┌────┐┌────┐ ║ ║ ┌────┐┌────┐║ ║ ┌────┐ ┌────┐║ ║ ┌────┐    ║ ║ ┌────┐ ║ │
│ ║ │Node││Memb│ ║ ║ │Move││Copy│║ ║ │Grid │ │Wiz │║ ║ │Zoom│    ║ ║ │Meas│ ║ │
│ ║ │ 🔵 ││ 🟢 │ ║ ║ │ ↔  ││ 📋 │║ ║ │ ⊞  │ │ 🪄 │║ ║ │ 🔍 │    ║ ║ │ 📏 │ ║ │
│ ║ └────┘└────┘ ║ ║ └────┘└────┘║ ║ └────┘ └────┘║ ║ └────┘    ║ ║ └────┘ ║ │
│ ║ ┌────┐┌────┐ ║ ║ ┌────┐┌────┐║ ║ ┌────┐ ┌────┐║ ║ ┌────┐    ║ ║ ┌────┐ ║ │
│ ║ │Plat││Supp│ ║ ║ │Undo││Dele│║ ║ │Auto │ │Mesh│║ ║ │Pan │    ║ ║ │Snap│ ║ │
│ ║ │ 🟣 ││ 🔺 │ ║ ║ │ ↩  ││ 🗑 │║ ║ │Mesh│ │Edit│║ ║ │ ✋ │    ║ ║ │ 🧲 │ ║ │
│ ║ └────┘└────┘ ║ ║ └────┘└────┘║ ║ └────┘ └────┘║ ║ └────┘    ║ ║ └────┘ ║ │
│ ╚═══════════════╝ ╚══════════════╝ ╚═══════════════╝ ╚════════════╝ ╚════════╝ │
└──────────────────────────────────────────────────────────────────────────────────┘

Tool Button (Large - 56×56px):
  bg: transparent, radius: 8px
  Icon: 24px centered at top
  Label: 10px below icon, text-muted
  Hover: bg-surface-elevated, border: 1px border-dark
  Active: bg-primary/15, border: 1px primary/30, text-primary
  Disabled: opacity 0.4

Group:
  Label: 10px uppercase, text-muted, centered below button row
  Separator: 1px vertical line between groups, h-[80%]

Panel height: 100px (80px buttons + labels)
```

### Properties Tab Content
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ╔════════════════╗ ╔══════════════════╗ ╔════════════════╗ ╔═════════════════╗  │
│ ║ SECTIONS       ║ ║ MATERIALS        ║ ║ SUPPORTS       ║ ║ MEMBER OPTIONS  ║  │
│ ║                ║ ║                  ║ ║                ║ ║                 ║  │
│ ║ ┌────┐ ┌────┐ ║ ║ ┌────┐  ┌────┐  ║ ║ ┌────┐ ┌────┐║ ║ ┌────┐  ┌────┐ ║  │
│ ║ │Assi││Sect│ ║ ║ │Assi│  │Matl │  ║ ║ │Fix ││Pin │║ ║ │Rele│  │Offs│ ║  │
│ ║ │gn  ││DB  │ ║ ║ │gn  │  │DB   │  ║ ║ │    ││    │║ ║ │ases│  │ets │ ║  │
│ ║ │ 📐 ││ 📚 │ ║ ║ │ 🎨 │  │ 📖  │  ║ ║ │ 🔺 ││ 📌 │║ ║ │ 🔗 │  │ ↕  │ ║  │
│ ║ └────┘ └────┘ ║ ║ └────┘  └────┘  ║ ║ └────┘ └────┘║ ║ └────┘  └────┘ ║  │
│ ║ ┌────┐ ┌────┐ ║ ║ ┌────┐          ║ ║ ┌────┐ ┌────┐║ ║ ┌────┐         ║  │
│ ║ │Edit││Cust│ ║ ║ │Cust│          ║ ║ │Roll││Spri│║ ║ │Rigid│         ║  │
│ ║ │Sect││om  │ ║ ║ │om  │          ║ ║ │er  ││ng  │║ ║ │Link │         ║  │
│ ║ │ ✏️ ││ ➕ │ ║ ║ │ ➕  │          ║ ║ │ ◯  ││ 🔩 │║ ║ │ ═   │         ║  │
│ ║ └────┘ └────┘ ║ ║ └────┘          ║ ║ └────┘ └────┘║ ║ └────┘         ║  │
│ ╚════════════════╝ ╚══════════════════╝ ╚════════════════╝ ╚═════════════════╝  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Loading Tab Content
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ╔════════════════╗ ╔══════════════╗ ╔═══════════════════╗ ╔═════════════════╗   │
│ ║ LOAD CASES     ║ ║ APPLY LOADS  ║ ║ LOAD COMBINATIONS ║ ║ CODE-BASED      ║   │
│ ║                ║ ║              ║ ║                   ║ ║                 ║   │
│ ║ ┌────┐ ┌────┐ ║ ║ ┌────┐┌────┐║ ║ ┌────┐  ┌────┐   ║ ║ ┌────┐  ┌────┐ ║   │
│ ║ │New ││Edit│ ║ ║ │Poin││UDL │║ ║ │New │  │Auto │   ║ ║ │Seis│  │Wind│ ║   │
│ ║ │Case││Case│ ║ ║ │t   ││    │║ ║ │Comb│  │Gen  │   ║ ║ │mic │  │    │ ║   │
│ ║ │ 📋 ││ ✏️ │ ║ ║ │ ⬇  ││ ▬  │║ ║ │ ➕  │  │ 🤖  │   ║ ║ │ 🌊 │  │ 💨 │ ║   │
│ ║ └────┘ └────┘ ║ ║ └────┘└────┘║ ║ └────┘  └────┘   ║ ║ └────┘  └────┘ ║   │
│ ║ ┌────┐        ║ ║ ┌────┐┌────┐║ ║ ┌────┐           ║ ║ ┌────┐  ┌────┐ ║   │
│ ║ │Mana││       ║ ║ │Mome││Self│║ ║ │IS875│           ║ ║ │Dead│  │Live│ ║   │
│ ║ │ge  ││       ║ ║ │nt  ││Wt │║ ║ │     │           ║ ║ │Load│  │Load│ ║   │
│ ║ │ 📊 ││       ║ ║ │ ↻  ││ ⊕ │║ ║ │ 📖  │           ║ ║ │ ⬇  │  │ 👤 │ ║   │
│ ║ └────┘        ║ ║ └────┘└────┘║ ║ └────┘           ║ ║ └────┘  └────┘ ║   │
│ ╚════════════════╝ ╚══════════════╝ ╚═══════════════════╝ ╚═════════════════╝   │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Analysis Tab Content
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ╔═══════════════╗ ╔═══════════════════╗ ╔══════════════════╗ ╔════════════════╗ │
│ ║ RUN           ║ ║ ANALYSIS TYPE     ║ ║ ADVANCED         ║ ║ RESULTS        ║ │
│ ║               ║ ║                   ║ ║                  ║ ║                ║ │
│ ║ ┌──────────┐  ║ ║ ┌────┐  ┌────┐   ║ ║ ┌────┐  ┌────┐  ║ ║ ┌────┐ ┌────┐ ║ │
│ ║ │▶ RUN     │  ║ ║ │Line││Modal│   ║ ║ │P-Δ │  │Buck│  ║ ║ │View││Table║ │
│ ║ │ ANALYSIS │  ║ ║ │ar  ││     │   ║ ║ │    │  │ling│  ║ ║ │Res ││     │ ║ │
│ ║ │          │  ║ ║ │ 📊 ││ 🎵  │   ║ ║ │ 📈 │  │ ⚡ │  ║ ║ │ 📋 ││ 📊  │ ║ │
│ ║ │  Ctrl+↵  │  ║ ║ └────┘  └────┘   ║ ║ └────┘  └────┘  ║ ║ └────┘ └────┘ ║ │
│ ║ └──────────┘  ║ ║ ┌────┐  ┌────┐   ║ ║ ┌────┐  ┌────┐  ║ ║ ┌────┐ ┌────┐ ║ │
│ ║               ║ ║ │Seis││Dynm│   ║ ║ │Nonl│  │Push│  ║ ║ │Diag││Anim│ ║ │
│ ║               ║ ║ │mic ││ic  │   ║ ║ │near│  │over│  ║ ║ │ram ││ate │ ║ │
│ ║               ║ ║ │ 🌊 ││ ⏱  │   ║ ║ │ 🔄 │  │ 📉 │  ║ ║ │ 📈 ││ 🎬 │ ║ │
│ ║               ║ ║ └────┘  └────┘   ║ ║ └────┘  └────┘  ║ ║ └────┘ └────┘ ║ │
│ ╚═══════════════╝ ╚═══════════════════╝ ╚══════════════════╝ ╚════════════════╝ │
└──────────────────────────────────────────────────────────────────────────────────┘

"RUN ANALYSIS" button: 
  Large 56×80px, bg-emerald-600, text-white, pulsing border glow
  Hover: bg-emerald-500, scale(1.05)
  During analysis: spinner + progress bar replaces button
```

### Design Tab Content
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ╔═══════════════════╗ ╔════════════╗ ╔═════════════════╗ ╔═══════════════════╗  │
│ ║ STEEL DESIGN      ║ ║ RC DESIGN  ║ ║ CONNECTIONS     ║ ║ FOUNDATION        ║  │
│ ║                   ║ ║            ║ ║                 ║ ║                   ║  │
│ ║ ┌────┐  ┌────┐   ║ ║ ┌────┐    ║ ║ ┌────┐  ┌────┐ ║ ║ ┌────┐  ┌────┐   ║  │
│ ║ │IS  │  │AISC│   ║ ║ │IS  │    ║ ║ │Bolt│  │Weld│ ║ ║ │Isol│  │Comb│   ║  │
│ ║ │800 │  │360 │   ║ ║ │456 │    ║ ║ │ed  │  │ed  │ ║ ║ │ated│  │ined│   ║  │
│ ║ │ 🔩 │  │ 🔩 │   ║ ║ │ 🧱 │    ║ ║ │ 🔩 │  │ 🔥 │ ║ ║ │ 🏗 │  │ 🏗 │   ║  │
│ ║ └────┘  └────┘   ║ ║ └────┘    ║ ║ └────┘  └────┘ ║ ║ └────┘  └────┘   ║  │
│ ║ ┌────┐  ┌────┐   ║ ║ ┌────┐    ║ ║ ┌────┐         ║ ║ ┌────┐  ┌────┐   ║  │
│ ║ │Euro│  │Check│   ║ ║ │Beam│    ║ ║ │Base│         ║ ║ │Pile│  │Raft│   ║  │
│ ║ │code│  │All  │   ║ ║ │Col │    ║ ║ │Plat│         ║ ║ │    │  │    │   ║  │
│ ║ │ 🇪🇺 │  │ ✅  │   ║ ║ │Slab│    ║ ║ │ 🔩 │         ║ ║ │ 🏗 │  │ 🏗 │   ║  │
│ ║ └────┘  └────┘   ║ ║ └────┘    ║ ║ └────┘         ║ ║ └────┘  └────┘   ║  │
│ ╚═══════════════════╝ ╚════════════╝ ╚═════════════════╝ ╚═══════════════════╝  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

---

## 6.4 Workflow Sidebar — Detail

```
┌──────────┐
│ WORKFLOW │  ← 12px uppercase, text-muted, px-3, pt-3
├──────────┤
│          │
│ 📐 Geom  │  ← Active: bg-primary/10, text-primary, border-l-2 primary
│  └ Nodes │      Sub-items: 12px, text-muted, pl-8
│  └ Membs │  
│  └ Plates│
│  └ Grid  │
│          │
│ 🔧 Props │  ← Inactive: text-muted, hover: bg-surface-elevated
│  └ Sects │
│  └ Matls │
│  └ Supps │
│  └ Rlses │
│          │
│ 📦 Loads │
│  └ Cases │
│  └ Point │
│  └ Distr │
│  └ Combs │
│          │
│ 📊 Analy │
│  └ Linear│
│  └ P-Δ   │
│  └ Modal │
│  └ Seism │
│          │
│ 🔩 Design│
│  └ Steel │
│  └ RC    │
│  └ Conn  │
│  └ Found │
│          │
│ 🏗 Civil │
│  └ Quant │
│  └ BBS   │
│  └ Hydr  │
│          │
├──────────┤
│ MODEL    │  ← Model Tree (collapsible section)
│ TREE     │
│ ▼ Struct │
│   ├ N1   │  ← Individual entities
│   ├ N2   │     Click → select in viewport
│   ├ N3   │     Double-click → properties
│   ├ M1   │     Right-click → context menu
│   ├ M2   │     Drag → reorder
│   └ M3   │     Color dot: entity type
│          │
│ ▼ Loads  │
│   ├ DL   │
│   └ LL   │
│          │
│ ▼ Combos │
│   └ 1.5DL│
│     +1.5LL│
└──────────┘

Width: 192px expanded, 48px collapsed (icon-only)
Toggle: chevron button at top-right
bg: gradient sidebar (surface-dark → background-dark)
border-right: 1px border-subtle
Item height: 32px (parent), 28px (child)
Scroll: custom scrollbar
```

---

## 6.5 3D Viewport — Detail

### Viewport Overlays
```
┌──────────────────────────────────────────────────────────────────────┐
│  View: [Perspective ▾]  [XY] [XZ] [YZ] [3D]      ViewCube ┌─────┐│
│                                                              │ TOP ││
│  Model display:                                              └─────┘│
│  • Nodes: cyan dots (6px), selected: blue ring                      │
│  • Members: gray lines (2px), selected: blue (3px)                  │
│  • Loads: red arrows with values                                    │
│  • Supports: gold triangles/squares                                 │
│  • Dimensions: dashed lines with values                             │
│  • Grid: subtle gray lines (40px spacing)                           │
│  • Axes: R=X, G=Y, B=Z (bottom-left)                              │
│                                                                      │
│  Selection region:                                                   │
│  • Click: single select                                             │
│  • Ctrl+Click: add to selection                                     │
│  • Rectangle drag: box select (blue dashed outline)                 │
│  • Shift+drag: deselect from selection                              │
│                                                                      │
│  Navigation:                                                         │
│  • Scroll: zoom                                                     │
│  • Middle-drag: pan                                                 │
│  • Right-drag: orbit                                                │
│  • Double-click node/member: show properties                        │
│                                                                      │
│  ┌──────┐                                                 ┌────────┐│
│  │Toolbar│                                                │ MiniMap││
│  │ ↖    │                                                │  ·  ·  ││
│  │ ⊕    │                                                │ ┌──┐·  ││
│  │ 📏   │                                                │ │  │   ││
│  │ 🔄   │                                                │ └──┘   ││
│  └──────┘                                                └────────┘│
│                                                                      │
│  ┌───────────────────────────────────────────────────────────┐      │
│  │  X: 5.000  Y: 0.000  Z: 3.000  │  Snap: 0.5m  │  Grid  │      │
│  └───────────────────────────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘

Background: #0f172a with subtle grid pattern
Grid lines: rgba(148,163,184,0.08) 1px, 40px spacing
```

### Viewport View Controls (Floating, right side)
```
┌──────┐
│  ⊕   │  Zoom In       (Ctrl+=)
│  ⊖   │  Zoom Out      (Ctrl+-)
│  🏠  │  Fit All       (F)
│  📐  │  Zoom Selected (Z)
│  🎯  │  Center on     (C)
│──────│
│  ⊞   │  Ortho Views submenu
│  🎥  │  Perspective toggle
└──────┘

Button: 32×32px, bg-surface-dark/80, backdrop-blur
border: 1px border-subtle, radius: 6px
margin-bottom: 2px between buttons
Position: right side of viewport, vertically centered
```

---

## 6.6 Properties Panel (Right) — Detail

### Node Selected
```
┌──────────────────────────────────┐
│ Properties              [📌][✕] │
├──────────────────────────────────┤
│                                  │
│ ── Node N1 ──                   │
│                                  │
│ Coordinates                      │
│ X: [  0.000  ] m                │
│ Y: [  0.000  ] m                │
│ Z: [  0.000  ] m                │
│                                  │
│ ── Support ──                   │
│ Type: [Fixed ▾]                 │
│                                  │
│ Restraints                       │
│ ☑ Tx  ☑ Ty  ☑ Tz              │
│ ☑ Rx  ☑ Ry  ☑ Rz              │
│                                  │
│ Spring Constants                 │
│ Kx: [      ] kN/m              │
│ Ky: [      ] kN/m              │
│ Kz: [      ] kN/m              │
│ KRx: [     ] kN·m/rad          │
│ KRy: [     ] kN·m/rad          │
│ KRz: [     ] kN·m/rad          │
│                                  │
│ ── Settlement ──                │
│ Δx: [ 0.000 ] m                │
│ Δy: [ 0.000 ] m                │
│ Δz: [ 0.000 ] m                │
│                                  │
│ ── Connected Members ──         │
│ • M1 (ISMB 200, Beam)          │
│ • M2 (ISMB 200, Column)        │
│                                  │
│ [Apply] [Reset]                  │
│                                  │
└──────────────────────────────────┘
```

### Member Selected
```
┌──────────────────────────────────┐
│ Properties              [📌][✕] │
├──────────────────────────────────┤
│                                  │
│ ── Member M1 ──                 │
│ Type: Beam                       │
│ Start: N1 (0, 0, 0)            │
│ End: N2 (6, 0, 0)              │
│ Length: 6.000 m                  │
│ Angle: 0°                       │
│                                  │
│ ── Section ──                   │
│ Profile: [ISMB 200 ▾]          │
│ ┌──────────────────────────────┐│
│ │   ┌───┐   A = 32.33 cm²     ││
│ │   │   │   Ix = 2235 cm⁴     ││
│ │   │   │   Iy = 150 cm⁴      ││
│ │ ──┤   ├── Zx = 223 cm³      ││
│ │   │   │   Zy = 37.5 cm³     ││
│ │   └───┘   J = 12.3 cm⁴      ││
│ │   200mm   rx = 8.32 cm       ││
│ └──────────────────────────────┘│
│ [Browse Section DB →]           │
│                                  │
│ ── Material ──                  │
│ [Fe 345 (IS 2062) ▾]           │
│ E: 200,000 MPa                  │
│ fy: 345 MPa                     │
│ fu: 490 MPa                     │
│ ρ: 7850 kg/m³                   │
│                                  │
│ ── End Releases ──              │
│ Start: [Fixed ▾]               │
│   ☐Mx  ☐My  ☑Mz               │
│ End: [Pinned ▾]                │
│   ☐Mx  ☐My  ☑Mz               │
│                                  │
│ ── Offset ──                    │
│ Start: [0] [0] [0] m           │
│ End:   [0] [0] [0] m           │
│                                  │
│ ── Beta Angle ──                │
│ [  0.0  ] degrees               │
│                                  │
│ [Apply] [Reset]                  │
│                                  │
└──────────────────────────────────┘

Section preview: 
  SVG rendering of cross-section
  80×80px, bg-surface-elevated
  Section outline in primary/50
  Dimensions labeled
  Properties table right of preview
```

### Nothing Selected
```
┌──────────────────────────────────┐
│ Properties              [📌][✕] │
├──────────────────────────────────┤
│                                  │
│ ── Model Summary ──             │
│                                  │
│ Nodes:        4                  │
│ Members:      3                  │
│ Plates:       0                  │
│ Supports:     2                  │
│ Load Cases:   2                  │
│ Combinations: 3                  │
│                                  │
│ ── Structure Bounds ──          │
│ X: 0.000 to 12.000 m           │
│ Y: 0.000 to 0.000 m            │
│ Z: 0.000 to 8.000 m            │
│                                  │
│ ── Units ──                     │
│ Length: meters (m)               │
│ Force: kilonewtons (kN)         │
│ Moment: kN·m                    │
│ Stress: MPa                     │
│ Temperature: °C                  │
│                                  │
│ ── Quick Actions ──             │
│ [Select All]  [Select by Type]  │
│ [Validate Model]                │
│                                  │
└──────────────────────────────────┘
```

---

## 6.7 Status Bar (Zone D) — Detail

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ ● Ready │ N:4  M:3  P:0 │ LC:2 │ kN, m │ Snap: 0.5m [ON] │ Grid: 1m │ Z:100% │
└──────────────────────────────────────────────────────────────────────────────────┘

Elements:
1. Status indicator: ● green (Ready), ● yellow (Modified), ● blue (Analyzing), ● red (Error)
2. Model counts: N=Nodes, M=Members, P=Plates — click opens model summary
3. Load case: current active LC — click opens LC selector dropdown
4. Units: current unit system — click opens unit settings
5. Snap: snap distance and ON/OFF toggle — click toggles
6. Grid: grid spacing — click opens grid settings
7. Zoom level: percentage — click opens zoom presets

Height: 24px
bg: #0f172a
border-top: 1px border-subtle
Text: 11px mono, text-muted
Separators: 1px vertical, h-3, border-subtle
Clickable items: hover text-primary, cursor-pointer
```

---

## 6.8 Keyboard Shortcuts Overlay

```
Press Ctrl+/ or ? to show:
┌───────────────────────────────────────────────────────────────────┐
│ Keyboard Shortcuts                                          [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  🔍 [Search shortcuts...]                                        │
│                                                                   │
│  ── GENERAL ──                                                   │
│  Ctrl+Space     Command Palette                                  │
│  Ctrl+S         Save Project                                     │
│  Ctrl+Z         Undo                                             │
│  Ctrl+Shift+Z   Redo                                             │
│  Ctrl+A         Select All                                       │
│  Delete         Delete Selected                                  │
│  Escape         Cancel / Deselect                                │
│                                                                   │
│  ── MODELING ──                                                  │
│  N              Add Node mode                                    │
│  M              Add Member mode                                  │
│  P              Add Plate mode                                   │
│  G              Generate Grid                                    │
│  S              Assign Section                                   │
│  Shift+F        Add Fixed Support                                │
│  Shift+P        Add Pinned Support                               │
│                                                                   │
│  ── VIEW ──                                                      │
│  F              Fit All                                          │
│  Z              Zoom to Selected                                 │
│  1              Front View (XZ)                                  │
│  2              Side View (YZ)                                   │
│  3              Top View (XY)                                    │
│  4              Isometric View                                   │
│  5              Perspective Toggle                               │
│                                                                   │
│  ── ANALYSIS ──                                                  │
│  Ctrl+Enter     Run Analysis                                     │
│  Ctrl+R         View Results                                     │
│  Ctrl+D         Run Design Check                                 │
│                                                                   │
│  ── DISPLAY ──                                                   │
│  L              Toggle Load Display                              │
│  R              Toggle Results Display                           │
│  D              Toggle Dimensions                                │
│  T              Toggle Member Labels                             │
│  Ctrl+B         Toggle Sidebar                                   │
│  Ctrl+J         Toggle Bottom Panel                              │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

Dialog: 640px wide, max-height 80vh, scrollable
Two-column shortcut list: action left, keys right
Key badges: inline-code style (bg-surface-elevated, px-2, radius-sm, mono 12px)
```
