# Mathematical Framework Reference

## Core Equation: Linear Static Analysis

```
[K]{U} = {F}
```

- **K**: Global stiffness matrix (banded, symmetric, positive-definite for stable structures)
- **U**: Nodal displacement vector (6 DOF per node: dx, dy, dz, rx, ry, rz)
- **F**: Global load vector (applied forces + equivalent nodal loads from member loads)

Assembly: K_global = Σ [T]ᵢᵀ [K_local]ᵢ [T]ᵢ for each element i

---

## 3D Timoshenko Beam Element (12×12)

12 DOF: {u1, v1, w1, θx1, θy1, θz1, u2, v2, w2, θx2, θy2, θz2}

### Local Stiffness Matrix Components

**Axial:**
```
EA/L  [+1  -1]
      [-1  +1]
```

**Torsional:**
```
GJ/L  [+1  -1]
      [-1  +1]
```

**Bending about z-axis (with shear deformation):**

Shear parameter: φy = 12EIz / (GAy·L²)

```
     12EIz          6EIz·L          -12EIz          6EIz·L
   ----------    ----------       ----------     ----------
   L³(1+φy)     L²(1+φy)        L³(1+φy)       L²(1+φy)

     6EIz·L       (4+φy)EIz·L²    -6EIz·L      (2−φy)EIz·L²
   ----------    ---------------  ----------    ---------------
   L²(1+φy)       L(1+φy)        L²(1+φy)        L(1+φy)

   (symmetric)
```

Similarly for bending about y-axis with φz = 12EIy / (GAz·L²).

When φ = 0 (no shear deformation), reduces to Euler-Bernoulli beam.

### Coordinate Transformation

```
K_global = [T]ᵀ [K_local] [T]
```

T = 12×12 block-diagonal transformation matrix:
```
     [λ  0  0  0]
T =  [0  λ  0  0]
     [0  0  λ  0]
     [0  0  0  λ]
```

λ = 3×3 direction cosine matrix from local to global coordinates.

For member from node i(xi,yi,zi) to node j(xj,yj,zj):
- L = √((xj−xi)² + (yj−yi)² + (zj−zi)²)
- Direction cosines from member axis and reference vector

---

## P-Delta Analysis (Geometric Nonlinearity)

```
([Ke] + [Kg(P)]){U} = {F}
```

### Geometric Stiffness Matrix

For beam element with axial force P:

```
         [ 6/5    L/10   -6/5    L/10  ]
Kg = P/L [ L/10   2L²/15 -L/10  -L²/30 ]
         [-6/5   -L/10    6/5   -L/10  ]
         [ L/10  -L²/30  -L/10   2L²/15]
```

### Iterative Procedure (Newton-Raphson)

1. Solve [Ke]{U₀} = {F} → get initial P forces
2. Form [Kg(P₀)] from axial forces
3. Solve ([Ke] + [Kg(P₀)]){U₁} = {F}
4. Update P from U₁
5. Repeat until ‖Uₖ₊₁ − Uₖ‖ / ‖Uₖ₊₁‖ < tolerance

Convergence typically in 3–5 iterations for moderate P-Delta effects.

---

## Modal Analysis

### Eigenvalue Problem

```
[K]{φ} = ω²[M]{φ}
```

Or equivalently: det([K] − ω²[M]) = 0

- ωn = natural circular frequency of mode n (rad/s)
- fn = ωn / (2π) Hz
- Tn = 1/fn seconds
- {φn} = mode shape vector

### Mass Matrix

**Consistent mass matrix** (12×12 for beam, from shape functions):
```
M_local = ρAL/420 × [standard consistent mass terms]
```

**Lumped mass** (diagonal, simpler):
```
M_lumped = ρAL/2 × diag[1, 1, 1, 0, 0, 0, 1, 1, 1, 0, 0, 0]
```

### Modal Participation Factor

```
Γn = {φn}ᵀ[M]{r} / {φn}ᵀ[M]{φn}
```

{r} = influence vector (unit vector in excitation direction)

Mass participation ratio:
```
MPR_n = Γn² × {φn}ᵀ[M]{φn} / {r}ᵀ[M]{r}
```

Include enough modes for Σ MPR ≥ 90%.

---

## Response Spectrum Analysis

### SRSS (Square Root of Sum of Squares)

```
R = √(Σ Rn²)
```

Valid when natural frequencies are well-separated (ωi/ωj < 0.8 or > 1.25).

### CQC (Complete Quadratic Combination)

```
R = √(Σᵢ Σⱼ ρᵢⱼ Rᵢ Rⱼ)
```

Cross-modal correlation coefficient (Der Kiureghian):
```
ρᵢⱼ = 8ζ²(1+r)r^(3/2) / [(1−r²)² + 4ζ²r(1+r)²]
```

r = ωⱼ/ωᵢ,  ζ = damping ratio (typically 5% = 0.05)

When i = j: ρᵢᵢ = 1.0 (reduces to SRSS for uncorrelated modes).

### Modal Response

For mode n, spectral displacement:
```
Sd,n = Γn × Sa(Tn) / ωn²
```

Modal displacement: {U_n} = Sd,n × {φn}

Member forces from modal displacements: {F_n} = [K]{U_n}

---

## Newmark-β Time Integration

Equation of motion:
```
[M]{ü} + [C]{u̇} + [K]{u} = {F(t)}
```

### Integration Parameters

| Method | β | γ | Properties |
|--------|---|---|------------|
| Average acceleration | 1/4 | 1/2 | Unconditionally stable |
| Linear acceleration | 1/6 | 1/2 | Conditionally stable |
| Fox-Goodwin | 1/12 | 1/2 | Fourth-order accuracy |

### Effective Stiffness

```
K̄ = K + a₀M + a₁C
```

where:
- a₀ = 1/(β·Δt²)
- a₁ = γ/(β·Δt)
- a₂ = 1/(β·Δt)
- a₃ = 1/(2β) − 1
- a₄ = γ/β − 1
- a₅ = Δt(γ/(2β) − 1)

### Effective Load at Step n+1

```
F̄_{n+1} = F_{n+1} + M(a₀u_n + a₂u̇_n + a₃ü_n) + C(a₁u_n + a₄u̇_n + a₅ü_n)
```

### Update Equations

```
u_{n+1} = K̄⁻¹ F̄_{n+1}
ü_{n+1} = a₀(u_{n+1} − u_n) − a₂u̇_n − a₃ü_n
u̇_{n+1} = u̇_n + Δt[(1−γ)ü_n + γü_{n+1}]
```

### Rayleigh Damping

```
[C] = α[M] + β[K]
```

For target damping ratio ζ at frequencies ω₁ and ω₂:
```
α = 2ζω₁ω₂ / (ω₁ + ω₂)
β = 2ζ / (ω₁ + ω₂)
```

---

## Buckling Analysis

### Eigenvalue Buckling

```
([K] + λ[Kg]){φ} = 0
```

λ = critical load multiplier (buckling load factor)

Pcr = λ × P_applied for each mode.

---

## UDL → Equivalent Nodal Loads (Fixed-End Forces)

### Full Span UDL (w per unit length)

```
Ri = wL/2,     Rj = wL/2
Mi = wL²/12,   Mj = −wL²/12
```

### Partial UDL (from a to b on span L)

```
Ri = w(b−a)[2L²−2aL−2bL+a²+ab+b²] / (2L³)
Mi = w(b−a)[6aL²−2a³−6a²L+6abL−3a²b−3ab²+2a²L+b³−b²L] / (12L²)
```

### Triangular Load (0 at node i, w at node j)

```
Ri = 3wL/20,   Rj = 7wL/20
Mi = wL²/30,   Mj = −wL²/20
```

### Trapezoidal Load (w1 at i, w2 at j)

Decompose: uniform = min(w1,w2) + triangular = |w2−w1|

---

## Cable Catenary Analysis

Catenary equation:
```
y(x) = (H/w)[cosh(wx/H) − 1]
```

- H = horizontal tension component
- w = cable weight per unit length
- Sag at midspan: f = (H/w)[cosh(wL/(2H)) − 1]
- Cable length: S = (2H/w)sinh(wL/(2H))
- Maximum tension: Tmax = H·cosh(wL/(2H))

For parabolic approximation (sag/span < 1/8):
```
f ≈ wL²/(8H)
Tmax ≈ H√(1 + (wL/(2H))²)
```
