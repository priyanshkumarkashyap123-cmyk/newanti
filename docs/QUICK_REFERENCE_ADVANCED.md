# 🚀 Advanced Structural Analysis - Quick Reference

## One-Page Cheat Sheet

---

## 📖 Start Here

**New user?** → [ADVANCED_FEATURES_COMPLETE.md](ADVANCED_FEATURES_COMPLETE.md)  
**Want theory?** → [ADVANCED_STRUCTURAL_ANALYSIS.md](ADVANCED_STRUCTURAL_ANALYSIS.md)  
**Need deep math?** → [ADVANCED_MATHEMATICS_COMPLETE.md](ADVANCED_MATHEMATICS_COMPLETE.md)  
**Want to test?** → [test_advanced_structural.html](test_advanced_structural.html)  

---

## ⚡ Quick API Reference

### Triangular Load
```javascript
{
  element_id: 1,
  distribution: "Triangular",
  w1: 0,        // Start intensity (N/m)
  w2: 10000,    // End intensity (N/m)
  direction: "LocalY"
}
```

**Formula**: V_start = 7wL/20, V_end = 3wL/20

---

### P-Delta Analysis
```javascript
const result = wasm.solve_p_delta(
    nodes, elements, 
    pointLoads, memberLoads,
    20,    // max iterations
    1e-4   // tolerance
);

// Check convergence
if (result.converged) {
    console.log(`Converged in ${result.iterations} iterations`);
}
```

**Amplification**: λ = 1/(1-P/P_E), where P_E = π²EI/L²

---

### Buckling Analysis
```javascript
const result = wasm.analyze_buckling(
    nodes, elements,
    pointLoads,
    3  // number of modes
);

console.log('Critical load:', result.buckling_loads[0]);
```

**Euler Formula**: P_cr = π²EI/L² (pin-ended column)

---

## 🧮 Key Formulas

### Triangular Load (w=0 at start, w₀ at end)
```
V_start = 7w₀L/20
V_end = 3w₀L/20
M_start = -w₀L²/20
M_end = w₀L²/30
```

### Trapezoidal Load
```
Decompose into:
  UDL of w₁ + Triangular of (w₂-w₁)
```

### Geometric Stiffness
```
K_g = [6×6 matrix] × (P/L)

Key coefficients:
  a₁₁ = 6/5
  a₂₂ = 6/(5L)
  a₃₃ = 2L²/15
```

### P-Delta Amplification
```
λ = 1 / (1 - P/P_E)

where:
  P = applied axial load
  P_E = π²EI/L² (Euler load)
```

### Buckling
```
[K_e - λK_g]φ = 0

P_cr = λ × P_applied

Pin-ended: P_cr = π²EI/L²
Fixed-fixed: P_cr = 4π²EI/L²
```

---

## 🎯 When to Use

### Triangular Loads
- Snow loads on sloped roofs
- Wind pressure distributions
- Hydrostatic pressure on walls
- Soil pressure on retaining walls

### P-Delta Analysis
- Slender columns (L/r > 100)
- Tall buildings with lateral loads
- P/P_E > 0.05 (5% of buckling load)
- High axial compression + lateral forces

### Buckling Analysis
- Column design
- Bracing requirements
- Stability checks
- Critical load determination

---

## ✅ Validation Checks

### Equilibrium
```
ΣFx = 0
ΣFy = 0  
ΣM = 0

(to machine precision ≈ 10⁻¹⁰)
```

### Convergence (P-Delta)
```
||u_new - u_old|| / ||u_new|| < 10⁻⁴

Typical: 3-6 iterations
```

### Accuracy
```
Triangular load: Error < 5%
Buckling: Error < 5% vs Euler
P-Delta: Amplification within 5% of theory
```

---

## 🔧 Build & Test

### Compile WASM
```bash
cd packages/solver-wasm
wasm-pack build --target web
```

### Run Tests
```bash
python3 -m http.server 8000
# Open: http://localhost:8000/test_advanced_structural.html
```

---

## 📊 Solver Info

### Get Capabilities
```javascript
const info = wasm.get_solver_info();
console.log(info.capabilities);
// Output: ["2D frame analysis", "Triangular loads", 
//          "P-Delta analysis", "Buckling", ...]
```

---

## 🐛 Troubleshooting

### P-Delta Not Converging
- Check if P/P_E < 0.9 (structure stable)
- Increase max iterations (try 30)
- Reduce loads
- Check boundary conditions

### Buckling Gives Negative Values
- Wrong sign on loads (compression should be negative)
- Insufficient boundary conditions
- Matrix is singular

### Load Not Applied
- Check element_id exists
- Verify load direction ("LocalY" vs "GlobalY")
- Check w1, w2 units (N/m not kN/m)

---

## 📏 Units

**Consistent units required!**

### SI Units (Recommended)
```
Length:  meters (m)
Force:   Newtons (N)
Stress:  Pascals (Pa)
Moment:  Newton-meters (N·m)
E:       200×10⁹ Pa (200 GPa for steel)
```

### Conversions
```
1 kN = 1000 N
1 MPa = 10⁶ Pa
1 GPa = 10⁹ Pa
1 kN/m = 1000 N/m
```

---

## 📖 Learning Path

### 30 Minutes
1. Read this quick reference
2. Run test 1 (triangular load)
3. Modify w2 and see results

### 2 Hours
1. Read ADVANCED_FEATURES_COMPLETE.md
2. Run all 5 tests
3. Try your own example

### 1 Day
1. Read all documentation
2. Study source code
3. Add a new feature

---

## 🎓 Key Concepts

### Direct Stiffness Method
```
K·u = F

where:
  K = global stiffness matrix
  u = displacement vector  
  F = force vector
```

### P-Delta (Second-Order)
```
[K_e + K_g(u)]·u = F

Nonlinear: K_g depends on displacements
Solve iteratively: Newton-Raphson
```

### Buckling (Eigenvalue)
```
[K_e - λK_g]·φ = 0

λ = buckling load factor
φ = mode shape
```

---

## 📁 File Locations

### Source Code
```
packages/solver-wasm/src/lib.rs

Lines 461-495:   Data structures
Lines 697-802:   Load application
Lines 1016-1059: Geometric stiffness
Lines 1061-1269: P-Delta solver
Lines 1271-1448: Buckling solver
```

### Compiled Output
```
packages/solver-wasm/pkg/
  ├── solver_wasm.js       (Import this)
  ├── solver_wasm_bg.wasm
  └── solver_wasm.d.ts
```

---

## 🚨 Limitations

- ✅ 2D analysis only (planar structures)
- ✅ Linear material (no plasticity)
- ✅ Small rotations (< 10°)
- ✅ Frame elements only (beams/columns)

**Future**: 3D, nonlinear material, large displacements

---

## ✨ Features Status

| Feature | Status | Tested | Documented |
|---------|--------|--------|------------|
| Triangular loads | ✅ | ✅ | ✅ |
| Trapezoidal loads | ✅ | ✅ | ✅ |
| P-Delta analysis | ✅ | ✅ | ✅ |
| Buckling analysis | ✅ | ✅ | ✅ |
| Temperature loads | 🟡 | 🔲 | ✅ |
| Member releases | 🟡 | 🔲 | ✅ |

---

## 💡 Pro Tips

1. **Always check convergence** for P-Delta
2. **Use consistent units** throughout
3. **Validate with hand calcs** for simple cases
4. **Check equilibrium** (ΣF = 0, ΣM = 0)
5. **Start simple** then add complexity

---

## 📞 Need Help?

**Usage questions** → ADVANCED_FEATURES_COMPLETE.md  
**Theory questions** → ADVANCED_STRUCTURAL_ANALYSIS.md  
**Math questions** → ADVANCED_MATHEMATICS_COMPLETE.md  
**Can't find it** → MASTER_INDEX_ADVANCED.md  

---

## 🎯 Most Common Tasks

### Apply Triangular Load
```javascript
const load = {
    element_id: 1,
    distribution: "Triangular",
    w1: 0,
    w2: 10000,  // N/m
    direction: "LocalY"
};
```

### Check P-Delta Effects
```javascript
// First-order
const linear = wasm.solve(...);

// Second-order  
const pdelta = wasm.solve_p_delta(...);

// Compare
const amp = pdelta.dx / linear.dx;
console.log(`Amplification: ${amp.toFixed(3)}`);
```

### Find Buckling Load
```javascript
const result = wasm.analyze_buckling(...);
const Pcr = result.buckling_loads[0];
console.log(`Critical load: ${(Pcr/1000).toFixed(0)} kN`);
```

---

## 🏁 Quick Start (5 Minutes)

1. **Compile WASM**:
   ```bash
   cd packages/solver-wasm && wasm-pack build --target web
   ```

2. **Run tests**:
   ```bash
   python3 -m http.server 8000
   ```

3. **Open browser**:
   ```
   http://localhost:8000/test_advanced_structural.html
   ```

4. **Click "Run All Tests"**

5. **See results** - Compare FEM vs theory!

---

## 📚 References (Top 3)

1. **Timoshenko** - Load formulas (triangular: 7wL/20)
2. **Bathe** - FEM theory and P-Delta
3. **Chen & Lui** - Stability and buckling

Full list in ADVANCED_MATHEMATICS_COMPLETE.md Section 8.

---

**Keep this reference handy! Print it out or bookmark it. 📌**

---

**Version:** 1.0  
**Last Updated:** December 2024  
**Status:** ✅ Production Ready
