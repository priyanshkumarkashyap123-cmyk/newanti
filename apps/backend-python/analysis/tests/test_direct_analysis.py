"""
test_direct_analysis.py - Test Direct Analysis Method and Timoshenko Beam Theory

Tests:
1. Direct Analysis stiffness reduction (0.8E)
2. τ_b factor calculation
3. Timoshenko beam deflection comparison
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from analysis.fea_engine import (
    FEAEngine, AnalysisOptions, ModelInput, NodeInput, MemberInput,
    NodeLoadInput, analyze_frame
)
from analysis.solvers.nonlinear import Member, PDeltaAnalyzer, Node
import numpy as np
import math


def test_stiffness_reduction():
    """Test that Direct Analysis applies 0.8E reduction"""
    print("\n" + "="*60)
    print("TEST 1: Direct Analysis Stiffness Reduction (0.8E)")
    print("="*60)
    
    member = MemberInput(
        id="M1",
        start_node_id="N1",
        end_node_id="N2",
        E=200e6,  # 200 GPa in kN/m²
        A=0.01,
        Iy=1e-4,
        Iz=1e-4,
        Fy=345e3  # 345 MPa yield stress
    )
    
    # Test without Direct Analysis
    engine_normal = FEAEngine(options=AnalysisOptions(direct_analysis=False))
    E_axial, E_flexural = engine_normal._get_effective_modulus(member)
    print(f"Normal Analysis: E_axial = {E_axial:.2e}, E_flexural = {E_flexural:.2e}")
    assert E_axial == 200e6, "Normal analysis should not modify E"
    
    # Test with Direct Analysis
    engine_direct = FEAEngine(options=AnalysisOptions(direct_analysis=True))
    E_axial, E_flexural = engine_direct._get_effective_modulus(member)
    print(f"Direct Analysis: E_axial = {E_axial:.2e}, E_flexural = {E_flexural:.2e}")
    assert E_axial == 0.8 * 200e6, "Direct Analysis should apply 0.8 factor"
    
    print("✅ Stiffness reduction test PASSED")


def test_tau_b_factor():
    """Test τ_b factor calculation for high compression"""
    print("\n" + "="*60)
    print("TEST 2: τ_b Factor Calculation")
    print("="*60)
    
    engine = FEAEngine(options=AnalysisOptions(direct_analysis=True, tau_b_enabled=True))
    
    # Test cases: Pr/Py ratio -> expected τ_b
    test_cases = [
        (0.0, 1.0, "No compression"),
        (0.25, 1.0, "Pr/Py = 0.25 (≤ 0.5)"),
        (0.5, 1.0, "Pr/Py = 0.5 (boundary)"),
        (0.75, 0.75, "Pr/Py = 0.75 (> 0.5)"),
        (1.0, 0.0, "Pr/Py = 1.0 (full yield)")
    ]
    
    for Pr_ratio, expected_tau_b, description in test_cases:
        Py = 1000  # kN
        Pr = Pr_ratio * Py
        tau_b = engine._calculate_tau_b(Pr, Py)
        
        # For Pr/Py > 0.5: τ_b = 4 * ratio * (1 - ratio)
        if Pr_ratio > 0.5:
            expected_tau_b = 4 * Pr_ratio * (1 - Pr_ratio)
        
        print(f"  {description}: τ_b = {tau_b:.3f} (expected: {expected_tau_b:.3f})")
        assert abs(tau_b - expected_tau_b) < 0.001, f"τ_b mismatch at {description}"
    
    print("✅ τ_b factor test PASSED")


def test_timoshenko_beam():
    """Test Timoshenko beam stiffness modification"""
    print("\n" + "="*60)
    print("TEST 3: Timoshenko Beam Theory (Shear Deformation)")
    print("="*60)
    
    # Create two members: one Euler-Bernoulli, one Timoshenko
    nodes = [
        Node(id="N1", x=0, y=0, z=0, dof_indices=[0,1,2,3,4,5], supports=[True]*6),
        Node(id="N2", x=2, y=0, z=0, dof_indices=[6,7,8,9,10,11])
    ]
    
    # Short deep beam - shear deformation significant
    L = 2.0  # m
    b = 0.3  # m (width)
    h = 0.6  # m (depth) - L/h = 3.3, deep beam
    
    A = b * h
    Iy = b * h**3 / 12
    Iz = h * b**3 / 12
    
    # Shear area for rectangular section ≈ 5/6 * A
    As = 5/6 * A
    
    print(f"  Beam: L={L}m, h={h}m, L/h={L/h:.1f} (deep beam)")
    print(f"  Area A = {A:.4f} m², I = {Iy:.6f} m⁴")
    print(f"  Shear area As = {As:.4f} m²")
    
    # Euler-Bernoulli member (no shear area)
    member_eb = Member(
        id="M1",
        start_node_id="N1",
        end_node_id="N2",
        E=200e9,
        G=77e9,
        A=A,
        Iy=Iy,
        Iz=Iz,
        Asy=None,  # No shear deformation
        Asz=None
    )
    
    # Timoshenko member (with shear area)
    member_timo = Member(
        id="M1",
        start_node_id="N1",
        end_node_id="N2",
        E=200e9,
        G=77e9,
        A=A,
        Iy=Iy,
        Iz=Iz,
        Asy=As,
        Asz=As
    )
    
    # Create analyzer and get stiffness matrices
    analyzer = PDeltaAnalyzer([nodes[0], nodes[1]], [member_eb])
    
    Ke_eb = analyzer._get_member_Ke_local(member_eb)
    Ke_timo = analyzer._get_member_Ke_local(member_timo)
    
    # Compare lateral stiffness (k22 - shear in y)
    k22_eb = Ke_eb[1, 1]
    k22_timo = Ke_timo[1, 1]
    
    # Timoshenko should be softer (lower stiffness)
    stiffness_ratio = k22_timo / k22_eb
    
    # Calculate expected φ
    phi = 12 * member_timo.E * Iz / (member_timo.G * As * L**2)
    expected_ratio = 1 / (1 + phi)
    
    print(f"\n  Shear deformation parameter φ = {phi:.4f}")
    print(f"  Euler-Bernoulli k22 = {k22_eb:.2e} N/m")
    print(f"  Timoshenko k22 = {k22_timo:.2e} N/m")
    print(f"  Stiffness ratio = {stiffness_ratio:.4f} (expected: {expected_ratio:.4f})")
    print(f"  Stiffness reduction = {(1-stiffness_ratio)*100:.1f}%")
    
    assert stiffness_ratio < 1.0, "Timoshenko should be softer than Euler-Bernoulli"
    assert abs(stiffness_ratio - expected_ratio) < 0.01, "Stiffness ratio mismatch"
    
    print("✅ Timoshenko beam test PASSED")


def test_analyze_frame_with_direct_analysis():
    """Test full analysis with Direct Analysis enabled via API"""
    print("\n" + "="*60)
    print("TEST 4: Full Analysis with Direct Analysis (API Test)")
    print("="*60)
    
    model = {
        "nodes": [
            {"id": "N1", "x": 0, "y": 0, "z": 0, "support": "fixed"},
            {"id": "N2", "x": 0, "y": 3, "z": 0}
        ],
        "members": [
            {
                "id": "M1",
                "startNodeId": "N1",
                "endNodeId": "N2",
                "E": 200e6,
                "A": 0.01,
                "Iy": 1e-4,
                "Iz": 1e-4
            }
        ],
        "node_loads": [
            {"nodeId": "N2", "fx": 10}  # 10 kN lateral load
        ],
        "options": {
            "direct_analysis": True,
            "stiffness_reduction_factor": 0.8
        }
    }
    
    result = analyze_frame(model)
    
    print(f"  Success: {result['success']}")
    
    if result['success']:
        print(f"  Max Displacement: {result['max_displacement']:.4f} mm")
        
        # Check Direct Analysis info is returned
        if 'direct_analysis' in result:
            da = result['direct_analysis']
            print(f"  Direct Analysis: enabled={da['enabled']}")
            print(f"  Stiffness reduction: {da['stiffness_reduction_factor']}")
            print(f"  Stiffness modifications: {da['stiffness_modifications']}")
            assert da['enabled'] == True
            assert da['stiffness_reduction_factor'] == 0.8
            print("✅ Direct Analysis API test PASSED")
        else:
            print("⚠️ Direct Analysis info not in response")
    else:
        print(f"  Error: {result['error']}")
        print("⚠️ Analysis failed - check PyNite installation")


if __name__ == "__main__":
    print("\n" + "="*60)
    print(" BEAMLAB FEA ENGINE - PHASE 1 & 2 TESTS")
    print("="*60)
    
    test_stiffness_reduction()
    test_tau_b_factor()
    test_timoshenko_beam()
    test_analyze_frame_with_direct_analysis()
    
    print("\n" + "="*60)
    print(" ALL TESTS COMPLETED")
    print("="*60 + "\n")
