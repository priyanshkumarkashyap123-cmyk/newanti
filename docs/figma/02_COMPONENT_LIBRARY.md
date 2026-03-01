# 02 — Component Library
## BeamLab Ultimate Figma Specification

---

## 2.1 Button Component

### Variants
```
┌─────────────────────────────────────────────────────────────┐
│ VARIANT        │ BG              │ TEXT       │ BORDER       │
├────────────────┼─────────────────┼────────────┼──────────────┤
│ Default        │ #2563eb         │ #ffffff    │ none         │
│ Default:hover  │ #1d4ed8         │ #ffffff    │ none         │
│ Default:active │ #1e40af         │ #ffffff    │ none         │
│ Destructive    │ #ef4444         │ #ffffff    │ none         │
│ Destructive:hov│ #dc2626         │ #ffffff    │ none         │
│ Outline        │ transparent     │ #f1f5f9    │ #475569 1px  │
│ Outline:hover  │ rgba(white,0.05)│ #f1f5f9    │ #60a5fa      │
│ Secondary      │ #334155         │ #f1f5f9    │ none         │
│ Secondary:hover│ #475569         │ #f1f5f9    │ none         │
│ Ghost          │ transparent     │ #94a3b8    │ none         │
│ Ghost:hover    │ rgba(white,0.05)│ #f1f5f9    │ none         │
│ Link           │ transparent     │ #3b82f6    │ none         │
│ Link:hover     │ transparent     │ #60a5fa    │ underline    │
│ Success        │ #10b981         │ #ffffff    │ none         │
│ Success:hover  │ #059669         │ #ffffff    │ none         │
│ Premium        │ gradient gold   │ #ffffff    │ none         │
│ Disabled       │ any @ 50%       │ any @ 50%  │ cursor:none  │
└─────────────────────────────────────────────────────────────┘
```

### Sizes
```
┌────────┬────────┬──────────┬──────────┬──────────┬───────────────┐
│ Size   │ Height │ Padding  │ Font     │ Radius   │ Icon Size     │
├────────┼────────┼──────────┼──────────┼──────────┼───────────────┤
│ sm     │ 32px   │ 0 12px   │ 12px/500 │ 6px      │ 14px          │
│ default│ 36px   │ 0 16px   │ 14px/500 │ 6px      │ 16px          │
│ lg     │ 44px   │ 0 24px   │ 16px/500 │ 8px      │ 20px          │
│ icon   │ 36×36  │ 0        │ —        │ 6px      │ 16px centered │
│ icon-sm│ 28×28  │ 0        │ —        │ 4px      │ 14px centered │
└────────┴────────┴──────────┴──────────┴──────────┴───────────────┘
```

### States Anatomy
```
┌──────────────────────────────────┐
│ [🔧] Run Analysis               │  ← Icon (optional, left) + Label + Icon (optional, right)
└──────────────────────────────────┘
│ [⟳] Running...                  │  ← Loading state: spinner replaces left icon
└──────────────────────────────────┘

Focus: 2px solid #3b82f6, offset 2px
Loading: opacity 0.7, spinner animation
```

### Figma Component Properties
```
Properties:
  - variant: enum [default, destructive, outline, secondary, ghost, link, success, premium]
  - size: enum [sm, default, lg, icon, icon-sm]
  - state: enum [default, hover, active, focused, disabled, loading]
  - leftIcon: instance swap (icon component)
  - rightIcon: instance swap (icon component)  
  - label: text
  - loading: boolean
  - loadingText: text
  - fullWidth: boolean
```

---

## 2.2 Input Component

### Text Input
```
Dark Mode:
┌────────────────────────────────────────────┐
│ Label *                                     │  ← 12px medium, text-muted, mb-1
│ ┌────────────────────────────────────────┐  │
│ │ 🔍  Placeholder text...               │  │  ← 14px, bg: rgba(15,23,42,0.8)
│ └────────────────────────────────────────┘  │     border: 1px rgba(255,255,255,0.08)
│ Helper text or validation message           │  ← 11px, text-muted or error
└────────────────────────────────────────────┘     padding: 10px 14px, radius: 8px

Focus State:
  border: 1px #3b82f6
  box-shadow: 0 0 0 3px rgba(59,130,246,0.12)
  bg: rgba(15,23,42,0.95)

Error State:
  border: 1px #ef4444
  box-shadow: 0 0 0 3px rgba(239,68,68,0.12)
  helper text turns #ef4444

Disabled State:
  opacity: 0.5
  cursor: not-allowed
```

### Input Variants
```
┌────────────────────────────────────────────────┐
│ Text Input        │ Standard single-line       │
│ Number Input      │ With stepper arrows        │
│ Textarea          │ Multi-line, auto-resize    │
│ Search Input      │ Search icon + clear button │
│ Password Input    │ Eye toggle visibility      │
│ Select            │ Dropdown chevron           │
│ Combobox          │ Search + dropdown          │
│ Date Picker       │ Calendar icon + popup      │
│ File Upload       │ Drop zone + browse button  │
│ Color Picker      │ Swatch + hex input         │
│ Range Slider      │ Track + thumb + value      │
│ Coordinate Input  │ X, Y, Z triple input bar   │
│ Unit Input        │ Value + unit dropdown      │
└────────────────────────────────────────────────┘
```

### Engineering-Specific: Coordinate Input Bar
```
┌──────────────────────────────────────────────────────────────┐
│  X: [  5.000  ] m   Y: [  0.000  ] m   Z: [  3.500  ] m   │
└──────────────────────────────────────────────────────────────┘
  - 3 number inputs inline
  - Unit suffix displayed after each
  - Tab between fields
  - Enter to confirm, Escape to cancel
  - Background: surface-dark, monospace font
```

### Engineering-Specific: Unit Input
```
┌─────────────────────────────────┐
│  [ 250.00 ] │ [kN ▾]           │
└─────────────────────────────────┘
  - Number input on left
  - Unit dropdown on right (seamless border)
  - Auto-converts when unit changes
  - Units: kN, N, kip, lb, kg, tonne, etc.
```

### Figma Component Properties
```
Properties:
  - variant: enum [text, number, textarea, search, password, select, combobox, coordinate, unit]
  - size: enum [sm, default, lg]
  - state: enum [default, hover, focused, error, disabled, readonly]
  - label: text (optional)
  - placeholder: text
  - helperText: text (optional)
  - errorMessage: text (optional)
  - required: boolean
  - leadingIcon: instance swap
  - trailingIcon: instance swap
  - prefix: text (optional)
  - suffix: text (optional, e.g. "kN", "mm")
```

---

## 2.3 Card Component

### Variants
```
Default Card (Dark Mode):
┌────────────────────────────────────────────┐
│  Card Title                    [⋮]        │  ← CardHeader: px-6 pt-6
│  Description text goes here               │  ← CardDescription: text-muted
├────────────────────────────────────────────┤
│                                            │
│  Card content area                         │  ← CardContent: px-6 pb-6
│                                            │
├────────────────────────────────────────────┤
│  [Cancel]                    [Save]        │  ← CardFooter: px-6 pb-6
└────────────────────────────────────────────┘

Style: bg: #1e293b, border: 1px #334155, radius: 8px
```

### Card Variants
| Variant | Background | Border | Shadow | Hover |
|---------|-----------|--------|--------|-------|
| `default` | surface-dark | border-subtle | elevation-1 | — |
| `elevated` | surface-dark | border-dark | elevation-2 | elevation-3 |
| `interactive` | surface-dark | border-subtle | elevation-1 | border-primary, elevation-2 |
| `outlined` | transparent | border-dark | none | bg surface-dark |
| `glass` | rgba(30,41,59,0.6) | rgba(255,255,255,0.08) | none | backdrop-blur |
| `metric` | gradient overlay | border-subtle | glow-primary | scale(1.02) |

### Project Card (Dashboard)
```
┌────────────────────────────────────────────┐
│ ┌────────────────────────────────────────┐ │
│ │         3D Preview Thumbnail          │ │  ← 200px height, bg: surface-elevated
│ │         (WebGL snapshot)              │ │
│ └────────────────────────────────────────┘ │
│  Multi-Story Building                      │  ← h4, text-primary
│  5 stories, 12 members, 8 nodes           │  ← body-sm, text-muted
│                                            │
│  ┌──────┐ ┌──────┐ ┌──────┐              │
│  │ IS456│ │Steel │ │ Done │              │  ← badges (status tags)
│  └──────┘ └──────┘ └──────┘              │
│                                            │
│  Modified: 2 hours ago        [⋮]        │  ← caption, text-muted + context menu
└────────────────────────────────────────────┘
  Size: 300px wide, auto height
  Hover: border-primary-500/30, translate-y -2px
```

---

## 2.4 Badge Component

### Variants
```
┌──────────┬──────────────┬────────────┬──────────────┐
│ Variant  │ Background   │ Text       │ Border       │
├──────────┼──────────────┼────────────┼──────────────┤
│ default  │ primary-600  │ white      │ none         │
│ secondary│ slate-700    │ slate-100  │ none         │
│ outline  │ transparent  │ slate-300  │ 1px slate-600│
│ destruct.│ red-600/20   │ red-400    │ none         │
│ success  │ green-600/20 │ green-400  │ none         │
│ warning  │ amber-600/20 │ amber-400  │ none         │
│ premium  │ gold gradient│ white      │ none         │
└──────────┴──────────────┴────────────┴──────────────┘

Size: height 20px, px-2, text 11px, radius-full
With dot: 6px circle before text
With icon: 12px icon before text
With close: 12px X button after text
```

---

## 2.5 Dialog / Modal Component

### Anatomy
```
┌─ Backdrop: bg-black/50, backdrop-blur-sm ─────────────────────────────┐
│                                                                        │
│   ┌─────────────────────────────────────────────────────────────┐      │
│   │ Dialog Title                                          [✕]   │ ← Header: h4, border-b
│   ├─────────────────────────────────────────────────────────────┤      │
│   │                                                             │      │
│   │  Dialog body content                                        │ ← Body: p-6, scroll
│   │  Can include forms, tables, images...                       │      │
│   │                                                             │      │
│   ├─────────────────────────────────────────────────────────────┤      │
│   │                          [Cancel]  [Confirm Action]         │ ← Footer: border-t, p-4
│   └─────────────────────────────────────────────────────────────┘      │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

Style:
  bg: #1e293b
  border: 1px #475569
  radius: 12px
  shadow: elevation-3
  animation: bounceIn 500ms
  
Sizes:
  sm: 400px max-width
  md: 560px max-width (default)
  lg: 720px max-width
  xl: 900px max-width
  full: 95vw × 90vh (engineering data tables)
```

### Engineering Dialog Examples

**Node Input Dialog:**
```
┌───────────────────────────────────────────────┐
│ Add Node                                [✕]   │
├───────────────────────────────────────────────┤
│                                               │
│  Coordinates:                                 │
│  X: [  0.000  ] m    Y: [  3.000  ] m       │
│  Z: [  0.000  ] m                            │
│                                               │
│  Support Type:  [Fixed ▾]                    │
│                                               │
│  ☑ Fixed X   ☑ Fixed Y   ☑ Fixed Z          │
│  ☑ Fixed Rx  ☑ Fixed Ry  ☑ Fixed Rz         │
│                                               │
│  Spring Constants (if applicable):            │
│  Kx: [     ] kN/m   Ky: [     ] kN/m        │
│                                               │
├───────────────────────────────────────────────┤
│              [Cancel]  [Add Node]             │
└───────────────────────────────────────────────┘
```

**Load Input Dialog:**
```
┌───────────────────────────────────────────────┐
│ Apply Load                              [✕]   │
├───────────────────────────────────────────────┤
│                                               │
│  Load Case: [Dead Load ▾]                    │
│                                               │
│  Load Type:                                   │
│  ○ Point Load  ● Distributed  ○ Moment       │
│  ○ Temperature ○ Prestress   ○ Self-Weight   │
│                                               │
│  Apply to: [Member 3 ▾]  (or multi-select)   │
│                                               │
│  ── Distributed Load Parameters ──           │
│  Direction: [Global Y ▾]                     │
│  Start Value: [ -10.00 ] kN/m                │
│  End Value:   [ -10.00 ] kN/m                │
│  Start Dist:  [  0.00  ] m  (from start)     │
│  End Dist:    [  5.00  ] m  (from start)     │
│                                               │
│  [Preview diagram showing load on member]     │
│                                               │
├───────────────────────────────────────────────┤
│      [Cancel]  [Apply to More]  [Apply]       │
└───────────────────────────────────────────────┘
```

---

## 2.6 Table / DataTable Component

### Engineering Data Table
```
┌──────────────────────────────────────────────────────────────────────────┐
│ 🔍 [Search members...]   [Filter ▾]  [Columns ▾]  [Export ▾]  97 items │
├───┬────────┬─────────┬────────────┬──────────┬───────────┬──────────────┤
│   │ Member │ Section │ Material   │ Length   │ Max BM    │ Status       │
│   │        │         │            │ (m)      │ (kN·m)   │              │
├───┼────────┼─────────┼────────────┼──────────┼───────────┼──────────────┤
│ ☑ │ M1     │ W14×22  │ Fe 345     │ 6.000    │ 245.67   │ ✓ OK (0.72) │
│ ☐ │ M2     │ W14×22  │ Fe 345     │ 6.000    │ 189.23   │ ✓ OK (0.55) │
│ ☑ │ M3     │ W10×33  │ Fe 345     │ 4.500    │ 312.45   │ ⚠ Warn(0.91)│
│ ☐ │ M4     │ W14×30  │ Fe 250     │ 3.000    │ 567.89   │ ✕ FAIL(1.24)│
│ ☐ │ M5     │ ISMB200 │ Fe 250     │ 5.000    │ 123.45   │ ✓ OK (0.38) │
├───┴────────┴─────────┴────────────┴──────────┴───────────┴──────────────┤
│ ◀ 1 2 3 ... 10 ▶     Showing 1-20 of 97                    Per page: 20│
└──────────────────────────────────────────────────────────────────────────┘

Style:
  Header row: bg-slate-800, text-muted, 12px medium uppercase, sticky top
  Data rows: bg-surface-dark, 13px mono for values, alternating subtle stripe
  Selected row: bg-primary-500/10, border-l-2 primary
  Hover row: bg-slate-800/50
  Fail row: bg-red-500/5, text-error for status
  Pass row: text-success for status
  Borders: 1px border-subtle between rows, none between columns (clean)
  Numbers: right-aligned, monospace, 3 decimal places default
  Resize handles on column headers
  Sort indicator: ▲▼ arrows
  Virtual scrolling for 1000+ rows
```

### Figma Properties
```
Properties:
  - columns: configurable (name, type, width, alignment, sortable, resizable)
  - selectable: boolean (checkbox column)
  - sortable: boolean
  - filterable: boolean
  - searchable: boolean
  - paginated: boolean
  - virtualScroll: boolean
  - exportable: boolean
  - stickyHeader: boolean
  - density: enum [compact, default, comfortable]
  - emptyState: slot (empty state component)
```

---

## 2.7 Tabs Component

### Variants
```
Line Tabs (Default):
┌───────────────────────────────────────────┐
│  Geometry   Properties   Loading   Design │
│  ─────────                                │  ← Active: 2px bottom border primary, text-primary
│                                           │    Inactive: text-muted, hover: text-secondary
└───────────────────────────────────────────┘

Pill Tabs:
┌───────────────────────────────────────────┐
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │ Geometry │ │Properties│ │ Loading  │ │  ← Active: bg-primary, text-white
│  └──────────┘ └──────────┘ └──────────┘ │    Inactive: bg-transparent, text-muted
└───────────────────────────────────────────┘

Enclosed Tabs (Ribbon):
┌───────────────────────────────────────────┐
│ ┌──────┬──────┬──────┬──────┬──────┬────┐│
│ │Geom │Props │Load  │Analy │Design│Civil││  ← Active: bg-surface-elevated, border-t-2 color
│ └──────┴──────┴──────┴──────┴──────┴────┘│    Inactive: bg-transparent
│  Content panel below                      │
└───────────────────────────────────────────┘

Tab sizes: sm (28px height), default (32px), lg (40px)
```

---

## 2.8 Tooltip Component
```
           ┌────────────────────────────┐
           │ Add Fixed Support          │  ← 12px, bg: #334155, text-primary
           │ Shortcut: Shift+F          │  ← 11px, text-muted
           └──────────┬─────────────────┘
                      ▼
                   [button]

Placement: top (default), bottom, left, right
Delay: 500ms show, 200ms hide
Max width: 240px
Padding: 6px 10px
Radius: 6px
Shadow: elevation-2
Arrow: 6px
Rich tooltip: can include icon + description + shortcut
```

---

## 2.9 Context Menu Component
```
Right-click on member:
┌────────────────────────────────────┐
│ 📋 Copy                    Ctrl+C │
│ 📄 Paste                   Ctrl+V │
│ ──────────────────────────────── │
│ 🔧 Properties...           Enter │
│ 📐 Assign Section...       Ctrl+S │
│ 🎨 Assign Material...      Ctrl+M │
│ ──────────────────────────────── │
│ 📊 View Results            Ctrl+R │
│ 📏 Member Info                    │
│ ──────────────────────────────── │
│ ⊕  Insert Node at Mid            │
│ ↔  Split Member                  │
│ 🔗 Merge Members                 │
│ ──────────────────────────────── │
│ 🗑  Delete                  Del  │
└────────────────────────────────────┘

Style:
  bg: #1e293b
  border: 1px #475569
  shadow: elevation-3
  radius: 8px
  padding: 4px
  item height: 32px
  item padding: 0 12px
  hover: bg-slate-700
  separator: 1px border-subtle, my-1
  icon: 16px, text-muted
  shortcut: 12px mono, text-muted, right-aligned
  disabled: opacity 0.5
  submenu arrow: ▶ 10px
```

---

## 2.10 Toast / Notification Component
```
Success Toast:
┌──────────────────────────────────────────────┐
│ ✓  Analysis completed successfully     [✕]   │
│    12 members checked in 2.3 seconds         │
└──────────────────────────────────────────────┘

Error Toast:
┌──────────────────────────────────────────────┐
│ ✕  Analysis failed                     [✕]   │
│    Unstable structure: Node 5 is free         │
│    [View Details]                             │
└──────────────────────────────────────────────┘

Variants: success (#22c55e left border), error (#ef4444), warning (#f59e0b), info (#3b82f6)
Position: bottom-right (default), top-right, top-center
Width: 360px max
Duration: 5000ms auto-dismiss (errors persist)
Animation: slideInRight 300ms enter, slideOutRight 300ms exit
Stack: max 3 visible, queued
```

---

## 2.11 Command Palette
```
┌──────────────────────────────────────────────────────────┐
│ 🔍 Type a command or search...                           │
├──────────────────────────────────────────────────────────┤
│  Recently Used                                           │
│  ▸ Run Analysis                              Ctrl+Enter  │
│  ▸ Add Node                                  N           │
│  ▸ Add Member                                M           │
│                                                          │
│  Geometry                                                │
│  ▸ Add Node at Coordinates...                N           │
│  ▸ Add Member Between Nodes...               M           │
│  ▸ Generate Grid...                          G           │
│  ▸ Insert Node on Member                     Shift+N     │
│                                                          │
│  Analysis                                                │
│  ▸ Run Linear Static Analysis                Ctrl+Enter  │
│  ▸ Run P-Delta Analysis                                  │
│  ▸ Run Modal Analysis                                    │
│                                                          │
│  13 more results...                                      │
└──────────────────────────────────────────────────────────┘

Style:
  Width: 560px, centered top (20% from top)
  bg: #1e293b, border: 1px #475569, shadow: elevation-4
  radius: 12px
  search input: 48px height, 16px text, no border
  category label: 11px uppercase, text-muted, px-3, mt-2
  item: 36px height, px-3, hover: bg-slate-700
  selected item: bg-primary-500/15, border-l-2 primary
  shortcut: 12px mono, text-muted
  Backdrop: bg-black/30
  Animation: slideUp 200ms
  Keyboard: ↑↓ navigate, Enter select, Esc close
```

---

## 2.12 Skeleton / Loading States

### Skeleton Variants
```
Text Skeleton:
┌──────────────────────────────────────────────────────┐
│ ████████████████████████ (80% width)                 │
│ ██████████████████ (60% width)                       │
│ ███████████████████████████████ (100% width)         │
└──────────────────────────────────────────────────────┘

Card Skeleton:
┌────────────────────────────────────────────┐
│ ██████████████████████████████████████████ │  ← 160px height block
│ ████████████████████ (title)               │
│ ████████████████████████████ (subtitle)    │
│ ████████ ████████ ████████ (badges)        │
└────────────────────────────────────────────┘

Table Skeleton:
┌────────┬────────┬────────┬────────┬────────┐
│ ██████ │ ██████ │ ██████ │ ██████ │ ██████ │  ← header
├────────┼────────┼────────┼────────┼────────┤
│ █████  │ ████   │ ██████ │ █████  │ ████   │  ← rows (5-8 shown)
│ ██████ │ █████  │ ████   │ ██████ │ █████  │
│ ████   │ ██████ │ █████  │ ████   │ ██████ │
└────────┴────────┴────────┴────────┴────────┘

Style: bg-slate-700, radius-md, animation: skeletonPulse 1.5s infinite
```

### Analysis Progress
```
┌───────────────────────────────────────────────────────┐
│  ⟳  Running Analysis...                              │
│                                                       │
│  ┌──────────────────────────────────────────────────┐ │
│  │████████████████████░░░░░░░░░░░░│ 64%             │ │  ← gradient progress bar
│  └──────────────────────────────────────────────────┘ │
│                                                       │
│  Step 3/5: Assembling stiffness matrix                │  ← current step
│  Estimated time remaining: 12 seconds                 │
│                                                       │
│  ✓ Validating model                                   │  ← completed steps
│  ✓ Building element matrices                          │
│  ⟳ Assembling stiffness matrix                       │  ← current
│  ○ Solving equations                                  │  ← pending
│  ○ Extracting results                                 │
│                                                       │
│                                     [Cancel]          │
└───────────────────────────────────────────────────────┘
```

---

## 2.13 Empty States
```
No Projects:
┌────────────────────────────────────────────────────────┐
│                                                        │
│              ┌──────┐                                  │
│              │  📐  │  48px icon, text-muted           │
│              └──────┘                                  │
│                                                        │
│          No projects yet                               │  ← h3, text-primary
│    Create your first structural model                  │  ← body, text-muted
│    to get started with BeamLab                         │
│                                                        │
│         [+ Create New Project]                         │  ← primary button
│         [  Browse Templates  ]                         │  ← outline button
│                                                        │
└────────────────────────────────────────────────────────┘

Also needed for: No Results, No Members Selected, No Load Cases, 
Analysis Not Run, Search No Results, Offline State, Coming Soon
```

---

## 2.14 Drawer / Sheet Component
```
Right Drawer (Properties Panel):
                              ┌──────────────────────────┐
                              │ Member Properties   [✕]  │
                              ├──────────────────────────┤
                              │ Member: M1               │
                              │ Type: Beam               │
                              │                          │
                              │ Section                  │
                              │ [W14×22 ▾]              │
                              │                          │
                              │ Material                 │
                              │ [Fe 345 ▾]             │
                              │                          │
                              │ Releases                 │
                              │ Start: ☐Mx ☐My ☑Mz     │
                              │ End:   ☐Mx ☐My ☑Mz     │
                              │                          │
                              │ Offset                   │
                              │ [  0  ] [  0  ] [  0  ] │
                              │                          │
                              └──────────────────────────┘
Width: 280-360px
Slide from right: 300ms ease-out
bg: #1e293b, border-l: 1px #475569
Scrollable content, sticky header
```

---

## 2.15 Accordion / Collapsible Section
```
┌────────────────────────────────────────────────────────┐
│ ▼ Geometry Results                                     │ ← click to collapse
├────────────────────────────────────────────────────────┤
│   Nodes: 12                                            │
│   Members: 15                                          │
│   Degrees of Freedom: 72                               │
│   Bandwidth: 24                                        │
└────────────────────────────────────────────────────────┘
│ ▶ Load Summary                                         │ ← collapsed
├────────────────────────────────────────────────────────┤
│ ▶ Analysis Options                                     │ ← collapsed
└────────────────────────────────────────────────────────┘

Header: h5, text-primary, cursor-pointer, hover: bg-slate-800
Arrow: 12px, rotate 90° transition 200ms
Content: p-4, bg transparent
Border: 1px border-subtle between items
```

---

## 2.16 Switch / Toggle
```
Off State:    ┌──○──────┐   bg: #475569, circle: white
On State:     ┌──────○──┐   bg: #3b82f6, circle: white

Sizes:
  sm: 32×18px, circle 14px
  default: 40×22px, circle 18px
  lg: 48×26px, circle 22px

With label: "Dark Mode" [═══○] or [○═══] "Light Mode"
Transition: 200ms spring
Focus ring: 2px primary, offset 2px
```

---

## 2.17 Slider Component
```
Single Value:
│  Load Factor                                  │
│  0.0 ─────────●───────────── 2.0              │
│                1.35                            │  ← current value displayed

Range:
│  Stress Range (MPa)                           │
│  0 ────●═══════════●──────── 500              │
│         150           350                     │

Track: h-2, bg-slate-700, radius-full
Filled: bg-primary-500
Thumb: 16px circle, bg-white, shadow elevation-2, hover: scale(1.1)
Value tooltip: shown on drag, bg-primary, text-white, 11px
Marks: optional tick marks below track
```

---

## 2.18 Checkbox & Radio

### Checkbox
```
☐  Unchecked    16×16, border: 2px #475569, radius: 4px, bg: transparent
☑  Checked      16×16, bg: #3b82f6, border: none, white checkmark
☐̶  Indeterminate 16×16, bg: #3b82f6, white dash
☐  Disabled     16×16, opacity 0.5

Label: 14px, text-primary, 8px gap from checkbox
```

### Radio
```
○  Unchecked    16×16, border: 2px #475569, shape: circle
●  Checked      16×16, border: 2px #3b82f6, inner circle 8px #3b82f6
○  Disabled     16×16, opacity 0.5
```

---

## 2.19 Progress Indicators

### Linear Progress Bar
```
Determinate:
┌────────────────────────────────────────────────┐
│████████████████████░░░░░░░░░░░░│ 67%           │
└────────────────────────────────────────────────┘
Track: h-2, bg-slate-700, radius-full
Fill: bg-primary-500, radius-full, transition width 300ms

Indeterminate:
┌────────────────────────────────────────────────┐
│░░░░████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│
└────────────────────────────────────────────────┘
Animated sliding block
```

### Circular/Ring Progress
```
     ╭──╮
    ╱ 78%╲     Stroke: 3px primary over 3px slate-700
   │      │    Size: 40px (sm), 64px (md), 96px (lg)
    ╲    ╱     Text: centered percentage, mono font
     ╰──╯
```

### Step Progress (Analysis Workflow)
```
  ●─────●─────●─────○─────○
  Model  Load  Analyze Design Report
  
  Complete: ● bg-primary, white check
  Current:  ● bg-primary, pulsing ring
  Pending:  ○ bg-slate-700, border-slate-600
  Line done: bg-primary
  Line pending: bg-slate-700
```

---

## 2.20 Dropdown / Select Menu
```
┌────────────────────────────────┐
│  Fe 345 Steel              ▾  │  ← Trigger: input-styled
└────────────────────────────────┘
         │
         ▼
┌────────────────────────────────┐
│ 🔍 Search materials...         │
├────────────────────────────────┤
│  Structural Steel              │  ← Category header: 11px uppercase muted
│  ▸ Fe 250 (IS 2062)           │
│  ▸ Fe 345 (IS 2062)      ✓   │  ← Selected: check mark
│  ▸ Fe 410 (IS 2062)           │
│  ▸ Fe 450 (IS 2062)           │
│  Stainless Steel               │
│  ▸ SS 304                      │
│  ▸ SS 316                      │
│  Concrete                      │
│  ▸ M20 (IS 456)               │
│  ▸ M25 (IS 456)               │
│  ▸ M30 (IS 456)               │
├────────────────────────────────┤
│  + Add Custom Material...      │
└────────────────────────────────┘

Max height: 320px, scrollable
Width: matches trigger or min 200px
Shadow: elevation-3
Animation: fadeIn 100ms
```

---

## 2.21 MiniMap / Overview Widget
```
┌──────────────┐
│ ┌──┐         │  ← Small scaled view of entire model
│ │  │←viewport│     bg: rgba(15,23,42,0.9)
│ └──┘         │     border: 1px #475569
│        ·     │     Size: 160×120px
│     ·  · ·   │     Corner: bottom-right of viewport
│              │     Draggable viewport rectangle: border primary
└──────────────┘     Nodes: 2px dots, Members: 1px lines
```

---

## 2.22 ViewCube (3D Navigation)
```
        ┌─────┐
       ╱ TOP ╱│
      ┌─────┐ │
      │FRONT│R│  ← Isometric cube, 80×80px
      │     │ │     Click face to snap view
      └─────┘╱      Hover face: highlight primary/20
                    Corner: top-right of viewport
                    Drag to orbit
```

---

## 2.23 Color Legend (Stress Contours)
```
┌──────────────┐
│ Von Mises    │  ← Title: 11px, text-muted
│ (MPa)        │
│              │
│ ████ 500.0   │  ← Red     (critical)
│ ████ 375.0   │  ← Orange  (high)
│ ████ 250.0   │  ← Yellow  (medium)
│ ████ 125.0   │  ← Green   (low)
│ ████   0.0   │  ← Blue    (min)
│              │
│ Max: 487.3   │  ← 11px mono, text-primary
│ Min:   2.1   │
└──────────────┘

Position: right side of viewport
Size: 32×200px gradient bar + labels
bg: rgba(15,23,42,0.85), backdrop-blur
radius: 8px, padding: 8px
```
