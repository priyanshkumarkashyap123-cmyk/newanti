# 20 — Advanced Features
## BeamLab Ultimate Figma Specification

---

## 20.1 Scripting / Macro Editor

### Layout
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Script Editor — Untitled.beamscript                          [▶ Run] [✕]    │
├────────────────────┬──────────────────────────────────────────────────────────┤
│ File Explorer      │ // BeamLab Scripting (TypeScript-like DSL)              │
│                    │                                                          │
│ 📁 My Scripts      │ import { Model, Node, Member, Load } from 'beamlab';   │
│   📄 gen_frame.bs  │                                                          │
│   📄 opt_steel.bs  │ const model = Model.active();                           │
│   📄 batch_run.bs  │                                                          │
│                    │ // Generate a 3-bay, 5-storey frame                     │
│ 📁 Examples        │ const bays = [6, 6, 6]; // meters                      │
│   📄 portal.bs     │ const storeyHeights = [4.5, 3.6, 3.6, 3.6, 3.6];     │
│   📄 parametric.bs │                                                          │
│   📄 optimization  │ let nodeId = 1;                                         │
│   📄 batch.bs      │ let memberId = 1;                                       │
│                    │                                                          │
│ 📁 Community       │ for (let floor = 0; floor <= storeyHeights.length; ... │
│   📄 truss_gen.bs  │   for (let bay = 0; bay <= bays.length; bay++) {       │
│   📄 wind_calc.bs  │     const x = bays.slice(0, bay).reduce((a,b)=>a+b,0);│
│                    │     const y = storeyHeights.slice(0, floor)...          │
│                    │     model.addNode(nodeId++, x, y, 0);                   │
│                    │   }                                                      │
│                    │ }                                                        │
│                    │                                                          │
│                    │ // Assign sections                                       │
│                    │ model.members.filter(m => m.isColumn)                    │
│                    │   .forEach(m => m.setSection('ISMB 400'));              │
│                    │                                                          │
│                    │ // Run analysis                                          │
│                    │ const results = await model.analyze('linear');           │
│                    │ console.log('Max displacement:', results.maxDisp());    │
│                    │                                                          │
│                    ├──────────────────────────────────────────────────────────┤
│                    │ Console Output                                           │
│                    │ > Script started...                                      │
│                    │ > Created 24 nodes, 39 members                          │
│                    │ > Assigned ISMB 400 to 20 columns                       │
│                    │ > Analysis complete in 0.3s                             │
│                    │ > Max displacement: 12.4 mm at Node 24                  │
│                    │ > ✓ Script completed successfully                       │
│                    │                                                          │
├────────────────────┴──────────────────────────────────────────────────────────┤
│  Line 15, Col 42   |  TypeScript  |  No Errors  |  Spaces: 2               │
└───────────────────────────────────────────────────────────────────────────────┘
```

### Editor Specifications
| Feature | Detail |
|---------|--------|
| Language | TypeScript-based DSL with BeamLab API |
| Font | JetBrains Mono, 14px |
| Syntax highlighting | Keywords: purple (#c084fc), Strings: cyan (#22d3ee), Numbers: gold (#fbbf24), Comments: slate-500, Functions: blue (#60a5fa) |
| Line numbers | Visible, slate-500, gutter width 48px |
| Autocomplete | IntelliSense-style: model methods, section names, load types |
| Error highlighting | Red underline, gutter icon, tooltip on hover |
| Run button | Green (#22c55e) background, white play icon |
| Console | Bottom panel, 200px height, monospaced, timestamp per line |
| Splitter | Horizontal between editor and console, draggable |

### Toolbar
```
[▶ Run] [⏹ Stop] [🐛 Debug] │ [💾 Save] [📂 Open] │ [📦 Package Manager] │ [📖 API Docs]
```

---

## 20.2 Digital Twin Dashboard

### Layout
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Digital Twin — Project: ABC Office Tower                              [✕]    │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ ┌────────────────────────────────────────────┐ ┌───────────────────────────┐ │
│ │ 3D Live View                               │ │ Sensor Data              │ │
│ │                                            │ │                           │ │
│ │    Building model with real-time overlay   │ │ Sensor S1 (Base Col A1)  │ │
│ │    showing sensor locations as pulsing     │ │ Strain: 124 με           │ │
│ │    dots with data labels                   │ │ Temp: 32.4°C            │ │
│ │                                            │ │ ─── Trend (24h) ───     │ │
│ │    Color overlay:                          │ │ [sparkline chart]        │ │
│ │    Green  → within design limits           │ │                           │ │
│ │    Yellow → approaching threshold          │ │ Sensor S2 (Floor 5)      │ │
│ │    Red    → exceeding threshold            │ │ Accel: 0.003g            │ │
│ │                                            │ │ Displacement: 2.1mm      │ │
│ │    Click sensor dot → detail panel         │ │ ─── Trend (24h) ───     │ │
│ │                                            │ │ [sparkline chart]        │ │
│ │                                            │ │                           │ │
│ └────────────────────────────────────────────┘ │ Sensor S3 (Roof)         │ │
│                                                 │ Wind speed: 23.4 km/h   │ │
│ ┌────────────────────────────────────────────┐ │ Direction: NW            │ │
│ │ Health Status Summary                      │ │ ─── Trend (24h) ───     │ │
│ │                                            │ │ [sparkline chart]        │ │
│ │ Overall:  ██████████░░  82% Health       │ │                           │ │
│ │ Struct.:  ████████████  98% OK           │ │                           │ │
│ │ Thermal:  ████████░░░░  72%              │ │ Alert Thresholds:         │ │
│ │ Fatigue:  █████████░░░  85%              │ │ ⚠ Strain > 200 με       │ │
│ │                                            │ │ ⚠ Accel > 0.01g        │ │
│ │ Recent Alerts:                             │ │ 🔴 Strain > 400 με      │ │
│ │ ⚠ 14:23  Sensor S7: Strain spike 189με  │ │                           │ │
│ │ ⚠ 09:01  Sensor S3: Wind gust 45 km/h   │ │                           │ │
│ │ ✓ 08:30  Daily check: All OK             │ │ [Configure Alerts]        │ │
│ └────────────────────────────────────────────┘ └───────────────────────────┘ │
│                                                                               │
│ ┌───────────────────────────────────────────────────────────────────────────┐ │
│ │ Time-History Plot                                         [Export CSV]   │ │
│ │ [Strain ▾] [Sensor S1 ▾] [Last 7 days ▾]                              │ │
│ │                                                                         │ │
│ │  με │          ╱╲                                                      │ │
│ │ 200─┤─ ─ ─ ─╱─ ╲─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ⚠ Warning                 │ │
│ │ 150─┤      ╱    ╲      ╱╲                                             │ │
│ │ 100─┤ ╱╲ ╱      ╲╱╲╱╱  ╲╱╲                                          │ │
│ │  50─┤╱  ╲              ╲                                               │ │
│ │   0─┼───┬───┬───┬───┬───┬───┬───                                      │ │
│ │     Mon Tue Wed Thu Fri Sat Sun                                        │ │
│ └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 20.3 Quantity Survey / Bill of Quantities (BOQ)

### Layout
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Bill of Quantities                                       [Export] [Print]    │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ Tabs: [Summary] [Steel] [Concrete] [Rebar] [Formwork] [Miscellaneous]      │
│                                                                               │
│ ── Steel Summary (active tab) ──                                            │
│                                                                               │
│ ┌─────┬────────────┬──────┬────────┬──────────┬──────────┬─────────────────┐ │
│ │ #   │ Section    │ Count│ Length │ Unit Wt  │ Total Wt │ Rate   │ Cost  │ │
│ │     │            │      │ (m)    │ (kg/m)   │ (kg)     │ (₹/kg) │ (₹)   │ │
│ ├─────┼────────────┼──────┼────────┼──────────┼──────────┼────────┼───────┤ │
│ │ 1   │ ISMB 600   │ 20   │ 120.0  │ 122.6    │ 14,712   │ 72     │10.59L │ │
│ │ 2   │ ISMB 400   │ 30   │ 108.0  │ 61.6     │ 6,653    │ 72     │ 4.79L │ │
│ │ 3   │ ISMB 300   │ 15   │  54.0  │ 44.2     │ 2,387    │ 72     │ 1.72L │ │
│ │ 4   │ ISMC 250   │ 24   │  86.4  │ 30.4     │ 2,627    │ 74     │ 1.94L │ │
│ │ 5   │ ISA 100×65 │ 48   │  96.0  │ 10.6     │ 1,018    │ 76     │ 0.77L │ │
│ ├─────┼────────────┼──────┼────────┼──────────┼──────────┼────────┼───────┤ │
│ │     │ TOTAL      │ 137  │ 464.4m │          │ 27,397 kg│        │19.81L │ │
│ └─────┴────────────┴──────┴────────┴──────────┴──────────┴────────┴───────┘ │
│                                                                               │
│ ── Concrete Summary ──                                                       │
│ ┌──────────────────┬──────────┬──────────┬──────────┬──────────────────────┐ │
│ │ Element Type     │ Grade    │ Volume   │ Rate     │ Cost                 │ │
│ │                  │          │ (m³)     │ (₹/m³)   │ (₹)                  │ │
│ ├──────────────────┼──────────┼──────────┼──────────┼──────────────────────┤ │
│ │ Beams            │ M30      │ 42.5     │ 7,500    │ 3,18,750             │ │
│ │ Columns          │ M35      │ 28.8     │ 8,200    │ 2,36,160             │ │
│ │ Slabs            │ M25      │ 96.0     │ 6,800    │ 6,52,800             │ │
│ │ Footings         │ M25      │ 18.4     │ 6,800    │ 1,25,120             │ │
│ ├──────────────────┼──────────┼──────────┼──────────┼──────────────────────┤ │
│ │ TOTAL            │          │ 185.7 m³ │          │ 13,32,830            │ │
│ └──────────────────┴──────────┴──────────┴──────────┴──────────────────────┘ │
│                                                                               │
│ ── Grand Total ──                                                            │
│ ┌───────────────────────────────────────────────────────────────────────────┐ │
│ │  Steel:     ₹19,81,000                                                  │ │
│ │  Concrete:  ₹13,32,830                                                  │ │
│ │  Rebar:     ₹ 8,45,200                                                  │ │
│ │  Formwork:  ₹ 4,12,500                                                  │ │
│ │  ─────────────────────                                                   │ │
│ │  ESTIMATED TOTAL: ₹45,71,530                                            │ │
│ │  + 18% GST: ₹ 8,22,875                                                 │ │
│ │  ─────────────────────                                                   │ │
│ │  GRAND TOTAL: ₹53,94,405                                                │ │
│ └───────────────────────────────────────────────────────────────────────────┘ │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 20.4 Bar Bending Schedule (BBS)

### Layout
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Bar Bending Schedule — Beam B1 (Level 1)                     [Export] [✕]   │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ ── Cross Section & Reinforcement Drawing ──                                  │
│ ┌────────────────────────────────────────────────────────────────────────────┐│
│ │                                                                            ││
│ │   ┌────────────────────────────────────────────────────────┐              ││
│ │   │  300mm                                                  │              ││
│ │   │ ┌──────────────────────────────────────────────────┐   │              ││
│ │   │ │ ○ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ○ │   │              ││
│ │   │ │ 2-16φ (hanger bars)                    30mm clr │   │              ││
│ │   │ │                                                  │   │ 500mm        ││
│ │   │ │                                                  │   │              ││
│ │   │ │ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ 8φ @ 150 c/c stirrups│   │              ││
│ │   │ │                                                  │   │              ││
│ │   │ │ ○ ── ○ ── ○ ── ○                               │   │              ││
│ │   │ │ 4-20φ (bottom bars)                              │   │              ││
│ │   │ └──────────────────────────────────────────────────┘   │              ││
│ │   └────────────────────────────────────────────────────────┘              ││
│ │                                                                            ││
│ │   Longitudinal Section showing bar curtailment:                           ││
│ │   ──────────────────────────────────────────────────────                   ││
│ │   Bar A (20φ) ═══════════════════════════════════════ full span + Ld     ││
│ │   Bar B (20φ) ════════════════════ curtailed at L/3 + Ld                 ││
│ │   Bar C (16φ) ════ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ═══════ top crank bars     ││
│ │                                                                            ││
│ └────────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│ ── Schedule Table ──                                                         │
│ ┌───┬──────┬───┬─────┬──────┬───────┬────────┬──────────┬──────────────────┐│
│ │ # │ Bar  │ φ │ No. │Length│ Shape │Bend Len│Unit Wt   │Total Wt          ││
│ │   │ Mark │mm │     │ (mm) │ Code  │ (mm)   │(kg)      │(kg)              ││
│ ├───┼──────┼───┼─────┼──────┼───────┼────────┼──────────┼──────────────────┤│
│ │ 1 │ A    │20 │ 4   │ 5940 │ ──── │ 5940   │ 14.67    │ 58.68            ││
│ │ 2 │ B    │20 │ 2   │ 3080 │ ──── │ 3080   │  7.61    │ 15.22            ││
│ │ 3 │ C    │16 │ 2   │ 4250 │ ╱──╲ │ 4450   │  6.96    │ 13.92            ││
│ │ 4 │ D    │16 │ 2   │ 5940 │ ──── │ 5940   │  9.30    │ 18.60            ││
│ │ 5 │ E    │ 8 │ 37  │ 1440 │ □    │ 1440   │  0.57    │ 21.09            ││
│ ├───┼──────┼───┼─────┼──────┼───────┼────────┼──────────┼──────────────────┤│
│ │   │TOTAL │   │     │      │       │        │          │ 127.51 kg        ││
│ └───┴──────┴───┴─────┴──────┴───────┴────────┴──────────┴──────────────────┘│
│                                                                               │
│ Shape codes (IS SP:34):                                                      │
│ ──── Straight    ╱──╲ Crank    └──┘ U-bar    □ Stirrup    ╗ Hook           │
│                                                                               │
│ Development Length (Ld): 20φ in M30 = 940mm (IS 456 Cl.26.2.1)             │
│                                                                               │
│ [Generate for All Beams]  [Generate for All Columns]  [Full Project BBS]    │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 20.5 Parametric Modeling

### Parametric Definition Panel
```
┌──────────────────────────────────────────┐
│ Parametric Model                    [✕]  │
├──────────────────────────────────────────┤
│                                          │
│ ── Parameters ──                         │
│                                          │
│ Bay Width (B):                          │
│ [═══════════○═══] 6.0 m                │
│ Min: 3.0  Max: 12.0  Step: 0.5         │
│                                          │
│ Storey Height (H):                      │
│ [══════○════════] 3.6 m                │
│ Min: 2.7  Max: 6.0  Step: 0.3          │
│                                          │
│ Number of Bays (Nx):                    │
│ [═══○══════════] 3                      │
│ Min: 1   Max: 10   Step: 1             │
│                                          │
│ Number of Storeys (Ny):                 │
│ [═════○════════] 5                      │
│ Min: 1   Max: 30   Step: 1             │
│                                          │
│ Column Section:                          │
│ [ISMB 600             ▾]               │
│                                          │
│ Beam Section:                            │
│ [ISMB 400             ▾]               │
│                                          │
│ ── Constraints ──                        │
│ ☑ Max drift < H/250                    │
│ ☑ UR < 0.85                            │
│ ☐ Min weight                            │
│                                          │
│ ── Live Preview ──                       │
│ Model updates in real-time in the 3D    │
│ viewport as sliders are moved.           │
│                                          │
│ Members: 39  |  Nodes: 24               │
│ Est. Weight: 27,397 kg                  │
│                                          │
│ [Generate Model]  [Reset to Default]    │
│                                          │
└──────────────────────────────────────────┘
```

---

## 20.6 Batch Processing

### Batch Run Dialog
```
┌───────────────────────────────────────────────────────────────────┐
│ Batch Processing                                           [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Operation: [Run Analysis + Design   ▾]                           │
│                                                                   │
│ ── Select Projects ──                                            │
│ ☑ ABC_Office_Tower.blb               Status: Ready              │
│ ☑ Highway_Bridge_Span1.blb           Status: Ready              │
│ ☑ Warehouse_Design.blb               Status: Ready              │
│ ☐ Residential_Block_A.blb            Status: Needs sections     │
│ ☑ Steel_Truss_Roof.blb               Status: Ready              │
│                                                                   │
│ ── Options ──                                                    │
│ Analysis type:  [Linear Static    ▾]                            │
│ Design code:    [IS 800:2007      ▾]                            │
│ ☑ Generate PDF reports                                          │
│ ☑ Export results to Excel                                       │
│ ☐ Optimize sections after design                                │
│                                                                   │
│ Output folder: [/Users/projects/batch_results     ] [Browse]    │
│                                                                   │
│ ── Progress ──                                                   │
│ ┌───────────────────────────────────────────────────────────────┐│
│ │ Overall: ██████████████░░░░░░░░░░░░░░░░░░  3/4 projects    ││
│ │                                                               ││
│ │ ✓ ABC_Office_Tower          — 12.4s  — All checks pass      ││
│ │ ✓ Highway_Bridge_Span1      —  8.2s  — 2 warnings          ││
│ │ ✓ Warehouse_Design          —  3.1s  — All checks pass      ││
│ │ ◉ Steel_Truss_Roof          — Running analysis...           ││
│ │   ███████████░░░░░░░░░░░  45%                                ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                   │
│ Estimated time remaining: ~5 seconds                             │
│                                                                   │
│ [Start Batch]  [Cancel]  [View Results]                         │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 20.7 Cost Estimation Module

### Layout
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Cost Estimation                                              [Export] [✕]    │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ ── Rate Input ──                                                             │
│ ┌────────────────────────┬───────────────┬──────────────────────────────────┐│
│ │ Item                   │ Rate          │ Source                           ││
│ ├────────────────────────┼───────────────┼──────────────────────────────────┤│
│ │ Steel (structural)     │ ₹72/kg       │ DSR 2024 / Manual               ││
│ │ Concrete M25           │ ₹6,800/m³    │ DSR 2024 / Manual               ││
│ │ Concrete M30           │ ₹7,500/m³    │ DSR 2024 / Manual               ││
│ │ Concrete M35           │ ₹8,200/m³    │ DSR 2024 / Manual               ││
│ │ Rebar Fe500D           │ ₹65/kg       │ DSR 2024 / Manual               ││
│ │ Formwork (plywood)     │ ₹450/m²      │ DSR 2024 / Manual               ││
│ │ Excavation             │ ₹250/m³      │ DSR 2024 / Manual               ││
│ │ PCC (M15)              │ ₹5,200/m³    │ DSR 2024 / Manual               ││
│ └────────────────────────┴───────────────┴──────────────────────────────────┘│
│                                                                               │
│ [Load DSR 2024 Rates]  [Load Custom Rates]  [Save Rate Card]               │
│                                                                               │
│ ── Cost Breakdown Chart ──                                                   │
│ ┌───────────────────────────────────────────────────────────────────────────┐│
│ │                                                                           ││
│ │  Steel      ████████████████████████  39%  ₹19.81L                      ││
│ │  Concrete   █████████████████         27%  ₹13.33L                      ││
│ │  Rebar      ████████████              17%  ₹ 8.45L                      ││
│ │  Formwork   ██████████                 8%  ₹ 4.13L                      ││
│ │  Excavation ████                       4%  ₹ 2.10L                      ││
│ │  PCC        ███                        3%  ₹ 1.56L                      ││
│ │  Misc       ██                         2%  ₹ 1.02L                      ││
│ │                                                                           ││
│ │  ── Pie Chart (alternate view) ──                                        ││
│ │       ┌──────┐                                                            ││
│ │      /  Steel \                                                           ││
│ │     │  39%     │ ←── dominant cost                                       ││
│ │      \ Conc  /                                                            ││
│ │       └──────┘                                                            ││
│ │                                                                           ││
│ └───────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│ ── Optimization Suggestion ──                                                │
│ 💡 Switching columns from ISMB 600 to ISHB 450 saves ₹2.3L (4.5%)        │
│    while maintaining UR < 0.85. [Apply Suggestion]                          │
│                                                                               │
│ Total Estimated Cost:  ₹50,40,000 + 18% GST = ₹59,47,200                 │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 20.8 Optimization Workflows

### Section Optimization Dialog
```
┌───────────────────────────────────────────────────────────────────┐
│ Section Optimization                                        [✕]  │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Objective: ● Minimize Weight  ○ Minimize Cost  ○ Min Deflection │
│                                                                   │
│ ── Member Groups ──                                              │
│ ┌─────────────┬──────────────┬─────────────────┬────────────────┐│
│ │ Group       │ Current      │ Pool            │ Constraints    ││
│ ├─────────────┼──────────────┼─────────────────┼────────────────┤│
│ │ Columns     │ ISMB 600     │ ISMB 400-600    │ UR ≤ 0.85     ││
│ │ Beams L1-3  │ ISMB 400     │ ISMB 300-500    │ UR ≤ 0.90     ││
│ │ Beams L4-5  │ ISMB 300     │ ISMB 200-400    │ UR ≤ 0.90     ││
│ │ Bracing     │ ISA 100×65   │ ISA 75-150      │ UR ≤ 0.80     ││
│ └─────────────┴──────────────┴─────────────────┴────────────────┘│
│                                                                   │
│ ── Global Constraints ──                                         │
│ Max storey drift: H/250                                         │
│ Max roof deflection: L/300                                      │
│ Min natural period exclude soft storey: [Auto]                  │
│                                                                   │
│ Method: [Genetic Algorithm  ▾]                                  │
│ Max iterations: [500]                                           │
│ Population size: [50]                                           │
│                                                                   │
│ ── Convergence Plot ──                                           │
│  Weight│                                                          │
│ (tons) │╲                                                        │
│   30───┤ ╲╲                                                      │
│   28───┤   ╲                                                     │
│   26───┤    ╲───╲                                                │
│   24───┤         ╲──────────  ← converged                       │
│   22───┤                                                          │
│        ┼───┬───┬───┬───┬───                                      │
│        0  100 200 300 400                                         │
│                Iteration                                          │
│                                                                   │
│ ── Results ──                                                    │
│ Weight reduction: 27.4 → 23.8 tons (−13.1%)                    │
│ Cost reduction: ₹19.81L → ₹17.14L (−₹2.67L)                  │
│ All checks: ✓ Pass (worst UR = 0.84 at Member 23)             │
│                                                                   │
│ [Apply Optimized Sections]  [Export Comparison]  [Cancel]       │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 20.9 Template Library (Expanded)

### Template Browser
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Template Library                                                       [✕]  │
├──────────────────┬────────────────────────────────────────────────────────────┤
│ Categories       │ Sort: [Most Popular ▾]  Search: [🔍 ________]          │
│                  │                                                            │
│ 📁 All           │ ┌────────────┐ ┌────────────┐ ┌────────────┐            │
│ 📁 Frames        │ │ ┌──┬──┐   │ │ △△△△       │ │ ┌──┐       │            │
│   Portal Frame   │ │ │  │  │   │ │╱╲╱╲╱╲╱╲   │ │ │  │       │            │
│   Multi-storey   │ │ ├──┼──┤   │ │────────────│ │ ├──┤       │            │
│   Gable Frame    │ │ │  │  │   │ │            │ │ │  │       │            │
│ 📁 Trusses       │ │ 2-Bay Portal│ │ Pratt Truss │ │ Cantilever │            │
│   Pratt          │ │ ★★★★★ (128)│ │ ★★★★☆ (72)│ │ ★★★★☆ (65)│            │
│   Warren         │ │ By: BeamLab │ │ By: BeamLab│ │ By: BeamLab│            │
│   Howe           │ │ [Use →]    │ │ [Use →]   │ │ [Use →]    │            │
│   Fink           │ └────────────┘ └────────────┘ └────────────┘            │
│ 📁 Bridges       │                                                            │
│ 📁 Foundations   │ ┌────────────┐ ┌────────────┐ ┌────────────┐            │
│ 📁 Tanks         │ │ ┌──┬──┬──┐│ │ ∩∩∩∩∩∩     │ │ ╔══╗       │            │
│ 📁 Towers        │ │ ├──┼──┼──┤│ │ ║║║║║║     │ │ ║  ║       │            │
│ 📁 Slabs         │ │ ├──┼──┼──┤│ │ ╚══════╝   │ │ ╠══╣       │            │
│ 📁 Stairs        │ │ 5-Storey   │ │ Arch Bridge│ │ Overhead   │            │
│ 📁 Retaining     │ │ Office     │ │            │ │ Water Tank │            │
│    Walls         │ │ ★★★★★ (94)│ │ ★★★☆☆ (31)│ │ ★★★★☆ (56)│            │
│ 📁 Custom        │ │ By: BeamLab│ │ By: Community││By: BeamLab│            │
│ 📁 Community     │ │ [Use →]   │ │ [Use →]    │ │ [Use →]    │            │
│                  │ └────────────┘ └────────────┘ └────────────┘            │
│                  │                                                            │
│ [Upload Template]│ Showing 1-6 of 48 templates      [1] [2] [3] ... [8]   │
│                  │                                                            │
└──────────────────┴────────────────────────────────────────────────────────────┘
```

### Template Preview
```
┌───────────────────────────────────────────────────────────────────┐
│ Template: 5-Storey Office Frame                            [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌───────────────────────────────────────────────────────────────┐│
│ │                                                               ││
│ │   Interactive 3D preview of the template structure           ││
│ │   (rotatable)                                                 ││
│ │                                                               ││
│ │           ┌──┬──┬──┐                                         ││
│ │           ├──┼──┼──┤                                         ││
│ │           ├──┼──┼──┤                                         ││
│ │           ├──┼──┼──┤                                         ││
│ │           ├──┼──┼──┤                                         ││
│ │           ╧  ╧  ╧  ╧                                         ││
│ │                                                               ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                   │
│ Description:                                                     │
│ Standard 3-bay, 5-storey reinforced concrete office frame       │
│ designed per IS 456:2000 and IS 1893:2016. Includes gravity     │
│ and seismic loads for Zone III, medium soil.                     │
│                                                                   │
│ Details:                                                         │
│ • Nodes: 24  |  Members: 39  |  Plates: 0                      │
│ • Bays: 3 × 6m  |  Storeys: 5 × 3.6m (GF: 4.5m)             │
│ • Sections: ISMB 600 (cols), ISMB 400 (beams)                  │
│ • Loads: DL, LL, EQx, EQy, Wind                                │
│ • Combinations: IS 875-III / IS 1893                            │
│ • Design code: IS 800:2007                                      │
│                                                                   │
│ Customizable parameters:                                         │
│ Bay width:      [6.0  ] m                                       │
│ Storey height:  [3.6  ] m                                       │
│ Number of bays: [3    ]                                         │
│ Number of storeys: [5 ]                                         │
│                                                                   │
│ [Use This Template]  [Preview Full Model]  [Cancel]             │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 20.10 Comparison / What-If Analysis

### Side-by-Side Comparison
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Design Comparison                                                      [✕]  │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ Comparing: [Option A: ISMB ▾] vs [Option B: ISHB ▾] vs [+ Add Option]     │
│                                                                               │
│ ┌──────────────────┬────────────────────┬────────────────────┐               │
│ │ Parameter        │ Option A (ISMB)    │ Option B (ISHB)    │               │
│ ├──────────────────┼────────────────────┼────────────────────┤               │
│ │ Total weight     │ 27,397 kg          │ 24,102 kg  ✓ best │               │
│ │ Total cost       │ ₹19.81L           │ ₹17.35L    ✓ best │               │
│ │ Max UR           │ 0.78               │ 0.84               │               │
│ │ Max deflection   │ 11.2 mm            │ 14.8 mm            │               │
│ │ Max drift ratio  │ H/312              │ H/267       ⚠     │               │
│ │ Analysis time    │ 0.3s               │ 0.3s               │               │
│ │ Overall verdict  │ Conservative       │ Economical  ★     │               │
│ └──────────────────┴────────────────────┴────────────────────┘               │
│                                                                               │
│ Recommendation: Option B saves ₹2.46L (12.4%) while meeting all code      │
│ requirements. Consider if H/267 drift is acceptable per IS 1893.            │
│                                                                               │
│ [Apply Option A] [Apply Option B] [Generate Comparison Report]              │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 20.11 Earthquake Simulation Viewer

### Layout
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Earthquake Simulation — El Centro N-S (1940)                          [✕]   │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ ┌───────────────────────────────────────────────────────────────────────────┐│
│ │                                                                           ││
│ │  3D Viewport with animated structural response                           ││
│ │                                                                           ││
│ │  Model deforms in real-time based on time-history                        ││
│ │  Color gradient shows instantaneous stress levels                        ││
│ │                                                                           ││
│ │  Time: 4.23s    Scale: 50x    Speed: [0.5x] [1x] [2x]                  ││
│ │                                                                           ││
│ │  [⏮] [⏪] [▶ / ⏸] [⏩] [⏭]                                           ││
│ │  ═══════════════●══════════════════════  timeline scrubber               ││
│ │  0s            4.23s                                    40s              ││
│ │                                                                           ││
│ └───────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│ ┌─────────────────────────────────────────────┬─────────────────────────────┐│
│ │ Ground Acceleration                         │ Roof Displacement          ││
│ │                                             │                             ││
│ │  g │    ╱╲                                  │ mm│       ╱╲               ││
│ │ 0.3┤   ╱  ╲ ╱╲                             │ 50┤      ╱  ╲              ││
│ │  0 ─┤╱╲╱    ╲  ╲╱╲╱───                    │  0─┤╱╲╱╲╱    ╲╱───        ││
│ │-0.3┤                                       │-50┤                         ││
│ │    ┼─┬─┬─┬─┬─┬─┬─┬─                       │   ┼─┬─┬─┬─┬─┬─┬─          ││
│ │    0  5  10 15 20 25 30  t(s)              │   0  5  10 15 20 25  t(s) ││
│ │         ↑ current time                      │        ↑ current time      ││
│ └─────────────────────────────────────────────┴─────────────────────────────┘│
│                                                                               │
│ Peak values: Max accel: 0.319g @ 2.12s | Max displacement: 48.2mm @ 4.01s  │
│ Max base shear: 1,234 kN | Max storey drift: H/198 (Storey 3)              │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 20.12 Drawing / Drafting Module

### 2D Drawing Editor
```
┌───────────────────────────────────────────────────────────────────────────────┐
│ Drawing Editor — Beam B1 Detail                              [Export] [✕]   │
├───────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│ Tools: [Line] [Arc] [Dim] [Text] [Hatch] [Symbol] │ [Layer ▾] [Scale ▾]  │
│                                                                               │
│ ┌───────────────────────────────────────────────────────────────────────────┐│
│ │                                                                           ││
│ │  Drawing canvas with auto-generated structural detail:                    ││
│ │                                                                           ││
│ │  ← 6000 →                                                                ││
│ │  ┌────────────────────────────────────────────────────┐                   ││
│ │  │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ ↑                  ││
│ │  │░ ○ ─────────────────────────────────────────── ○ ░│ │                  ││
│ │  │░                                                ░│ 500                ││
│ │  │░ ○ ── ○ ── ○ ── ○ ── ○ ── ○ ── ○ ── ○ ── ○ ── ░│ │                  ││
│ │  │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│ ↓                  ││
│ │  └────────────────────────────────────────────────────┘                   ││
│ │  ← 300 →                                                                 ││
│ │                                                                           ││
│ │  Section A-A:                                                             ││
│ │  ┌──────────┐   ← 300                                                   ││
│ │  │ 2-16φ    │                                                            ││
│ │  │          │ ↑ 500                                                      ││
│ │  │ 4-20φ    │ ↓                                                          ││
│ │  └──────────┘                                                            ││
│ │  8φ@150 c/c stirrups                                                     ││
│ │                                                                           ││
│ │  Dimensions in mm | Scale: 1:25                                          ││
│ │                                                                           ││
│ └───────────────────────────────────────────────────────────────────────────┘│
│                                                                               │
│ Layers: [✓] Concrete  [✓] Rebar  [✓] Dimensions  [✓] Text  [ ] Grid      │
│                                                                               │
│ [Auto-Generate from Model]  [Add to Report]  [Export DXF]                   │
│                                                                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 20.13 Profile / Stamp Editor

### Engineer's Stamp/Seal
```
┌───────────────────────────────────────────────────────────────────┐
│ Engineer's Stamp                                            [✕]  │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Preview:                                                         │
│ ┌───────────────────────────────────────────────────────────────┐│
│ │                                                               ││
│ │       ╔═══════════════════════════════════════╗               ││
│ │       ║   PROFESSIONAL ENGINEER               ║               ││
│ │       ║                                       ║               ││
│ │       ║   NAME: Er. Rakshit Tiwari           ║               ││
│ │       ║   LIC NO: CE/2024/XXXXX              ║               ││
│ │       ║   VALIDITY: 31-Dec-2025              ║               ││
│ │       ║                                       ║               ││
│ │       ║               [Signature]             ║               ││
│ │       ║                                       ║               ││
│ │       ╚═══════════════════════════════════════╝               ││
│ │                                                               ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                   │
│ Fields:                                                          │
│ Name:       [Er. Rakshit Tiwari          ]                      │
│ License No: [CE/2024/XXXXX               ]                      │
│ Validity:   [31-Dec-2025                 ]                      │
│ Company:    [XYZ Consulting Engineers    ]                       │
│ Address:    [Bangalore, Karnataka        ]                       │
│                                                                   │
│ Signature:  [Upload Image]  or  [Draw Signature ✍]             │
│ Stamp:      [Upload Seal Image]                                  │
│                                                                   │
│ ☑ Include on all reports and drawings                           │
│ ☑ Include on calculation sheets                                 │
│                                                                   │
│ [Save]  [Preview on Report]  [Cancel]                           │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```
