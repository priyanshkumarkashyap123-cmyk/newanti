# 10 — Analysis Engine UI
## BeamLab Ultimate Figma Specification

---

## 10.1 Analysis Setup Dialog

### Main Analysis Configuration
```
┌───────────────────────────────────────────────────────────────────┐
│ Analysis Setup                                              [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌────────────────────────────────────────────────────────────────┐│
│ │ Linear │ P-Delta │ Buckling │ Modal │ Response │ Nonlinear   ││
│ │ Static │         │          │       │ Spectrum │             ││
│ └────────────────────────────────────────────────────────────────┘│
│                                                                   │
│ ══════════════════════════════════════════════════════════════    │
│ LINEAR STATIC ANALYSIS                                           │
│ ══════════════════════════════════════════════════════════════    │
│                                                                   │
│ Load Cases to Analyze:                                           │
│ ☑ LC1: Dead Load (DL)                                           │
│ ☑ LC2: Live Load (LL)                                           │
│ ☑ LC3: Wind Load X (WLx)                                       │
│ ☑ LC4: Wind Load Z (WLz)                                       │
│ ☑ LC5: Seismic X (EQx)                                         │
│ ☑ LC6: Seismic Z (EQz)                                         │
│ ☐ LC7: Temperature (TEMP)                                       │
│                                                                   │
│ Load Combinations:                                               │
│ ☑ Use defined combinations (9 combinations + 1 envelope)        │
│ ☐ Analyze individual load cases only                            │
│                                                                   │
│ Options:                                                         │
│ ☑ Include self-weight in DL case                                │
│ ☐ Large displacement effects                                    │
│ ☐ Shear deformation (Timoshenko beam)                           │
│                                                                   │
│ Solver Engine:                                                   │
│ ● WASM (Rust — GPU accelerated)                                 │
│ ○ JavaScript (fallback)                                         │
│ ○ Backend (Python — large models)                               │
│                                                                   │
│ ── Pre-Analysis Check ──                                        │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ ✅ Model geometry valid (24 nodes, 32 members)              │ │
│ │ ✅ All members have sections assigned                        │ │
│ │ ✅ All members have materials assigned                       │ │
│ │ ✅ Supports defined (4 fixed supports)                       │ │
│ │ ✅ Loads defined (7 load cases, 42 loads total)              │ │
│ │ ✅ Structure is stable (no mechanisms detected)              │ │
│ │ ✅ No disconnected members                                   │ │
│ │ ✅ Estimated DOF: 120 → Solver can handle                    │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ Estimated time: ~2 seconds                                       │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│          [Cancel]    [Run Pre-Check Only]    [▶ Run Analysis]    │
└───────────────────────────────────────────────────────────────────┘
```

### P-Delta Analysis Tab
```
┌───────────────────────────────────────────────────────────────────┐
│ P-DELTA (SECOND-ORDER) ANALYSIS                                   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Method:                                                          │
│ ● Iterative geometric stiffness update                          │
│ ○ Linearized P-Delta (single iteration)                         │
│                                                                   │
│ Convergence Criteria:                                            │
│ Max iterations:        [ 20  ]                                   │
│ Displacement tolerance:[ 0.001 ] (fraction)                     │
│ Force tolerance:       [ 0.01  ] (fraction)                      │
│                                                                   │
│ Gravity Load Case for P-Delta:                                   │
│ [LC1: Dead Load ▾]  Factor: [ 1.0 ]                            │
│ [+ Add gravity case]                                             │
│                                                                   │
│ Options:                                                         │
│ ☑ Include P-delta (frame level sway)                            │
│ ☑ Include P-small-delta (member level bow)                      │
│ ☐ Include large displacement (geometric nonlinearity)           │
│                                                                   │
│ ── What is P-Delta? ──   [ℹ️ Learn More]                        │
│ Second-order analysis accounts for the additional               │
│ moments caused by axial loads acting through                     │
│ displaced positions of the structure.                            │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                    [Cancel]            [▶ Run P-Delta Analysis]  │
└───────────────────────────────────────────────────────────────────┘
```

### Buckling Analysis Tab
```
┌───────────────────────────────────────────────────────────────────┐
│ BUCKLING ANALYSIS (EIGENVALUE)                                    │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Number of buckling modes: [ 5 ]                                  │
│                                                                   │
│ Reference Load Case: [LC1: Dead Load ▾]                         │
│ Load Factor: [ 1.0 ]                                             │
│                                                                   │
│ Method:                                                          │
│ ● Subspace iteration                                            │
│ ○ Lanczos                                                       │
│ ○ Inverse iteration                                             │
│                                                                   │
│ Options:                                                         │
│ ☑ Include geometric stiffness effects                           │
│ ☐ Use stress stiffening                                         │
│                                                                   │
│ Output:                                                          │
│ ☑ Critical load factors (λ₁, λ₂, ... λₙ)                      │
│ ☑ Buckling mode shapes                                          │
│ ☑ Effective length factors (K)                                  │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                    [Cancel]           [▶ Run Buckling Analysis]  │
└───────────────────────────────────────────────────────────────────┘
```

### Modal Analysis Tab
```
┌───────────────────────────────────────────────────────────────────┐
│ MODAL / DYNAMIC ANALYSIS                                          │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Analysis Type:                                                   │
│ ● Free vibration (natural frequencies & mode shapes)            │
│ ○ Response spectrum analysis                                    │
│ ○ Time history analysis                                         │
│                                                                   │
│ Number of modes: [ 12 ]                                          │
│                                                                   │
│ Mass Source:                                                     │
│ ☑ Structural mass (from sections & materials)                   │
│ ☑ Additional mass from loads:                                   │
│   LC1 (DL) × [ 1.0 ] + LC2 (LL) × [ 0.25 ]                   │
│                                                                   │
│ Mass Lumping:                                                    │
│ ● Lumped (diagonal mass matrix)                                 │
│ ○ Consistent (full mass matrix)                                 │
│                                                                   │
│ Eigensolver:                                                     │
│ ● Lanczos (recommended for large models)                        │
│ ○ Subspace iteration                                            │
│ ○ Jacobi (small models only)                                    │
│                                                                   │
│ Options:                                                         │
│ ☑ Compute modal participation factors                           │
│ ☑ Compute mass participation ratios                             │
│ ☐ Include Ritz vectors                                          │
│ ☐ P-Delta stiffness in modal analysis                           │
│                                                                   │
│ Frequency range of interest:                                     │
│ Min: [ 0.1 ] Hz     Max: [ 50 ] Hz                             │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                    [Cancel]            [▶ Run Modal Analysis]    │
└───────────────────────────────────────────────────────────────────┘
```

### Response Spectrum Tab
```
┌───────────────────────────────────────────────────────────────────┐
│ RESPONSE SPECTRUM ANALYSIS                                        │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Spectrum Source:                                                  │
│ ● IS 1893:2016 design spectrum                                  │
│ ○ Custom spectrum (input table)                                 │
│ ○ Site-specific spectrum                                        │
│                                                                   │
│ IS 1893 Parameters:                                              │
│ Zone: [IV ▾]  Soil: [Type II ▾]  I: [1.5]  R: [5.0]          │
│                                                                   │
│ ┌──────────────────────────────────────────────┐                 │
│ │ Sa/g ↑    Design Spectrum                    │                 │
│ │ 2.5 ─┐────┐                                  │                 │
│ │      │    │╲                                 │                 │
│ │ 1.5 ─│    │  ╲____                          │                 │
│ │      │    │       ╲____                     │                 │
│ │ 0.5 ─│    │            ╲____                │                 │
│ │    0 ─┼────┼──────┼──────┼──────→ T(s)       │                 │
│ │       0   0.55   1.0   2.0   4.0             │                 │
│ └──────────────────────────────────────────────┘                 │
│                                                                   │
│ Modal Combination Method:                                        │
│ ● CQC (Complete Quadratic Combination)                          │
│ ○ SRSS (Square Root of Sum of Squares)                          │
│ ○ ABS (Absolute Sum)                                            │
│                                                                   │
│ Direction:                                                       │
│ ☑ X direction   Scale: [ 1.0 ]                                 │
│ ☑ Z direction   Scale: [ 1.0 ]                                 │
│ ☐ Y direction   Scale: [ 0.67 ]                                │
│                                                                   │
│ Directional Combination:                                         │
│ ● 100-30 rule (IS 1893)                                        │
│ ○ SRSS                                                          │
│                                                                   │
│ Missing Mass:                                                    │
│ ☑ Include missing mass correction                               │
│ Required participation: [ 90 ] %                                │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│                [Cancel]      [▶ Run Response Spectrum Analysis]  │
└───────────────────────────────────────────────────────────────────┘
```

### Nonlinear Analysis Tab
```
┌───────────────────────────────────────────────────────────────────┐
│ NONLINEAR ANALYSIS                                                │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Nonlinearity Type:                                               │
│ ☑ Geometric (large displacements)                               │
│ ☑ Material (plasticity)                                         │
│ ☐ Contact / gap elements                                        │
│                                                                   │
│ Analysis Sub-type:                                               │
│ ● Static pushover                                               │
│ ○ Cyclic loading                                                │
│ ○ Dynamic nonlinear (time history)                              │
│                                                                   │
│ ── Pushover Setup ──                                             │
│ Push Pattern:                                                    │
│ ● Inverted triangular                                           │
│ ○ Uniform                                                       │
│ ○ First mode shape                                              │
│ ○ Custom displacement pattern                                   │
│                                                                   │
│ Push Direction: ● +X  ○ -X  ○ +Z  ○ -Z                        │
│                                                                   │
│ Control:                                                         │
│ ● Displacement control                                          │
│ ○ Load control                                                  │
│ Target displacement: [ 0.200 ] m (roof)                         │
│                                                                   │
│ Load Steps: [ 50 ]                                               │
│ Max iterations per step: [ 100 ]                                 │
│                                                                   │
│ Hinge Properties:                                                │
│ ● Auto (ASCE 41-17 Table)                                      │
│ ○ Custom moment-rotation curve                                  │
│                                                                   │
│ ┌────────────────────────────────────────────┐                   │
│ │ M/My ↑     Hinge Model                    │                   │
│ │  1.0 ─┬──────B─────C                      │                   │
│ │       │     ╱       │╲                    │                   │
│ │  0.5 ─│    ╱        │  D──E               │                   │
│ │       │   ╱         │                      │                   │
│ │   0  ─A──╱──────────┼──────→ θ/θy         │                   │
│ │       0  1    a     b  c                   │                   │
│ │  Yield  IO  LS  CP                         │                   │
│ └────────────────────────────────────────────┘                   │
│                                                                   │
│ Performance Levels:                                              │
│ ☑ IO (Immediate Occupancy): θ = [ 0.005 ] rad                 │
│ ☑ LS (Life Safety):         θ = [ 0.015 ] rad                 │
│ ☑ CP (Collapse Prevention): θ = [ 0.025 ] rad                 │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│              [Cancel]          [▶ Run Pushover Analysis]         │
└───────────────────────────────────────────────────────────────────┘
```

---

## 10.2 Analysis Progress Overlay

### During Analysis
```
┌───────────────────────────────────────────────────────────────────┐
│                                                                   │
│                    ⚙️ Running Analysis                            │
│                                                                   │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  72%                   │
│                                                                   │
│  Step 3 of 4: Solving load case LC3 (Wind X)                    │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ ✅ Assembling stiffness matrix        0.3s                   ││
│  │ ✅ Applying boundary conditions       0.1s                   ││
│  │ ✅ LC1: Dead Load                     0.4s                   ││
│  │ ✅ LC2: Live Load                     0.3s                   ││
│  │ ⏳ LC3: Wind Load X                   solving...             ││
│  │ ○  LC4: Wind Load Z                   pending                ││
│  │ ○  LC5: Seismic X                     pending                ││
│  │ ○  LC6: Seismic Z                     pending                ││
│  │ ○  Computing combinations             pending                ││
│  │ ○  Post-processing results            pending                ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                   │
│  Solver: WASM (Rust)  │  DOF: 120  │  Elapsed: 1.2s            │
│  Memory: 12 MB / 256 MB available                                │
│                                                                   │
│                        [Cancel Analysis]                         │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

Style notes:
  Background: semi-transparent dark overlay over viewport
  Progress bar: gradient from #3b82f6 to #8b5cf6
  Completed steps: green checkmark ✅
  Current step: spinning loader ⏳ + pulsing highlight
  Pending: hollow circle ○ + muted text
  Animation: smooth progress bar transition
```

### Convergence Plot (for iterative analyses)
```
┌───────────────────────────────────────────────────────────────────┐
│ Convergence Monitor                                         [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ┌──────────────────────────────────────────────────────────────┐ │
│ │ Error ↑                                                      │ │
│ │  10⁰ ─│●                                                    │ │
│ │       ─│                                                      │ │
│ │  10⁻¹─│ ●                                                   │ │
│ │       ─│                                                      │ │
│ │  10⁻²─│  ●                                                  │ │
│ │       ─│   ●                                                  │ │
│ │  10⁻³─│───●────── tolerance ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─    │ │
│ │       ─│    ●                                                 │ │
│ │  10⁻⁴─│     ● ← converged                                  │ │
│ │       ─│                                                      │ │
│ │   0   ─┼──┬──┬──┬──┬──┬──┬──┬──┬──→ Iteration               │ │
│ │        0  1  2  3  4  5  6  7  8                              │ │
│ └──────────────────────────────────────────────────────────────┘ │
│                                                                   │
│ Iteration: 6  │  Error: 4.2×10⁻⁴  │  Status: ✅ Converged     │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 10.3 Analysis Complete Summary

### Success State
```
┌───────────────────────────────────────────────────────────────────┐
│                                                                   │
│                    ✅ Analysis Complete                           │
│                                                                   │
│  Total time: 2.4 seconds                                        │
│  Solver: WASM (Rust GPU-accelerated)                             │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ Summary                                                      ││
│  ├──────────────────────────────────────────────────────────────┤│
│  │ Nodes: 24  │  Members: 32  │  DOF: 120  │  Load Cases: 6   ││
│  │ Combinations: 10  │  Total equations solved: 1,200          ││
│  ├──────────────────────────────────────────────────────────────┤│
│  │                                                              ││
│  │ Max Displacement: 12.4 mm at N15 (LC2)                      ││
│  │ Max Reaction: 342.5 kN at N1 (C4)                          ││
│  │ Max Bending Moment: 185.3 kN·m at M12 (C1)                ││
│  │ Max Shear Force: 98.2 kN at M8 (C1)                       ││
│  │ Max Axial Force: 456.7 kN (compression) at M20 (C4)       ││
│  │                                                              ││
│  │ ⚠️ Warnings:                                               ││
│  │   • Drift ratio at storey 5 = L/285 (limit L/250) — OK    ││
│  │   • Member M22 near slenderness limit (KL/r = 178)        ││
│  │                                                              ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                   │
│  [📊 View Results]  [📋 View Report]  [🔄 Re-Analyze]  [Close] │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

### Error State
```
┌───────────────────────────────────────────────────────────────────┐
│                                                                   │
│                    ❌ Analysis Failed                             │
│                                                                   │
│  Error: Singular stiffness matrix detected                       │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │ Diagnosis:                                                    ││
│  │                                                              ││
│  │ The structure appears to be unstable (mechanism).             ││
│  │ This is usually caused by:                                    ││
│  │                                                              ││
│  │ 1. ⚠️ Insufficient supports → Check support conditions      ││
│  │ 2. ⚠️ Disconnected members → Members M15, M16 appear       ││
│  │    to be floating (no connectivity)                           ││
│  │ 3. ⚠️ All member releases at a joint → Node N8 has all     ││
│  │    connected members released in Mz                           ││
│  │                                                              ││
│  │ Problematic DOFs: Node 8 (rotation Rz), Node 12 (Ty)       ││
│  │                                                              ││
│  │ [🔍 Highlight Problem Areas in Viewport]                    ││
│  │ [📖 Troubleshooting Guide]                                  ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                   │
│             [Fix & Re-Analyze]      [Close]                      │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘

Style notes:
  Error icon: red circle with ✕
  Problem areas highlighted in viewport with red pulsing glow
  Clicking "Highlight Problem Areas" zooms to and selects the nodes/members
```

---

## 10.4 Pre-Analysis Validation Checklist

```
┌───────────────────────────────────────────────────────────────────┐
│ Pre-Analysis Check                                          [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ── Geometry ──                                                   │
│ ✅ Nodes defined: 24                                             │
│ ✅ Members defined: 32                                           │
│ ✅ No overlapping members                                        │
│ ✅ No zero-length members                                        │
│ ✅ All nodes connected                                           │
│ ⚠️ 2 very short members (< 100mm) — M29, M30 [Locate]          │
│                                                                   │
│ ── Properties ──                                                 │
│ ✅ All members have sections (32/32)                             │
│ ✅ All members have materials (32/32)                             │
│ ❌ 2 members missing section: M31, M32 [Assign Now]             │
│                                                                   │
│ ── Supports ──                                                   │
│ ✅ Supports defined: 4 nodes                                     │
│ ✅ Structure is stable (determinacy check passed)                │
│ ✅ No underconstrained directions                                │
│                                                                   │
│ ── Loads ──                                                      │
│ ✅ Load cases defined: 7                                         │
│ ✅ Load combinations defined: 10                                 │
│ ✅ Self-weight included in DL                                    │
│ ⚠️ LC7 (Temperature) has no loads assigned [Open]               │
│                                                                   │
│ ── Stability ──                                                  │
│ ✅ No mechanism detected                                         │
│ ✅ Degree of static indeterminacy: 18                            │
│ ✅ Degree of kinematic indeterminacy: 120 (= DOF)               │
│                                                                   │
│ Overall: ⚠️ 3 warnings, 1 error                                │
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│ [Fix All Issues]           [Ignore Warnings]  [▶ Run Anyway]    │
└───────────────────────────────────────────────────────────────────┘

Status icons:
  ✅ = green check (#22c55e)
  ⚠️ = amber warning (#f59e0b)
  ❌ = red error (#ef4444)
  Each warning/error has a clickable [Locate] or [Fix] link
```
