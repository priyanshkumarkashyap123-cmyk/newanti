# 05 — Dashboard & Project Management
## BeamLab Ultimate Figma Specification

---

## 5.1 Unified Dashboard — Desktop (1440×900)

### Full Layout
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  🏗 BeamLab    [🔍 Search projects...]   [🔔 3]  [👤 Rakshit ▾]   [⚙]        │
├──────────┬───────────────────────────────────────────────────────────────────────┤
│          │                                                                       │
│  SIDEBAR │    Good Morning, Rakshit 👋                                          │
│          │                                                                       │
│ ┌──────┐ │    ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│ │🏠 Home│ │    │ 📁 12    │  │ 📊 847   │  │ ⏱ 14.2h  │  │ ☁ 2.3GB  │          │
│ │📁 Proj│◀│    │ Projects │  │ Analyses │  │ This Week│  │ Storage  │          │
│ │📋 Templ│ │    │  +2 new  │  │ Run      │  │          │  │ of 5GB   │          │
│ │⭐ Fav │ │    └──────────┘  └──────────┘  └──────────┘  └──────────┘          │
│ │🗑 Trash│ │                                                                     │
│ │──────│ │    ┌────────────────────────────────────────────────────────────────┐ │
│ │📊 Anal│ │    │ Recent Projects              [View All →]  [Grid ☷] [List ☰]│ │
│ │🔩 Des.│ │    ├────────────────────────────────────────────────────────────────┤ │
│ │📋 Rept│ │    │                                                                │ │
│ │──────│ │    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │ │
│ │⚙ Sett│ │    │  │ ┌──────────┐│  │ ┌──────────┐│  │ ┌──────────┐│         │ │
│ │❓ Help│ │    │  │ │ 3D prev  ││  │ │ 3D prev  ││  │ │ 3D prev  ││         │ │
│ │──────│ │    │  │ │          ││  │ │          ││  │ │          ││         │ │
│ │🆕 New │ │    │  │ └──────────┘│  │ └──────────┘│  │ └──────────┘│         │ │
│ │Project│ │    │  │ Office Bldg │  │ Warehouse   │  │ Bridge Deck │         │ │
│ │  [+]  │ │    │  │ 5-story RC  │  │ Steel portal│  │ PSC design  │         │ │
│ │       │ │    │  │ IS456+IS1893│  │ IS800       │  │ IRC:112     │         │ │
│ │       │ │    │  │ ★ Modified  │  │   Modified  │  │   Modified  │         │ │
│ │       │ │    │  │   2h ago    │  │   1d ago    │  │   3d ago    │         │ │
│ │       │ │    │  │ [⋮]        │  │ [⋮]        │  │ [⋮]        │         │ │
│ │       │ │    │  └──────────────┘  └──────────────┘  └──────────────┘         │ │
│ │       │ │    │                                                                │ │
│ │       │ │    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │ │
│ │       │ │    │  │ Residential  │  │ Tower Found. │  │ + New Project│         │ │
│ │       │ │    │  │ Villa        │  │ Pile cap     │  │              │         │ │
│ │       │ │    │  │ ...          │  │ ...          │  │   ┌──────┐  │         │ │
│ │       │ │    │  └──────────────┘  └──────────────┘  │   │  +   │  │         │ │
│ │       │ │    │                                       │   └──────┘  │         │ │
│ │       │ │    │                                       │  Create new │         │ │
│ │       │ │    │                                       └──────────────┘         │ │
│ │       │ │    └────────────────────────────────────────────────────────────────┘ │
│ │       │ │                                                                       │
│ │       │ │    ┌────────────────────────────────────────────────────────────────┐ │
│ │       │ │    │ Quick Actions                                                  │ │
│ │       │ │    │                                                                │ │
│ │       │ │    │ [🏗 New Frame]  [📐 New Truss]  [🏢 New Building]  [🤖 AI Gen]│ │
│ │       │ │    │ [📂 Import]    [📋 Template]   [📊 Quick Calc]    [📖 Docs]  │ │
│ │       │ │    └────────────────────────────────────────────────────────────────┘ │
│ │       │ │                                                                       │
│ │       │ │    ┌────────────────────────────┐  ┌────────────────────────────┐    │
│ │       │ │    │ Recent Activity            │  │ Learning Resources         │    │
│ │       │ │    │                            │  │                            │    │
│ │       │ │    │ 🟢 Analysis completed      │  │ 📖 Getting Started Guide  │    │
│ │       │ │    │   Office Bldg - 2h ago    │  │ 🎥 Video: First Analysis  │    │
│ │       │ │    │ 🔵 Project saved           │  │ 📐 IS 1893 Seismic Guide │    │
│ │       │ │    │   Warehouse - 4h ago      │  │ 💡 Tip: Use Ctrl+Space   │    │
│ │       │ │    │ 🟡 Design warning          │  │    for command palette    │    │
│ │       │ │    │   M5 overstressed         │  │                            │    │
│ │       │ │    │ 🔴 Analysis failed         │  │ [View All Resources →]    │    │
│ │       │ │    │   Bridge Deck - 1d ago    │  │                            │    │
│ │       │ │    └────────────────────────────┘  └────────────────────────────┘    │
│ └──────┘ │                                                                       │
├──────────┴───────────────────────────────────────────────────────────────────────┤
│  Plan: Professional  │  Storage: 2.3/5 GB  │  [Upgrade Plan →]                  │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Style Specifications
```
Dashboard Sidebar:
  Width: 220px (collapsible to 56px icon-only)
  bg: surface-dark
  border-right: 1px border-subtle
  Nav items: 36px height, 12px padding-x
  Active item: bg-primary/10, text-primary, border-l-2 primary
  Hover: bg-surface-elevated
  Icons: 18px, text-muted (active: text-primary)
  Labels: 13px medium
  Section divider: 1px border-subtle, my-2
  "New Project" button: primary, bottom-fixed, mx-3

Project Cards:
  Width: 280px (responsive grid, min 240px)
  Thumbnail: 160px height, bg-surface-elevated, border-b
  Content: p-4
  Title: h4, text-primary, truncate
  Description: body-sm, text-muted, line-clamp-2
  Meta: caption, text-muted
  Badges: small inline badges for codes used
  Star (favorite): gold icon, top-right of thumbnail
  Context menu [⋮]: top-right of card

Stats Cards:
  4-column row, equal width
  Height: 80px
  bg: surface-dark, border: border-subtle
  Icon: 24px in 40px circle, bg-primary/10
  Number: h2, text-primary, mono
  Label: body-sm, text-muted
  Trend: +2 new (green) or -1 (red)

Quick Actions:
  2×4 grid of action cards
  Each: 120×80px, bg-surface-elevated, radius-lg
  Icon: 24px, primary color
  Label: body-sm, text-primary
  Hover: border primary/30, bg-primary/5
```

---

## 5.2 Project Context Menu
```
Right-click or [⋮] on project card:
┌────────────────────────────────────┐
│ 📂 Open                           │
│ 📂 Open in New Tab                │
│ ─────────────────────────────── │
│ 📋 Duplicate                      │
│ ✏️ Rename                        │
│ ⭐ Add to Favorites               │
│ 🏷 Add Tags...                   │
│ ─────────────────────────────── │
│ 📤 Export Project...              │
│ 📂 Move to Folder...             │
│ 👥 Share...                       │
│ ─────────────────────────────── │
│ 📊 Project Details                │
│ 📈 Project Analytics              │
│ ─────────────────────────────── │
│ 🗑 Move to Trash             Del │
└────────────────────────────────────┘
```

---

## 5.3 New Project Dialog

```
┌───────────────────────────────────────────────────────────────────┐
│ Create New Project                                          [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ── Start From ──                                                │
│                                                                   │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐│
│  │            │  │            │  │            │  │            ││
│  │  🆕        │  │  📋        │  │  🤖        │  │  📂        ││
│  │  Blank     │  │  Template  │  │  AI        │  │  Import    ││
│  │  Project   │  │            │  │  Generate  │  │  File      ││
│  │            │  │            │  │            │  │            ││
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘│
│                                                                   │
│  ── Project Details ──                                           │
│                                                                   │
│  Project Name                                                    │
│  [My New Project                          ]                      │
│                                                                   │
│  Description (optional)                                          │
│  [                                        ]                      │
│                                                                   │
│  Unit System                                                     │
│  ○ SI (kN, m, °C)  ● Metric (kN, mm, °C)  ○ Imperial (kip, in, °F)│
│                                                                   │
│  Design Code                                                     │
│  [Indian Standards (IS) ▾]                                       │
│   ├ Indian Standards (IS 456, IS 800, IS 1893)                   │
│   ├ American (AISC, ACI, ASCE)                                   │
│   ├ European (Eurocode)                                          │
│   ├ British Standards (BS)                                       │
│   └ Australian Standards (AS)                                    │
│                                                                   │
│  Structure Type                                                  │
│  [Building Frame ▾]                                              │
│   ├ Building Frame                                               │
│   ├ Industrial Structure                                         │
│   ├ Bridge                                                       │
│   ├ Truss                                                        │
│   ├ Tower / Mast                                                 │
│   ├ Foundation                                                   │
│   ├ Retaining Wall                                               │
│   ├ Water Tank                                                   │
│   └ Custom / Other                                               │
│                                                                   │
│  Tags (optional)                                                 │
│  [residential] [✕]  [multi-story] [✕]  [+ Add tag]             │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                        [Cancel]   [Create Project →]             │
└───────────────────────────────────────────────────────────────────┘
```

---

## 5.4 Template Browser

```
┌───────────────────────────────────────────────────────────────────┐
│ Browse Templates                                            [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ 🔍 [Search templates...]                                         │
│                                                                   │
│ Categories:  [All] [Buildings] [Bridges] [Industrial] [Special]  │
│                                                                   │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐        │
│ │ ┌────────────┐│ │ ┌────────────┐│ │ ┌────────────┐│        │
│ │ │ 3D Preview ││ │ │ 3D Preview ││ │ │ 3D Preview ││        │
│ │ │ (portal    ││ │ │ (multi-    ││ │ │ (warren    ││        │
│ │ │  frame)    ││ │ │  story)    ││ │ │  truss)    ││        │
│ │ └────────────┘│ │ └────────────┘│ │ └────────────┘│        │
│ │ Portal Frame  │ │ 5-Story Bldg  │ │ Warren Truss  │        │
│ │ Single bay,   │ │ Residential   │ │ 20m span,     │        │
│ │ 6m span, 4m h │ │ RC frame      │ │ steel         │        │
│ │ ★★★★★ (124)  │ │ ★★★★☆ (89)   │ │ ★★★★★ (203)  │        │
│ │ [Use Template]│ │ [Use Template]│ │ [Use Template]│        │
│ └────────────────┘ └────────────────┘ └────────────────┘        │
│                                                                   │
│ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐        │
│ │ Pratt Truss    │ │ Water Tank     │ │ Industrial     │        │
│ │ 30m span       │ │ Intze type     │ │ Shed           │        │
│ │ ...            │ │ ...            │ │ ...            │        │
│ └────────────────┘ └────────────────┘ └────────────────┘        │
│                                                                   │
│ Page 1 of 4   [1] [2] [3] [4] [▶]                               │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 5.5 Project List View (Alternative)
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│  🔍 [Search...]  [Filter ▾]  [Sort: Last Modified ▾]  [Grid ☷] [List ☰◀]      │
├──────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│ ☐ │ ★ │ Name            │ Type        │ Members │ Last Modified │ Size   │ [⋮] │
│ ──┼───┼─────────────────┼─────────────┼─────────┼───────────────┼────────┼─────│
│ ☐ │ ★ │ Office Building │ RC Frame    │ 48      │ 2 hours ago   │ 2.4 MB │ [⋮] │
│ ☐ │   │ Warehouse       │ Steel Frame │ 24      │ 1 day ago     │ 1.1 MB │ [⋮] │
│ ☐ │   │ Bridge Deck     │ PSC Bridge  │ 36      │ 3 days ago    │ 3.8 MB │ [⋮] │
│ ☐ │ ★ │ Residential     │ RC Frame    │ 96      │ 1 week ago    │ 5.2 MB │ [⋮] │
│ ☐ │   │ Tower Foundation│ Foundation  │ 12      │ 2 weeks ago   │ 0.8 MB │ [⋮] │
│                                                                                  │
│  Selected: 0  │  Total: 12 projects  │  [Delete Selected]                       │
└──────────────────────────────────────────────────────────────────────────────────┘

Row height: 48px
Alternating background: subtle
Hover: bg-surface-elevated
Sort: click column header
Multi-select: checkbox column
```

---

## 5.6 Notification Panel
```
Click 🔔 icon:
                                    ┌──────────────────────────────────┐
                                    │ Notifications             [Mark │
                                    │                          All ✓] │
                                    ├──────────────────────────────────┤
                                    │                                  │
                                    │ Today                            │
                                    │ 🟢 Analysis completed            │
                                    │    Office Bldg — 2h ago         │
                                    │                                  │
                                    │ 🟡 Design warning                │
                                    │    M5 utilization 0.95 — 3h ago │
                                    │                                  │
                                    │ 🔵 Shared with you              │
                                    │    Priya shared "Tower" — 5h ago│
                                    │                                  │
                                    │ Yesterday                        │
                                    │ 🔴 Analysis failed               │
                                    │    Bridge: unstable — 1d ago    │
                                    │                                  │
                                    │ 🔵 Team comment                  │
                                    │    "Check M3 section" — 1d ago  │
                                    │                                  │
                                    ├──────────────────────────────────┤
                                    │ [View All Notifications →]       │
                                    └──────────────────────────────────┘

Width: 360px
Max-height: 480px, scrollable
Position: dropdown from bell icon
bg: surface-dark, border: border-dark
Each item: 72px height, hover: bg-surface-elevated
Unread: border-l-3 primary, bg-primary/5
Time: caption, text-muted
Badge on bell icon: red circle, 12px, white count
```

---

## 5.7 User Profile Dropdown
```
Click avatar:
                                              ┌──────────────────────────┐
                                              │ Rakshit Tiwari           │
                                              │ rakshit@example.com      │
                                              │ Plan: Professional ⭐    │
                                              ├──────────────────────────┤
                                              │ 👤 My Profile            │
                                              │ ⚙ Settings              │
                                              │ 📊 Usage & Billing      │
                                              │ 🏢 Organization         │
                                              │ ──────────────────────  │
                                              │ 🌙 Dark Mode    [═══●] │
                                              │ 📐 Unit System  [SI ▾] │
                                              │ ──────────────────────  │
                                              │ ❓ Help & Support       │
                                              │ 📋 Keyboard Shortcuts   │
                                              │ 📝 Changelog            │
                                              │ ──────────────────────  │
                                              │ 🚪 Sign Out             │
                                              └──────────────────────────┘

Width: 240px
Avatar: 32px circle, border: 2px primary (Pro user)
```

---

## 5.8 Import Project Dialog
```
┌───────────────────────────────────────────────────────────────────┐
│ Import Project                                              [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Supported Formats:                                              │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  │
│  │   .STD  │ │  .IFC   │ │  .DXF   │ │  .E2K   │ │  .CSV   │  │
│  │ STAAD   │ │  BIM    │ │  CAD    │ │ ETABS   │ │ Generic │  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘  │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐  │
│  │                                                             │  │
│  │              📂 Drop files here                            │  │
│  │              or click to browse                            │  │
│  │                                                             │  │
│  │              Supported: .std, .ifc, .dxf, .e2k, .csv      │  │
│  │              Max size: 50 MB                               │  │
│  │                                                             │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  Import Options:                                                 │
│  ☑ Import geometry (nodes & members)                            │
│  ☑ Import sections & materials                                  │
│  ☑ Import loads                                                  │
│  ☐ Import results (if available)                                │
│  ☑ Auto-fix compatibility issues                                │
│                                                                   │
│  Unit Conversion: [Auto-detect ▾]                                │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                              [Cancel]   [Import →]               │
└───────────────────────────────────────────────────────────────────┘

Drag zone:
  border: 2px dashed border-dark
  hover/dragover: border-primary, bg-primary/5
  radius: 12px
  height: 200px
```
