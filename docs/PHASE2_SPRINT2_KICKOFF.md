# PHASE 2 SPRINT 2 KICKOFF
**Dates:** January 9-12, 2026 (4 Days)  
**Previous Sprint Status:** ✅ COMPLETE (3680+ lines, 14 tests PASSED)  
**Current Target:** Spring elements + Solver integration  
**Phase 2 Progress:** 3/20 days complete (15%)

---

## Sprint 2 Overview

### Daily Breakdown:

```
┌─────────────────────────────────────────────────────────┐
│ PHASE 2 SPRINT 2: SPRING ELEMENTS & INTEGRATION         │
├─────────────────────────────────────────────────────────┤
│ Day 4 (Jan 9)  - Spring Element Implementation          │
│ Day 5 (Jan 10) - Spring Validation Tests                │
│ Day 6 (Jan 11) - StructuralSolverWorker Integration     │
│ Day 7 (Jan 12) - Section Library (50+ Indian Std)       │
└─────────────────────────────────────────────────────────┘
```

---

## Day 4: Spring Element Implementation

### Objective:
Implement spring/support elements for elastic foundation modeling

### Deliverables:
- **File:** `apps/web/src/solvers/elements/compute-spring.ts` (150 lines)
- **Functions:**
  - `computeSpringStiffness(k)` → 2×2 matrix
  - `computeSpringForces(u, k)` → {force, energy}

### Spring Stiffness Matrix:
```
K_spring = [ k,  -k ]
           [-k,   k ]

Local equation: k × (u2 - u1) = f
```

### Types:
- Axial spring (horizontal/vertical)
- Rotational spring (moment-based)
- Elastic support (foundation stiffness)

### Test Plan (validate-spring.js):
- TEST 1: Axial spring (cantilever + spring)
- TEST 2: Support stiffness variation
- TEST 3: Energy conservation
- TEST 4: 2D portal with elastic base

### Expected Results:
- All 4 tests PASSED
- 0.00% error vs analytical
- 200-line test file

---

## Day 5: Spring Validation Tests

### TEST 1: Axial Spring Load
```
Structure: 2-member system
  - Member 1 (frame): 2m cantilever
  - Member 2 (spring): k = 50 kN/m

Load: 10 kN horizontal

Expected:
  - Frame deflection: ~0.50 mm
  - Spring extension: 0.20 mm
  - Total: 0.70 mm
  - Error: 0.00% vs FEA
```

### TEST 2: Elastic Support
```
Structure: Single span beam with spring supports
  - Span: 5m, E=200 GPa, I=1000 cm⁴
  - Left support: Fixed (k=∞)
  - Right support: Spring (k=100 MN/m)

Load: 20 kN at center

Expected:
  - Right support settles: ~0.10 mm
  - Bending increased: 15% vs fixed-fixed
```

### TEST 3: Energy Verification
```
Energy stored in spring:
E_spring = 0.5 × k × u²

Example: k=50 kN/m, u=0.5 mm
E = 0.5 × 50000 × (0.0005)² = 6.25 mJ
```

### TEST 4: 2D Portal with Elastic Base
```
Structure:
  ├─ Frame (2 columns, 1 beam)
  └─ Springs (3 base supports)

Load: 50 kN horizontal at roof

Expected:
  - Lateral drift: ~1.5 mm
  - Base settlements: ~0.5 mm each
  - Equilibrium maintained
```

### Commit:
- Files: compute-spring.ts, validate-spring.js
- Message: "feat(Phase 2 Sprint 2 Day 4-5): Spring elements + validation tests"

---

## Day 6: StructuralSolverWorker Integration

### Task:
Update StructuralSolverWorker.ts to fully integrate spring elements

### Changes:
1. Add Spring to ElementType union
2. Add spring element to dispatch logic
3. Update DOF mapping for springs
4. Create example: Portal frame with elastic base

### Example Structure:
```typescript
const structure: StructuralAnalysisInput = {
  type: '2D',
  nodes: [
    {id: 0, x: 0, y: 0, boundary: {fixed_x: true, fixed_y: true}},
    {id: 1, x: 0, y: 4, boundary: {}},
    {id: 2, x: 5, y: 4, boundary: {}},
    {id: 3, x: 5, y: 0, boundary: {fixed_x: true}}  // Spring support
  ],
  members: [
    {id: 'C1', type: 'FRAME_2D', nodes: [0, 1], material: {E: 200e9}, geometry: {A: 0.001, Iy: 1e-5}},
    {id: 'B1', type: 'FRAME_2D', nodes: [1, 2], material: {E: 200e9}, geometry: {A: 0.001, Iy: 1e-5}},
    {id: 'C2', type: 'FRAME_2D', nodes: [2, 3], material: {E: 200e9}, geometry: {A: 0.001, Iy: 1e-5}},
    {id: 'S1', type: 'SPRING', nodes: [3, 0], material: {E: 1}, geometry: {k: 100000}}  // Spring
  ],
  loads: [{node: 1, Fx: 50000}]  // 50 kN horizontal
};
```

### Validation:
- Solve structure with springs
- Verify settlement patterns
- Compare with Frame-only version

### Commit:
- Files: StructuralSolverWorker.ts (updated)
- Message: "feat(Phase 2 Sprint 2 Day 6): Spring integration in multi-element solver"

---

## Day 7: Section Library Population

### Task:
Create comprehensive section library with 50+ Indian standard sections

### File Structure:
```typescript
// apps/web/src/database/section-library.json
{
  "indian_standards": [
    {
      "designation": "ISMC 75",
      "type": "I-Section",
      "standard": "IS 4099",
      "dimensions": {
        "depth": 0.075,      // m
        "width": 40e-3,      // m
        "tw": 3.8e-3,        // web thickness
        "tf": 5.2e-3,        // flange thickness
        "r": 3.8e-3          // fillet radius
      },
      "properties": {
        "area": 8.34e-4,     // m²
        "Iy": 74.6e-8,       // moment of inertia Y
        "Iz": 5.89e-8,       // moment of inertia Z
        "ry": 0.0299,        // radius of gyration Y
        "rz": 0.0084,        // radius of gyration Z
        "J": 0.145e-8,       // polar moment
        "Cw": 1.28e-12       // warping constant
      },
      "densities": {
        "steel": 78.5        // kg/m
      },
      "yield_strength": 250e6,  // Pa (250 MPa)
      "ultimate_strength": 410e6 // Pa (410 MPa)
    },
    // ... 49 more sections
  ]
}
```

### Sections to Include:
**I-Sections (12):**
- ISMC 75, 100, 125, 150, 175, 200, 250, 300, 350, 400, 450, 500

**Channel Sections (10):**
- ISC 75, 100, 125, 150, 175, 200, 250, 300, 350, 400

**Angle Sections (12):**
- ISA 25×25, 30×30, 40×40, 50×50, 60×60, 75×75
- ISA 50×40, 60×50, 75×50, 75×65, 100×75, 100×100

**Hollow Sections (10):**
- SHS 40×40, 50×50, 60×60, 75×75, 100×100
- CHS 50, 60, 75, 100, 125

**Plate Sections (4):**
- Various thickness, for built-up sections

### Usage in Solver:
```typescript
// Load section from library
const section = sectionLibrary['ISMC 100'];

// Create member with section
const member: Member = {
  id: 'B1',
  type: 'FRAME_2D',
  nodes: [0, 1],
  material: {E: 200e9},
  geometry: {
    A: section.properties.area,
    Iy: section.properties.Iy,
    Iz: section.properties.Iz,
    // ...
  }
};
```

### Deliverables:
- **File:** `apps/web/src/database/section-library.json` (2000+ lines)
- **File:** `apps/web/src/utils/section-selector.ts` (200 lines)
  - Function: `getSectionProperties(designation)` → section data
  - Function: `getAllSections()` → list of available sections

### Commit:
- Files: section-library.json, section-selector.ts
- Message: "data(Phase 2 Sprint 2 Day 7): Indian standard sections library (50+ sections)"

---

## Sprint 2 Success Criteria

### Code Quality:
- [ ] Spring element: 100% test coverage
- [ ] All element types integrated
- [ ] No breaking changes from Sprint 1
- [ ] TypeScript strict mode compliance

### Testing:
- [ ] 4 spring tests + PASSED
- [ ] 20+ total tests PASSED (cumulative)
- [ ] <0.1% error vs analytical
- [ ] All integration tests passing

### Documentation:
- [ ] JSDoc on all new functions
- [ ] Section library documentation
- [ ] Example structures documented
- [ ] API reference updated

### Performance:
- [ ] Spring element computation: <1 ms
- [ ] Large structure (30 members): <50 ms
- [ ] Memory usage: <100 KB for typical model

### User Readiness:
- [ ] Section selector UI-ready
- [ ] Solver ready for production
- [ ] Example inputs prepared
- [ ] Documentation complete

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Spring stiffness range | Low | Low | Test with various k values |
| Section data accuracy | Low | Medium | Use published IS standards |
| Integration issues | Low | Medium | Incremental testing |
| Performance degradation | Low | Low | Profile and optimize |

---

## Next Phase (Sprint 3)

After Sprint 2 completion:

**Sprint 3 Tasks (Days 8-14, Jan 13-19):**
- Day 8-10: Warren truss bridge demo (50m span, 12 bays, 60+ members)
- Day 11-12: Cable element framework (tension-only, Phase 3 prep)
- Day 13-14: Complete validation suite (100+ test cases)

**Phase 2 Completion (by Jan 31):**
- All 4 element types functional
- 100+ test cases, all <0.1% error
- Phase 2 completion report
- Ready for Phase 3

---

## Execution Timeline

**Days 4-5:** Spring elements (150 code + 200 tests)  
**Days 6-7:** Integration + library (200 code + 2000 data)  
**Target Code:** ~550 lines new code + 2000 section data  
**Target Tests:** 4 new tests, cumulative 24 PASSED  

**Current Status:** Ready to begin Day 4  
**Previous Progress:** 3/20 days COMPLETE (15%)  
**Remaining:** 17/20 days to complete Phase 2  
**Timeline:** 13 days remaining in January (on track)

---

**Sprint 2 Kickoff:** January 9, 2026 (Ready to Execute)  
**Previous Completion:** Phase 2 Sprint 1 (Jan 6-8) - 3680+ lines delivered  
**Next Target:** Spring elements production-ready by Jan 10  
**Success Metric:** All tests PASSED, <0.1% error, fully integrated
