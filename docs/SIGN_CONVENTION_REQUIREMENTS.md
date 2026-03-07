# Sign Convention Requirements by Design Code

## Overview
This document specifies the required sign convention for each design code to ensure consistency across input, processing, and output.

---

## IS 456:2000 (India - Concrete)

### Bending Moment Convention
- **Sagging Moment (Positive)**: Tension on bottom fibre, compression on top
  - Typical span center in simple/continuous beams
  - Sign: `+M`
  
- **Hogging Moment (Negative)**: Tension on top fibre, compression on bottom
  - Typical over support in continuous beams
  - Sign: `-M`

### Shear Force Convention (Right-Hand Rule)
- **Positive Shear**: Acts upward on right face, downward on left face
- **Negative Shear**: Acts downward on right face, upward on left face

### Implementation Rules
1. **Input**: Accept signed moments (preserve +/- from analysis)
2. **Capacity Design**: Use ABSOLUTE VALUE of moment for capacity calculation
   - IS 456 flexural strength doesn't distinguish sagging vs hogging in capacity
   - Only the magnitude matters for reinforcement
3. **Output Display**: Show signed values in diagrams, reports
4. **Design Steel**:
   - Sagging (+M) → Bottom tension steel required
   - Hogging (-M) → Top tension steel required

### Code References
- IS 456:2000 Clause 38-40 (Flexural Design)
- IS 456:2000 Clause 40 (Shear Design)

---

## ACI 318-19 (USA - Concrete)

### Bending Moment Convention
- **Positive Moment**: Creates tension on bottom (sagging)
- **Negative Moment**: Creates tension on top (hogging)
- **Same as IS 456**

### Shear Force Convention
- **Vertical Shear (V)**: Sign follows internal force convention
- Same right-hand rule as IS 456

### Implementation Rules
1. **Input**: Accept signed moments
2. **Capacity Design**: Use ABSOLUTE VALUE for capacity
3. **Reinforcement Placement**:
   - Positive M → Bottom bars
   - Negative M → Top bars
4. **Shear Stirrup Design**: Based on absolute shear value

### Code References
- ACI 318-19 Chapter 22 (Flexural Design)
- ACI 318-19 Chapter 22 (Shear Design)

---

## Eurocode 2 (EN 1992-1-1) - Europe

### Bending Moment Convention
| Moment Type | Sign | Meaning | Reinforcement |
|-------------|------|---------|----------------|
| **Hogging** | `-M` | Tension at top | Top steel needed |
| **Sagging** | `+M` | Tension at bottom | Bottom steel needed |
| **Neutral Plane** | Reference | Zero moment | No bending steel |

### Implementation Rules
1. **Input**: Accept signed moments from European analysis tools
2. **Capacity Design**: Use ABSOLUTE VALUE
3. **Curvature Method**: Some checks may use curvature = M/EI (preserving sign)
4. **Crack Control**: Sign distinction important for serviceability

### Code References
- EN 1992-1-1:2004 Section 6.1 (Flexural Design)
- EN 1992-1-1:2004 Section 6.2 (Shear Design)

---

## IS 800:2007 (India - Steel)

### Bending Moment Convention
- **Major Axis**: Moment about major axis (My)
  - Positive sagging, negative hogging
- **Minor Axis**: Moment about minor axis (Mz)
  - Same convention

### Shear Force Convention
- Vy = Shear along Y-axis
- Vz = Shear along Z-axis
- Both use right-hand rule

### Implementation Rules
1. Input signed moments from structural analysis
2. For capacity: Use combined moment equation
   - Combined moment = √(My² + Mz²)
3. Buckling checks: Use signed moments for effective length calculations
4. Lateral torsional buckling: Sign matters for moment gradient factor

### Code References
- IS 800:2007 Clause 8 (Flexural Design)
- IS 800:2007 Clause 9 (Shear)

---

## AISC 360-22 (USA - Steel)

### Bending Moment Convention
- **Positive Bending**: Sagging (compression at top)
- **Negative Bending**: Hogging (compression at bottom)
- Moment gradient factor depends on sign pattern

### Implementation Rules
1. Preserve signed moments throughout
2. Moment gradient factor Cb calculation needs sign information
   - Different Cb if moment is double-curvature vs single-curvature
3. For biaxial bending: Use combined moment check

### Code References
- AISC 360-22 Chapter F (Flexural Members)
- AISC 360-22 Chapter G (Shear)

---

## Summary: Sign Convention Table

| Code | Sagging (+M) | Hogging (-M) | Use Absolute | Bottom Steel | Top Steel |
|------|--------------|--------------|--------------|--------------|-----------|
| IS 456 | Tension ⬇️ | Tension ⬆️ | Yes | +M | -M |
| ACI 318 | Tension ⬇️ | Tension ⬆️ | Yes | +M | -M |
| EC2 | Tension ⬇️ | Tension ⬆️ | Yes | +M | -M |
| IS 800 | Compression ⬆️ | Compression ⬇️ | No* | +M | -M |
| AISC 360 | Compression ⬆️ | Compression ⬇️ | No* | -M | +M |

*For steel, sign convention affects lateral bracing and moment gradient factors

---

## Implementation Strategy

### Phase 1: Input Preservation
- ✅ Accept signed moment values from FEA (don't strip signs)
- ✅ Track which code is selected
- ✅ Preserve signs through API requests

### Phase 2: Code-Aware Processing
- For RC (IS456, ACI, EC2): Use absolute values for capacity
- For Steel (IS800, AISC): Preserve signs for gradient factors
- Create CodeSignConvention helper to encapsulate rules

### Phase 3: Output Transformation
- Display reinforcement location based on sign
- Show moment diagrams with sign preservation
- Report generation understands code conventions

### Phase 4: Validation
- Unit tests for sign handling per code
- Integration tests with sample analyses
- Documentation of assumptions

---

## Migration Checklist

- [ ] Create `CodeSignConvention` class in backend-python
- [ ] Create `SignConventionHandler` class for transformations
- [ ] Update `MemberForces` dataclass to not use `abs()`
- [ ] Update all design code implementations
- [ ] Create frontend token for sign convention display
- [ ] Update diagrams to show signs correctly
- [ ] Create tests for sign convention handling
- [ ] Document in design code comments

