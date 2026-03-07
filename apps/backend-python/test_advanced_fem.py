#!/usr/bin/env python3
"""Quick validation script for advanced FEM elements."""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Test element imports
from analysis.elements.advanced_elements import (
    GapElement, HookElement, FrictionPendulumElement,
    ViscousDamperElement, MultiLinearSpring,
    TensionOnlyMember, CompressionOnlyMember,
    Hex8Element, Hex20Element, KirchhoffPlate,
    DiaphragmConstraint, PhysicalToAnalyticalMesher,
    SolidMaterial, PhysicalMember, ELEMENT_REGISTRY,
)
print("  OK: advanced_elements imports")

# Test solver imports
from analysis.solvers.advanced_solver import (
    AdvancedDirectStiffnessMethod, AdvancedAssembler,
    AdvancedModel, PlateElement3D, SolidElement3D, LinkElement3D,
    analyze_advanced, build_advanced_model_from_dicts,
)
print("  OK: advanced_solver imports")

import numpy as np

# Hex8
coords = np.array([
    [0,0,0],[1,0,0],[1,1,0],[0,1,0],
    [0,0,1],[1,0,1],[1,1,1],[0,1,1],
], dtype=np.float64)
mat = SolidMaterial(E=200e6, nu=0.3)
hex8 = Hex8Element(coords, mat)
K = hex8.stiffness_matrix()
assert K.shape == (24, 24), f"Hex8 shape wrong: {K.shape}"
assert np.allclose(K, K.T), "Hex8 not symmetric"
print(f"  OK: Hex8 stiffness {K.shape}, symmetric, max={K.max():.0f}")

# Hex20
coords20 = np.zeros((20, 3), dtype=np.float64)
corners = np.array([
    [0,0,0],[1,0,0],[1,1,0],[0,1,0],
    [0,0,1],[1,0,1],[1,1,1],[0,1,1],
], dtype=np.float64)
coords20[:8] = corners
midside = [
    [0.5,0,0],[1,0.5,0],[0.5,1,0],[0,0.5,0],
    [0.5,0,1],[1,0.5,1],[0.5,1,1],[0,0.5,1],
    [0,0,0.5],[1,0,0.5],[1,1,0.5],[0,1,0.5],
]
coords20[8:] = np.array(midside, dtype=np.float64)
hex20 = Hex20Element(coords20, mat)
K20 = hex20.stiffness_matrix()
assert K20.shape == (60, 60), f"Hex20 shape wrong: {K20.shape}"
print(f"  OK: Hex20 stiffness {K20.shape}, symmetric={np.allclose(K20, K20.T)}")

# Kirchhoff plate
kp = KirchhoffPlate(
    nodes=[(0,0),(1,0),(1,1),(0,1)],
    thickness=0.2, E=30e6, nu=0.2,
)
Kp = kp.stiffness_matrix()
assert Kp.shape == (12, 12)
print(f"  OK: Kirchhoff plate {Kp.shape}, symmetric={np.allclose(Kp, Kp.T)}")

# Gap element
gap = GapElement(id="G1", node_i="1", node_j="2", k_comp=1e6)
kg = gap.local_stiffness()
assert kg.shape == (2, 2)
print(f"  OK: Gap element {kg.shape}, k={kg[0,0]:.0f}")

# Hook element
hook = HookElement(id="H1", node_i="1", node_j="2", k_tens=5e5)
kh = hook.local_stiffness()
assert kh[0,0] == 0.0, "Hook should be inactive by default"
print(f"  OK: Hook element (inactive by default)")

# Friction Pendulum
fpe = FrictionPendulumElement(id="FP1", node_i="1", node_j="2", R=2.0, mu=0.05, W=500.0)
kfp = fpe.local_stiffness()
assert kfp.shape == (12, 12)
print(f"  OK: Friction Pendulum {kfp.shape}, k_eff={fpe.k_eff():.1f}, beta={fpe.beta_eff():.4f}")

# Viscous Damper
vd = ViscousDamperElement(id="VD1", node_i="1", node_j="2", C=100.0, alpha=1.0)
kd = vd.local_stiffness()
cd = vd.local_damping_matrix()
assert cd[0,0] == 100.0
print(f"  OK: Viscous damper C_eff={vd.c_eff():.1f}")

# MultiLinear Spring
mls = MultiLinearSpring(
    id="ML1", node_i="1", node_j="2",
    backbone=[(-0.1, -200.0), (0.0, 0.0), (0.02, 100.0), (0.1, 120.0)],
)
kt = mls.tangent_stiffness(0.01)
print(f"  OK: MultiLinear spring k_tangent(0.01)={kt:.0f}")

# Diaphragm
dia = DiaphragmConstraint(
    floor_z=3.0, master_node="CM", slave_nodes=["1","2","3"],
    node_coords={"CM":(5.0,5.0,3.0),"1":(0.0,0.0,3.0),"2":(10.0,0.0,3.0),"3":(5.0,10.0,3.0)},
)
T = dia.slave_transform("1")
assert T.shape == (3, 3)
print(f"  OK: Diaphragm transform shape {T.shape}")

# Auto-mesher
mesher = PhysicalToAnalyticalMesher()
nodes_phys = {"1":(0,0,0), "2":(0,10,0), "3":(5,5,0), "4":(-5,5,0)}
members_phys = [
    PhysicalMember(id="C1", node_i="1", node_j="2", section_properties={"E":200e6,"A":0.01}),
    PhysicalMember(id="B1", node_i="4", node_j="3", section_properties={"E":200e6,"A":0.01}),
]
a_nodes, a_elems = mesher.mesh(nodes_phys, members_phys)
print(f"  OK: Auto-mesher {len(nodes_phys)} phys nodes -> {len(a_nodes)} analytical nodes, {len(a_elems)} elements")

# Full solver integration test (frame + plate)
result = analyze_advanced(
    nodes={
        "1": {"x": 0, "y": 0, "z": 0},
        "2": {"x": 5, "y": 0, "z": 0},
        "3": {"x": 5, "y": 5, "z": 0},
        "4": {"x": 0, "y": 5, "z": 0},
    },
    elements=[
        {"id": "B1", "node_i": "1", "node_j": "2", "E": 200e6, "G": 77e6,
         "A": 0.01, "Iy": 1e-4, "Iz": 1e-4, "J": 1e-5},
        {"id": "B2", "node_i": "4", "node_j": "3", "E": 200e6, "G": 77e6,
         "A": 0.01, "Iy": 1e-4, "Iz": 1e-4, "J": 1e-5},
    ],
    supports={"1": [0,1,2,3,4,5], "4": [0,1,2,3,4,5],
              "2": [2,3,4,5], "3": [2,3,4,5]},
    nodal_loads={"2": {"uy": -50.0}},
    plate_elements=[
        {"id": "P1", "nodes": ["1","2","3","4"], "thickness": 0.15,
         "E": 30e6, "nu": 0.2, "formulation": "thick"},
    ],
)
print(f"  OK: Full solver: {result['n_dofs']} DOFs, max_disp={result['max_displacement']:.6f}")
print(f"      Solve time: {result['solve_time_ms']:.1f} ms")
print(f"      Warnings: {result.get('warnings', [])}")

# Tension-only test
result_tc = analyze_advanced(
    nodes={
        "A": {"x": 0, "y": 0, "z": 0},
        "B": {"x": 3, "y": 4, "z": 0},
        "C": {"x": 6, "y": 0, "z": 0},
    },
    elements=[
        {"id": "T1", "node_i": "A", "node_j": "B", "E": 200e6, "A": 0.001, "Iy": 1e-8, "Iz": 1e-8, "J": 1e-9},
        {"id": "T2", "node_i": "B", "node_j": "C", "E": 200e6, "A": 0.001, "Iy": 1e-8, "Iz": 1e-8, "J": 1e-9},
    ],
    supports={"A": [0,1,2,3,4,5], "C": [0,1,2,3,4,5]},
    nodal_loads={"B": {"uy": -10.0}},
    tension_only=["T1", "T2"],
)
print(f"  OK: Tension-only: max_disp={result_tc['max_displacement']:.6f}")
print(f"      Warnings: {result_tc.get('warnings', [])}")

print("\n  === ALL TESTS PASSED ===")
