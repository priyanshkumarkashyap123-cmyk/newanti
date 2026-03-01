# 14 — AI & Automation
## BeamLab Ultimate Figma Specification

---

## 14.1 AI Architect Panel

### Floating AI Sidebar (right-docked)
```
┌───────────────────────────────────────────────────────┐
│ 🤖 AI Architect                        [─] [□] [✕]  │
├───────────────────────────────────────────────────────┤
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ ● AI is ready                    Gemini 2.0 Pro │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ ── Quick Actions ──                                  │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐          │
│ │ 🏗️ Gen    │ │ 📊 Opt    │ │ 🔍 Check  │          │
│ │ Structure │ │ Optimize  │ │ Code      │          │
│ └───────────┘ └───────────┘ └───────────┘          │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐          │
│ │ 📝 Calc   │ │ 🎤 Voice  │ │ 📸 Sketch │          │
│ │ Explain   │ │ Command   │ │ Upload    │          │
│ └───────────┘ └───────────┘ └───────────┘          │
│                                                       │
│ ── Chat History ──                                   │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ 🧑 User                            10:32 AM    │  │
│ │ Generate a 4-bay 3-storey steel frame           │  │
│ │ with 6m spans and 3.5m storey heights          │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ 🤖 AI Architect                     10:32 AM    │  │
│ │                                                 │  │
│ │ I'll create a 4-bay, 3-storey steel frame:     │  │
│ │                                                 │  │
│ │ • 20 nodes (5 cols × 4 levels)                 │  │
│ │ • 32 members (12 beams + 20 columns)           │  │
│ │ • Spans: 6.0m each bay                        │  │
│ │ • Heights: 3.5m each storey                    │  │
│ │ • Sections: ISMB 300 (beams), ISHB 200 (cols)  │  │
│ │ • Material: Fe 345                             │  │
│ │ • Supports: Fixed at base                      │  │
│ │                                                 │  │
│ │ ┌─────────────────────────────────────────────┐│  │
│ │ │  [3D Preview of generated structure]        ││  │
│ │ │  ┌──┬──┬──┬──┐                              ││  │
│ │ │  │  │  │  │  │  Storey 3                    ││  │
│ │ │  ├──┼──┼──┼──┤                              ││  │
│ │ │  │  │  │  │  │  Storey 2                    ││  │
│ │ │  ├──┼──┼──┼──┤                              ││  │
│ │ │  │  │  │  │  │  Storey 1                    ││  │
│ │ │  ▲──▲──▲──▲──▲                              ││  │
│ │ └─────────────────────────────────────────────┘│  │
│ │                                                 │  │
│ │ Shall I also:                                  │  │
│ │ • Add dead + live loads (IS 875)?             │  │
│ │ • Generate seismic loads (IS 1893)?           │  │
│ │ • Run analysis?                               │  │
│ │                                                 │  │
│ │ [✅ Apply to Model]  [✏️ Modify]  [❌ Discard]│  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ 🧑 User                            10:33 AM    │  │
│ │ Yes, add all loads and run analysis            │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ 🤖 AI Architect                     10:33 AM    │  │
│ │                                                 │  │
│ │ ⏳ Generating loads...                         │  │
│ │ ━━━━━━━━━━━━━━━━━━━━━━ 60%                    │  │
│ │                                                 │  │
│ │ Added:                                         │  │
│ │ ✅ DL: Self-weight + 2.0 kN/m² floor load     │  │
│ │ ✅ LL: 3.0 kN/m² (IS 875-II, Office)          │  │
│ │ ⏳ WL: Generating IS 875-III...               │  │
│ │ ○ EQ: IS 1893 seismic loads (pending)         │  │
│ │ ○ Combinations (pending)                       │  │
│ │ ○ Analysis (pending)                           │  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
│ ┌─────────────────────────────────────────────────┐  │
│ │ 💬 [Ask AI anything about your model...]       │  │
│ │                             [🎤] [📎] [Send →]│  │
│ └─────────────────────────────────────────────────┘  │
│                                                       │
└───────────────────────────────────────────────────────┘

Panel dimensions: 380px wide, full viewport height
Background: slate-900 (#0f172a)
Chat bubbles: user = slate-700, AI = slate-800 with blue-left-border
```

---

## 14.2 Generative Design Dialog

```
┌───────────────────────────────────────────────────────────────────┐
│ 🤖 AI Generative Design                                    [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Describe your structure in natural language:                     │
│ ┌───────────────────────────────────────────────────────────────┐│
│ │ Design a 5-storey commercial building with:                   ││
│ │ - 4 bays in X direction (7m each)                            ││
│ │ - 3 bays in Z direction (6m each)                            ││
│ │ - Ground floor height 4.5m, typical floor 3.3m               ││
│ │ - Use IS codes for Mumbai (Zone III)                         ││
│ │ - Office occupancy on all floors                              ││
│ │ - RC moment frame system                                      ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                   │
│ ── OR Upload Sketch ──                                          │
│ ┌───────────────────────────────────────────────────────────────┐│
│ │                                                               ││
│ │         📸 Drag & drop a hand-drawn sketch                   ││
│ │            or photo of a structural plan                       ││
│ │                                                               ││
│ │         Supported: JPG, PNG, PDF                              ││
│ │         AI will interpret and generate the model              ││
│ │                                                               ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                   │
│ ── AI Interpretation ──                                         │
│ ┌───────────────────────────────────────────────────────────────┐│
│ │ Parsed Parameters:                              [Edit ✏️]    ││
│ │                                                               ││
│ │ • Structure: 3D Frame                                         ││
│ │ • Storeys: 5                                                  ││
│ │ • X-bays: 4 × 7.0m = 28.0m                                  ││
│ │ • Z-bays: 3 × 6.0m = 18.0m                                  ││
│ │ • GF height: 4.5m, Typical: 3.3m                            ││
│ │ • Total height: 4.5 + 4×3.3 = 17.7m                         ││
│ │ • Seismic Zone: III (Z=0.16)                                 ││
│ │ • Occupancy: Office (LL = 3.0 kN/m²)                        ││
│ │ • Frame type: RC SMRF (R=5.0)                                ││
│ │                                                               ││
│ │ Estimated model: 120 nodes, 225 members                      ││
│ │                                                               ││
│ │ ☑ Auto-assign sections (preliminary sizing)                  ││
│ │ ☑ Auto-generate loads (DL, LL, WL, EQ)                      ││
│ │ ☑ Auto-generate load combinations                           ││
│ │ ☐ Auto-run analysis                                          ││
│ │ ☐ Auto-run design                                            ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                   │
├───────────────────────────────────────────────────────────────────┤
│        [Cancel]    [Preview 3D]    [🤖 Generate Structure]      │
└───────────────────────────────────────────────────────────────────┘
```

---

## 14.3 AI Code Compliance Checker

```
┌───────────────────────────────────────────────────────────────────┐
│ 🤖 AI Code Compliance Check                                [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Checking against:                                                │
│ ☑ IS 456:2000   ☑ IS 800:2007   ☑ IS 1893:2016                │
│ ☑ IS 875:2015   ☑ IS 13920:2016                                │
│                                                                   │
│ ┌───────────────────────────────────────────────────────────────┐│
│ │ AI Code Check Report                                         ││
│ │                                                               ││
│ │ ✅ 32 checks passed                                          ││
│ │ ⚠️ 5 warnings                                               ││
│ │ ❌ 2 violations found                                        ││
│ │                                                               ││
│ │ ── VIOLATIONS ──                                              ││
│ │                                                               ││
│ │ ❌ IS 1893 Cl. 7.11.1 — Storey drift                       ││
│ │   Storey 5 drift = 0.00425 > 0.004 limit                    ││
│ │   Action: Increase column stiffness at levels 4-6            ││
│ │   [Fix Suggestion: Upgrade cols to 450×450]                  ││
│ │                                                               ││
│ │ ❌ IS 13920 Cl. 6.2.3 — Column-beam strength ratio          ││
│ │   Joint at N15: ΣMc/ΣMb = 1.05 < 1.1 (required)           ││
│ │   Action: Increase column section or reduce beam             ││
│ │   [Fix Suggestion: Upgrade col to 500×500]                  ││
│ │                                                               ││
│ │ ── WARNINGS ──                                                ││
│ │                                                               ││
│ │ ⚠️ IS 456 Cl. 26.5.1.1 — Minimum reinforcement            ││
│ │   Beam M15: pt = 0.22% (close to min 0.205%)               ││
│ │                                                               ││
│ │ ⚠️ IS 800 Cl. 3.8 — Slenderness                           ││
│ │   Member M22: KL/r = 178 (limit 180, 99% utilized)         ││
│ │   ...                                                         ││
│ │                                                               ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                   │
│ [🤖 Auto-Fix All]  [Fix Selected]  [📄 Export Report]          │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 14.4 AI Section Optimizer

```
┌───────────────────────────────────────────────────────────────────┐
│ 🤖 AI Section Optimization                                 [✕]   │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│ Objective:                                                       │
│ ● Minimize weight                                               │
│ ○ Minimize cost                                                 │
│ ○ Minimize deflection                                           │
│ ○ Balance (weight + deflection)                                 │
│                                                                   │
│ Constraints:                                                     │
│ ☑ Max utilization ratio: [ 0.85 ]                              │
│ ☑ Deflection limit: [ L/250 ]                                  │
│ ☑ Drift limit: [ 0.004h ] (IS 1893)                           │
│ ☑ Slenderness limit: [ 180 ]                                   │
│ ☐ Maintain uniform sections per group                          │
│                                                                   │
│ Member Groups:                                                   │
│ ☑ Group 1: Floor beams (M1-M12)     Current: ISMB 300          │
│ ☑ Group 2: Roof beams (M13-M16)     Current: ISMB 250          │
│ ☑ Group 3: Columns L1-L3 (M17-M28)  Current: ISHB 200          │
│ ☑ Group 4: Columns L4-L5 (M29-M32)  Current: ISHB 150          │
│                                                                   │
│ Available sections: [Indian Standard (IS) ▾]                    │
│                                                                   │
│ ── Optimization Results ──                                      │
│ ┌───────────────────────────────────────────────────────────────┐│
│ │ Iterations: 12  │  Time: 8.3s  │  Converged ✅              ││
│ │                                                               ││
│ │ Group │ Original │ Optimized │ Weight Δ │ Max UR │ Status   ││
│ │ ──────┼──────────┼───────────┼──────────┼────────┼──────────││
│ │ G1    │ ISMB 300 │ ISMB 250  │ -18.2%   │ 0.82   │ ✅       ││
│ │ G2    │ ISMB 250 │ ISMB 200  │ -21.5%   │ 0.78   │ ✅       ││
│ │ G3    │ ISHB 200 │ ISHB 250  │ +15.3%   │ 0.84   │ ✅ (was❌)││
│ │ G4    │ ISHB 150 │ ISHB 200  │ +22.1%   │ 0.79   │ ✅ (was❌)││
│ │ ──────┼──────────┼───────────┼──────────┼────────┼──────────││
│ │ Total │ 12,450 kg│ 11,230 kg │ -9.8%    │ 0.84   │ All ✅  ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                   │
│ Weight saved: 1,220 kg (-9.8%)                                  │
│ All members now pass all design checks ✅                       │
│                                                                   │
│ [Apply Optimized Sections]  [Compare Details]  [Revert]         │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 14.5 Voice Command Interface

```
┌─────────────────────────────────────┐
│ 🎤 Listening...                    │
│                                     │
│ ┌───────────────────────────────┐  │
│ │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~  │  │
│ │  Audio waveform visualization │  │
│ │  ~~~~~~~~~~~~~~~~~~~~~~~~~~~  │  │
│ └───────────────────────────────┘  │
│                                     │
│ "Add a 50 kN point load at         │
│  node 5 in the Y direction"        │
│                                     │
│ Interpreted:                        │
│ Action: Add Point Load             │
│ Node: N5                           │
│ Force: Fy = -50 kN                 │
│ Load Case: [Active — LC2]          │
│                                     │
│ [✅ Confirm]  [✏️ Edit]  [🎤 Redo] │
│                                     │
└─────────────────────────────────────┘

Trigger: Ctrl+Shift+Space or 🎤 button
Position: floating overlay, centered
Background: slate-900/95 with blur
Waveform: animated gradient (blue → purple)
```

---

## 14.6 AI Chat Assistant — Calculation Explainer

```
When user asks "Explain how the steel design check works for M20":

┌─────────────────────────────────────────────────────────────────┐
│ 🤖 AI Explanation                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│ ## Steel Design Check for Member M20                            │
│                                                                   │
│ Member M20 is a **column** (ISHB 200, Fe 345) subjected to     │
│ combined axial compression and bending.                          │
│                                                                   │
│ ### Step 1: Section Classification                              │
│ The section is classified as **Semi-compact** because:           │
│ - Flange: b/tf = 11.1 > 9.4ε (compact limit)                  │
│ - Web: d/tw = 26.6 < 42ε ✅ (plastic)                         │
│                                                                   │
│ ### Step 2: Compression Check (IS 800 Cl. 7.1.2)               │
│ ```                                                              │
│ Slenderness λ = KL/r = 85.2                                    │
│ Non-dimensional: λ̄ = 1.125                                     │
│ Using buckling curve 'b': χ = 0.524                             │
│ Pd = 772.3 kN > Pu = 456.7 kN ✅                              │
│ ```                                                              │
│                                                                   │
│ ### Step 3: LTB Check (IS 800 Cl. 8.2.2) ❌                   │
│ This is where the member **fails**. The lateral-torsional       │
│ buckling capacity is only 77.2 kN·m, but the applied moment    │
│ is 85.3 kN·m.                                                   │
│                                                                   │
│ The unbraced length of 3.5m is too long for this section.       │
│                                                                   │
│ ### Recommendation                                               │
│ Either:                                                          │
│ 1. **Upgrade to ISHB 250** (UR would drop to 0.76)            │
│ 2. **Add lateral bracing** at mid-height (UR → 0.68)           │
│ 3. **Use ISMB 300** (different shape, better LTB)              │
│                                                                   │
│ [Apply Option 1]  [Apply Option 2]  [Show Full Calculation]    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘

Style: markdown rendered, code blocks for calculations
Links to IS code clauses are clickable
```
