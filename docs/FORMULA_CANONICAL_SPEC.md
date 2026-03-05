# BeamLab Canonical Formula Spec (Rust-First)

This document defines the **authoritative equations** and implementation anchors for advanced analysis and IS code checks.

## 1) Global Linear Static Equilibrium

\[
[K]\{U\}=\{F\}
\]

- Implemented in Rust solver assembly/solve path:
  - `apps/rust-api/src/solver/mod.rs`
  - `apps/rust-api/src/solver/sparse_solver.rs`

## 2) P-Delta / Geometric Nonlinearity

\[
([K_e]+[K_g(P)])\{U\}=\{F\}
\]

- Geometric stiffness assembly:
  - `apps/rust-api/src/solver/pdelta.rs`
- Beam/element geometric stiffness support:
  - `apps/rust-api/src/solver/elements.rs`

## 3) Modal Analysis

Generalized eigenproblem:
\[
([K]-\omega_n^2[M])\{\phi_n\}=0
\]

Participation factor:
\[
\Gamma_n=\frac{\{\phi_n\}^T[M]\{r\}}{\{\phi_n\}^T[M]\{\phi_n\}}
\]

Effective modal mass:
\[
M_{eff,n}=\Gamma_n^2\,M_n
\]

- Implemented in:
  - `apps/rust-api/src/solver/dynamics.rs` (`ModalSolver`)

## 4) Time History (Newmark-β)

Equation of motion:
\[
[M]\{\ddot U(t)\}+[C]\{\dot U(t)\}+[K]\{U(t)\}=\{F(t)\}
\]

Effective stiffness:
\[
[\bar K]=[K]+a_0[M]+a_1[C]
\]

- Implemented in:
  - `apps/rust-api/src/solver/dynamics.rs` (`TimeHistorySolver`)

## 5) Response Spectrum / CQC

SRSS:
\[
R=\sqrt{\sum_i R_i^2}
\]

CQC:
\[
R=\sqrt{\sum_i\sum_j \rho_{ij}R_iR_j}
\]

Cross-modal correlation (equal damping ratio \(\zeta\), \(r=\omega_j/\omega_i\)):
\[
\rho_{ij}=\frac{8\zeta^2(1+r)r^{3/2}}{(1-r^2)^2+4\zeta^2r(1+r)^2}
\]

- Implemented in:
  - `apps/rust-api/src/design_codes/is_1893.rs` (`combine_srss`, `combine_cqc`)
- Numeric guards in code:
  - damping clamped to [0, 0.30]
  - negative/zero frequencies skipped
  - \(\rho_{ij}\) clamped to [0,1]

## 6) Cable Catenary

Catenary relation with parameter \(a=H/w\):
\[
S=2a\sinh\left(\frac{L}{2a}\right)
\]

Sag at midspan:
\[
f=a\left[\cosh\left(\frac{L}{2a}\right)-1\right]
\]

Horizontal tension:
\[
H=w a
\]

Support tension:
\[
T_{max}=\sqrt{H^2+\left(\frac{wL}{2}\right)^2}
\]

Ernst effective modulus:
\[
E_{eff}=\frac{E}{1+\frac{(wL)^2EA}{12H^2}}
\]

- Implemented in:
  - `apps/rust-api/src/solver/cable.rs` (`calculate_catenary_sag`, `effective_modulus`)
  - `apps/rust-api/src/handlers/advanced.rs` (`cable_analysis`)
- Strength check uses stress:
  - \(\sigma=T_{max}/A\le f_u\)

## 7) IS 800 Steel Checks

- Shear capacity:
  \[
  V_d=\frac{A_v f_{yw}}{\sqrt{3}\,\gamma_{m0}}
  \]
- Bolt bearing / shear / HSFG / fillet weld as per implemented clauses.

- Implemented in:
  - `apps/rust-api/src/design_codes/is_800.rs`

## 8) IS 456 Concrete Checks

- Flexure (strain compatibility form):
  \[
  M_u=0.87f_yA_{st}(d-0.42x_u),\quad
  x_u=\frac{0.87f_yA_{st}}{0.36f_{ck}b}
  \]
- Shear:
  \[
  \tau_v=\frac{V_u}{bd},\quad
  V_{us}=\frac{0.87f_yA_{sv}d}{s_v}
  \]

- Implemented in:
  - `apps/rust-api/src/design_codes/is_456.rs`

## 9) IS 1893 Seismic Design

- Base shear:
  \[
  V_b=A_h W
  \]
- Vertical distribution:
  \[
  Q_i=V_b\frac{W_i h_i^2}{\sum_j W_j h_j^2}
  \]
- Drift limit:
  \[
  \theta=\frac{\Delta}{h}\le 0.004
  \]

- Implemented in:
  - `apps/rust-api/src/design_codes/is_1893.rs`

## 10) IS 875 Wind/Live Load

- Wind speed/pressure and storey force distribution
- Occupancy live loads + reduction factors

- Implemented in:
  - `apps/rust-api/src/design_codes/is_875.rs`

---

## Governance Rules

1. Rust implementation is canonical for numerical formulas.
2. Python should proxy or orchestrate; no duplicate math engines for migrated domains.
3. Any formula change must include:
   - equation update in this file,
   - code update,
   - at least one unit test.
4. Utilization ratio convention in code must remain:
   \[
   UR=\frac{\text{Demand}}{\text{Capacity}},\quad \text{Pass if }UR\le1.0
   \]
