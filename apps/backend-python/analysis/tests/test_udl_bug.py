"""
test_udl_bug.py - Verify UDL Moment Calculation in solver.py

Scenario:
Simple Beam, L=10m
UDL: 10 kN/m from x=0 to x=5m
Check Moment at x=8m.

Hand Calc:
Total Load W = 10 * 5 = 50 kN.
Centroid at x = 2.5m.
Reactions:
Sum M_A = 0 -> Rb * 10 - W * 2.5 = 0 -> Rb = 50 * 2.5 / 10 = 12.5 kN
Ra = 50 - 12.5 = 37.5 kN

Moment at x=8m (Cut section at 8, look left):
M(8) = Ra * 8 - W * (8 - 2.5)
M(8) = 37.5 * 8 - 50 * 5.5
M(8) = 300 - 275 = 25 kN.m

Current Bug Hypothesis:
Code uses M -= w * len * (len/2)
M_code = Ra * 8 - 10 * 5 * (5/2)
M_code = 300 - 125 = 175 kN.m

Expected: 25.0
Actual likely: 175.0
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from analysis.solver import BeamAnalysisInput, Load, LoadType, Support, BeamSolver

def test_udl_moment():
    print("Testing UDL Moment Calculation...")
    
    L = 10.0
    w = 10.0
    start = 0.0
    end = 5.0
    
    beam = BeamAnalysisInput(
        length=L,
        loads=[Load(type=LoadType.UDL, magnitude=w, position=start, end_position=end)],
        supports=[
            Support(position=0, type="pinned"),
            Support(position=L, type="roller")
        ],
        E=200e6,
        I=1e-4
    )
    
    solver = BeamSolver(beam)
    result = solver.solve()
    
    # Check reactions
    print(f"Reactions: {result.reactions}")
    expected_Rb = (w * (end-start) * (start + (end-start)/2)) / L
    print(f"Expected Rb: {expected_Rb}")
    
    # Find x near 8.0
    # Solver uses 100 points. 10m / 99 steps approx 0.1m.
    # We can inspect diagram data.
    
    points = result.diagram.x_values
    moments = result.diagram.moment_values
    
    # Interpolate or find closest
    idx = -1
    min_dist = 1.0
    for i, x in enumerate(points):
        if abs(x - 8.0) < min_dist:
            min_dist = abs(x - 8.0)
            idx = i
            
    if idx != -1:
        x_found = points[idx]
        m_found = moments[idx]
        
        # Hand calc for exact x
        Ra = result.reactions['Ra']
        W = w * (end - start)
        centroid = start + (end - start)/2
        expected_M = Ra * x_found - W * (x_found - centroid)
        
        print(f"\nAt x = {x_found:.2f} m:")
        print(f"  Solver Moment: {m_found:.2f} kN.m")
        print(f"  Expected Moment: {expected_M:.2f} kN.m")
        
        error = abs(m_found - expected_M)
        if error > 1.0:
            print(f"  ❌ FAILURE: Error {error:.2f} is too large!")
        else:
            print(f"  ✅ SUCCESS: Matches expectation.")
    else:
        print("Could not find point near x=8.0")

if __name__ == "__main__":
    test_udl_moment()
