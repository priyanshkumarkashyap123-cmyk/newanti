# Understanding Total Loading on Your Frame - Complete Explanation

## Quick Summary

When you analyze a frame in BeamLab, the **total loading** consists of:

```
TOTAL LOADING = Applied Node Loads + Member Loads (converted to nodes) + Support Reactions
```

### The Key Principle: **Equilibrium**
```
Applied Loads (↓) = Support Reactions (↑)
```

If these don't match, something is wrong with your structure or loads.

---

## How It Works Step-by-Step

### **Step 1: You Apply Loads to Your Frame**

You can apply loads in multiple ways:

```
┌─────────────────────────────────────┐
│         YOUR STRUCTURE             │
│  N1 ──────── N2 ──────── N3        │
│  │           │           │          │
│  │(F=50kN)   │           │          │
│  M1          M2          M3         │
│  │           │           │          │
│ N4─────────N5─────────N6           │
│ (fixed)    (fixed)                 │
└─────────────────────────────────────┘

Applied Loads:
• Node N2: Downward force = 50 kN (Fy = -50 kN)
• Member M2: Distributed load = 10 kN/m
```

---

### **Step 2: Distributed Loads are Converted to Node Loads**

When you apply a **distributed load (UDL)** on a member, BeamLab converts it to **equivalent nodal forces** using Fixed-End Force theory.

#### Example: 10 kN/m UDL on 6m beam

```
BEFORE (Member Load - UDL):
            10 kN/m
        ┌──────────────┐
        ▼  ▼  ▼  ▼  ▼  ▼ ▼
  N1 ──────────────── N2
  (support)          (support)
  
  Stored as: {type: "UDL", w: -10, direction: "global_y"}


AFTER (Converted to Node Loads - FEM):

  Reactions: R = 10 × 6 ÷ 2 = 30 kN each
  Moments:   M = 10 × 6² ÷ 12 = 30 kN·m each
  
  N1 ○────────────────────○ N2
     ↑30 kN    ⟳30 kN·m ↑30 kN
     
  Applied as:
  {
    nodeId: N1,
    fy: 30,      // Upward (reaction side)
    mz: 30       // Moment counterclockwise
  }
  {
    nodeId: N2,
    fy: 30,
    mz: -30      // Moment clockwise
  }
```

**This is why you see loads at nodes even though you applied them to members!**

---

### **Step 3: Analysis Solves for Support Reactions**

Your FEA solver (Rust backend) does this:

```
Apply loads at all nodes:
┌────────────────────────────────────────────┐
│ LOAD VECTOR {F}:                          │
├────────────────────────────────────────────┤
│ N1: Fy = 0                                 │
│ N2: Fy = -50 - 30 = -80 kN ↓ (total)     │
│ N3: Fy = 0                                 │
│ N4: Fy = ? (UNKNOWN - solve)              │
│ N5: Fy = ? (UNKNOWN - solve)              │
│ N6: Fy = ? (UNKNOWN - solve)              │
├─────────────────────────────────────────── ┤
│ Global stiffness equation:                 │
│ [K] × {u} = {F}                           │
│                                            │
│ Solve for: {u} = displacements            │
│ Then:      {R} = reactions at supports    │
└────────────────────────────────────────────┘
```

---

## How the Website Shows Total Loading

### **What the Dashboard Displays**

When you finish analysis, you see in **AnalysisResultsDashboard**:

#### **1. Reaction Totals (Equilibrium Check)**

```
╔════════════════════════════════════════╗
║    REACTION TOTALS                     ║
║    (Equilibrium Check)                 ║
╠════════════════════════════════════════╣
║  ΣFx = +0.00 kN  ✓                    ║
║  ΣFy = -80.00 kN ✓                    ║
║  ΣMz = 0.00 kN·m ✓                    ║
╚════════════════════════════════════════╝

What this means:
✓ ΣFy = -80 kN means total of all support reactions = 80 kN UP
```

#### **2. Individual Support Reactions**

```
Node N4 (Support):
├─ Fx = 0 kN
├─ Fy = +30 kN (upward)
└─ Mz = +10 kN·m

Node N5 (Support):
├─ Fx = 0 kN
├─ Fy = +50 kN (upward)
└─ Mz = 0 kN·m

Node N6 (Support):
├─ Fx = 0 kN
├─ Fy = +0 kN
└─ Mz = -10 kN·m

TOTAL REACTIONS: 30 + 50 + 0 = 80 kN ↑
```

---

## The Complete Load Path: 3-Story Building Example

Let's trace the TOTAL LOADING through a real 3-story example:

### **Input Loads**

```
floor_weight = 5 kN/m²
building_dimensions: 6m × 6m × 3 stories

Total floor area = 6×6 = 36 m²
Total load per floor = 5 × 36 = 180 kN
```

### **Structure Generated: 18 Nodes, 39 Members**

```
NODES:
├─ Floor 1: N1-N3 (fixed supports), N4-N6 (interior)
├─ Floor 2: N7-N9 (interior)
└─ Floor 3: N10-N12 (interior)

MEMBERS:
├─ Columns: M1-M18 (connecting floors vertically)
├─ Beams X: M19-M30 (6m span, 2 bays)
└─ Beams Y: M31-M39 (6m span, 1 bay, converted to 3D)
```

### **Load Distribution (3D Tributary Area Method)**

For a 2×1 bay building with 3D depth (6m span):

```
TRIBUTARY WIDTH for 3D (CORRECTED):
Floor load: 5 kN/m²
tributaryWidth = bayWidth / 4 = 6m / 4 = 1.5m
Reason: Two-way slab distributes to beams in BOTH X and Y directions
        Each beam gets 1/4 of the tributary area

Result UDL on each beam:
├─ All beams (X and Y direction): w = 5 × 1.5 = 7.5 kN/m
└─ This ensures no double-counting of floor area

MEMBER LOADS (UDL applied):

Beam M19 (1st floor, bay 0-1, Y=0):
├─ Load: 7.5 kN/m distributed across 6m length
├─ Reactions at nodes: R = 7.5 × 6 ÷ 2 = 22.5 kN each
└─ Converted nodal forces: 22.5 kN UP at each end

Beam M20 (1st floor, bay 1-2, Y=0):
├─ Load: 7.5 kN/m
├─ Reactions: R = 22.5 kN each
└─ Applied to next pair of nodes

... (same for 11 more X-beams on each floor)

Beam M31 (1st floor, Y-direction, X=0):
├─ Load: 7.5 kN/m (same tributary width for two-way slab)
├─ Applied force from tributary share
└─ Reactions at Y-endpoints: 22.5 kN each

... (9 Y-beams × 3 floors = 27 loads)

Total beams carrying load: 21 beams
Load per beam: 7.5 kN/m × 6m = 45 kN
Total per floor: Floor area (36 m²) × 5 kN/m² = 180 kN ✓
TOTAL MEMBER LOADS correctly sum to floor area load
```

### **Total Applied Load Summary**

```
╔═══════════════════════════════════════════╗
║  APPLIED LOADING SUMMARY                  ║
╠═══════════════════════════════════════════╣
║                                           ║
║  Floor 1 (5 kN/m² × 36 m²) = 180 kN      ║
║  Floor 2 (5 kN/m² × 36 m²) = 180 kN      ║
║  Floor 3 (5 kN/m² × 36 m²) = 180 kN      ║
║                              ─────────    ║
║  TOTAL DOWNWARD LOAD       = 540 kN ↓    ║
║                                           ║
║  Applied as 63 member loads (UDL)        ║
║  Converted to ~126 nodal loads           ║
║  (distributed across 18 nodes)            ║
║                                           ║
╚═══════════════════════════════════════════╝
```

### **Support Reactions (What Website Shows)**

```
╔═══════════════════════════════════════════╗
║  REACTION TOTALS (From Analysis)          ║
╠═══════════════════════════════════════════╣
║                                           ║
║  Support Nodes N1, N2, N3 (fixed):       ║
║  ├─ N1: Fy = +180 kN ↑                   ║
║  ├─ N2: Fy = +180 kN ↑                   ║
║  └─ N3: Fy = +180 kN ↑                   ║
║                          ─────────        ║
║  ΣFy = +540 kN ↑                         ║
║                                           ║
║  EQUILIBRIUM CHECK: ✓                    ║
║  Total Applied = 540 kN ↓                ║
║  Total Reactions = 540 kN ↑              ║
║  Difference = 0.00 kN ✓                  ║
║                                           ║
╚═══════════════════════════════════════════╝
```

---

## Reading the Dashboard Output

### **Section: "Reaction Totals (Equilibrium Check)"**

```
ΣFx = 0.00 kN      → No lateral forces in X
ΣFy = -540.00 kN   → All vertical loads = 540 kN downward
ΣMz = 0.00 kN·m    → Structure not tilting

Positive = Upward/Counterclockwise
Negative = Downward/Clockwise
```

### **What It Means If These Don't Balance**

```
IF: ΣFy = -500 kN (but you applied 540 kN)
PROBLEM: You're missing 40 kN of load

Possible causes:
1. Load was applied to wrong structure
2. 40 kN load not included in input
3. Numerical precision issue (< 0.01 kN is OK)
4. Member/node calculation error
```

---

## Where Is the "Total" Actually Calculated?

In your `/services/ReportGenerator.ts`, when generating reports:

```typescript
// CALCULATE TOTALS
const totalLoadFx = loads.reduce((sum, l) => sum + (l.fx ?? 0), 0);  // All node loads + member loads
const totalLoadFy = loads.reduce((sum, l) => sum + (l.fy ?? 0), 0);  // Sum of applied forces
const totalLoadFz = loads.reduce((sum, l) => sum + (l.fz ?? 0), 0);

const totalReactionFx = reactions.reduce((sum, r) => sum + r.fx, 0);  // All support reactions
const totalReactionFy = reactions.reduce((sum, r) => sum + r.fy, 0);
const totalReactionFz = reactions.reduce((sum, r) => sum + (r.fz ?? 0), 0);

// EQUILIBRIUM CHECK
equilibriumY = Math.abs(totalReactionFy + totalLoadFy) < 0.01;  // Should sum to ~0
```

---

## Summary Table

```
┌─────────────────────┬──────────────────┬─────────────────────────┐
│ Type                │ Where Applied    │ How Displayed           │
├─────────────────────┼──────────────────┼─────────────────────────┤
│ Node Loads          │ Directly to node │ In load panel           │
├─────────────────────┼──────────────────┼─────────────────────────┤
│ Member Loads (UDL)  │ On beam/column   │ Converted to nodes,     │
│                     │                  │ shown as fixed-end      │
│                     │                  │ forces in report        │
├─────────────────────┼──────────────────┼─────────────────────────┤
│ Support Reactions   │ At fixed nodes   │ "Reaction Totals"       │
│                     │                  │ section in results      │
├─────────────────────┼──────────────────┼─────────────────────────┤
│ TOTAL of ALL        │ Summed across    │ "Equilibrium Check" -   │
│ Applied            │ entire structure │ ΣFx, ΣFy, ΣMz          │
└─────────────────────┴──────────────────┴─────────────────────────┘
```

---

## Example: Single Cantilever Beam

Let's trace a simple example end-to-end:

```
STRUCTURE:
  10 kN
    ↓
    N2 ──── 6m ──── N1
  (free)           (fixed)


APPLIED LOADS:
├─ Node N2: Fy = -10 kN (downward)


ANALYSIS SOLVES:
| [K] for 1-DOF cantilever
| N1 horizontal: u_x = 0 (fixed)
| N1 vertical: u_y = 0 (fixed)
| N2 vertical: u_y = ? (solver computes: -5.2 mm)


REACTIONS AT SUPPORT (N1):
├─ Vertical reaction: Fy = +10 kN (upward) ← Balances the load
├─ Moment reaction: Mz = 10 × 6 = 60 kN·m (clockwise)


EQUILIBRIUM CHECK:
├─ Applied load: Fy = -10 kN ↓
├─ Reaction: Fy = +10 kN ↑
├─ Sum: -10 + 10 = 0 ✓ BALANCED


MOMENT CHECK:
├─ Applied moment at N2 (due to 10 kN @ 6m): Mz = -60 kN·m (clockwise from above)
├─ Reaction moment: Mz = +60 kN·m (counterclockwise) ← Balances
├─ Sum: -60 + 60 = 0 ✓ BALANCED
```

---

## Troubleshooting: "Why Don't My Loads Match?"

### **Scenario 1: Applied ≠ Reactions**

```
Applied: 100 kN
Reactions: 95 kN
Missing: 5 kN

Check:
□ Did I enter all loads?
□ Are some loads on inactive members?
□ Did I specify units correctly (kN vs N)?
□ Numerical tolerance (< 0.01 is OK)
```

### **Scenario 2: Unbalanced Moments**

```
Applied Moment: +50 kN·m
Reaction Moment: +45 kN·m
Missing: 5 kN·m

Check:
□ Load location matches distance
□ Distributed load conversion correct
□ No accidental moment offsets
□ Support rotation allowed?
```

### **Scenario 3: Lateral Loads Don't Show**

```
Applied Fx: 20 kN (horizontal)
Reaction Fx: 0 kN

Issues:
□ Is there a horizontal support? (Add if needed)
□ Did I apply to a rigid direction?
□ Is member pinned at top?
□ Check restraint symbols (🔧 vs ○)
```

---

## Key Formulas Used

### **Fixed-End Force Conversion (UDL → Nodal)**

For UDL of **w** over span **L**:
$$R = \frac{w \times L}{2}$$ (reaction at each end)

$$M = \frac{w \times L^2}{12}$$ (moment at each end, opposite sign)

### **Tributary Area (3D → 2D)**

For 3D structure with two-way slab:
$$w_{beam} = w_{floor} \times \frac{\text{bayWidth}}{4}$$ (two-way distribution to both X and Y beams)

Explanation: Each direction (X and Y) carries ~50% of load, and each beam in that direction carries ~50% of that = 25% total.

### **Equilibrium Equations**

$$\sum F_x = 0$$
$$\sum F_y = 0$$
$$\sum F_z = 0$$
$$\sum M_x = 0$$
$$\sum M_y = 0$$
$$\sum M_z = 0$$

---

## Still Confused?

The **key insight**:
- **What you apply** → Gets distributed to nodes
- **What solver computes** → Support reactions
- **They MUST be equal** ← This is equilibrium (✓ checkmark)

If they're not equal, there's an error in your model, loads, or support conditions.

