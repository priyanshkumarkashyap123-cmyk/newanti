"""
test_lsd_design.py - Comprehensive Test Suite for LSD Algorithm

Tests all components of the Limit State Design module:
  1. Limiting moment calculation
  2. Singly reinforced design
  3. Doubly reinforced design
  4. Shear design
  5. Complete integration workflow

Standard: IS 456:2000
Date: March 2026
"""

import sys
import logging
import json
from typing import Dict, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)-10s | %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)


# ============================================================================
# TEST CASE 1: Singly Reinforced Section (Mu < Mu_lim)
# ============================================================================

def test_singly_reinforced():
    """
    Test Case 1: Singly Reinforced Section
    
    Beam: 300 mm wide × 600 mm depth
    Material: M30 concrete, Fe500 steel
    Loads: Mu = 300 kN·m, Vu = 150 kN
    
    Expected:
      • Limiting moment ~ 330 kN·m
      • Tension steel: ~3-16φ (1920 mm²)
      • No compression steel
      • Shear: 8φ @ 200 c/c (approx)
    """
    from analysis.solvers.rc_limit_state_design import (
        BeamSection, ConcreteProperties, RebarProperties,
        ConcreteGrade, RebarGrade, LimitStateDesignBeam
    )
    
    print("\n" + "="*70)
    print("TEST 1: SINGLY REINFORCED SECTION")
    print("="*70)
    
    # Section and materials
    beam = BeamSection(b=300, d=550, d_prime=60)
    concrete = ConcreteProperties(grade=ConcreteGrade.M30, fck=30.0)
    rebar = RebarProperties(grade=RebarGrade.Fe500, fy=500.0)
    
    # Design
    designer = LimitStateDesignBeam(Mu=300.0, Vu=150.0, beam=beam, 
                                     concrete=concrete, rebar=rebar)
    result = designer.design()
    
    # Validation
    checks = [
        ("Mu < Mu_lim", result.Mu < result.limiting_moment.Mu_lim),
        ("Design type is singly reinforced", 
         result.bending.design_type == 'singly_reinforced'),
        ("No compression steel", result.bending.Asc_required == 0),
        ("Design ratio ≤ 1.0", result.design_ratio <= 1.0),
        ("Moment ratio ≤ 1.0", result.bending.mu_ratio <= 1.0),
    ]
    
    print("\nValidation Checks:")
    all_pass = True
    for check_name, check_result in checks:
        status = "✓ PASS" if check_result else "✗ FAIL"
        print(f"  {status} - {check_name}")
        if not check_result:
            all_pass = False
    
    print(f"\nFinal Spec: {result.rebar_summary}")
    
    return all_pass, result


# ============================================================================
# TEST CASE 2: Doubly Reinforced Section (Mu > Mu_lim)
# ============================================================================

def test_doubly_reinforced():
    """
    Test Case 2: Doubly Reinforced Section
    
    Beam: 300 mm × 600 mm
    Material: M30, Fe500
    Loads: Mu = 450 kN·m (> Mu_lim), Vu = 200 kN
    
    Expected:
      • Mu > Mu_lim → Compression steel required
      • Main tension: 4-20φ (1256 mm²)
      • Compression: 2-16φ (402 mm²)
      • Shear: 8φ @ 150-200 c/c
    """
    from analysis.solvers.rc_limit_state_design import (
        BeamSection, ConcreteProperties, RebarProperties,
        ConcreteGrade, RebarGrade, LimitStateDesignBeam
    )
    
    print("\n" + "="*70)
    print("TEST 2: DOUBLY REINFORCED SECTION")
    print("="*70)
    
    beam = BeamSection(b=300, d=550, d_prime=60)
    concrete = ConcreteProperties(grade=ConcreteGrade.M30, fck=30.0)
    rebar = RebarProperties(grade=RebarGrade.Fe500, fy=500.0)
    
    designer = LimitStateDesignBeam(Mu=450.0, Vu=200.0, beam=beam,
                                     concrete=concrete, rebar=rebar)
    result = designer.design()
    
    checks = [
        ("Mu > Mu_lim", result.Mu > result.limiting_moment.Mu_lim),
        ("Design type is doubly reinforced",
         result.bending.design_type == 'doubly_reinforced'),
        ("Compression steel present",
         result.bending.Asc_required > 0),
        ("Compression bars specified",
         result.bending.comp_rebar_count > 0),
        ("Design ratio ≤ 1.0", result.design_ratio <= 1.0),
    ]
    
    print("\nValidation Checks:")
    all_pass = True
    for check_name, check_result in checks:
        status = "✓ PASS" if check_result else "✗ FAIL"
        print(f"  {status} - {check_name}")
        if not check_result:
            all_pass = False
    
    print(f"\nFinal Spec: {result.rebar_summary}")
    
    return all_pass, result


# ============================================================================
# TEST CASE 3: Critical Shear Design (High Vu)
# ============================================================================

def test_shear_design():
    """
    Test Case 3: Shear Design
    
    Beam: 250 mm × 500 mm
    Material: M25, Fe500
    Loads: Mu = 200 kN·m, Vu = 300 kN (high shear)
    
    Expected:
      • High nominal shear stress
      • τv > τc → Stirrups required
      • Close spacing (100-150 mm)
    """
    from analysis.solvers.rc_limit_state_design import (
        BeamSection, ConcreteProperties, RebarProperties,
        ConcreteGrade, RebarGrade, LimitStateDesignBeam
    )
    
    print("\n" + "="*70)
    print("TEST 3: HIGH SHEAR DESIGN")
    print("="*70)
    
    beam = BeamSection(b=250, d=450, d_prime=60)
    concrete = ConcreteProperties(grade=ConcreteGrade.M25, fck=25.0)
    rebar = RebarProperties(grade=RebarGrade.Fe500, fy=500.0)
    
    designer = LimitStateDesignBeam(Mu=200.0, Vu=300.0, beam=beam,
                                     concrete=concrete, rebar=rebar)
    result = designer.design()
    
    checks = [
        ("Shear requires stirrups",
         result.shear.requires_stirrups == True),
        ("Stirrup spacing < 200 mm",
         result.shear.stirrup_spacing < 200),
        ("Stirrup diameter ≥ 8 mm",
         result.shear.stirrup_dia >= 8),
        ("τv > τc",
         result.shear.tau_v > result.shear.tau_c),
        ("Design ratio ≤ 1.0", result.design_ratio <= 1.0),
    ]
    
    print("\nValidation Checks:")
    all_pass = True
    for check_name, check_result in checks:
        status = "✓ PASS" if check_result else "✗ FAIL"
        print(f"  {status} - {check_name}")
        if not check_result:
            all_pass = False
    
    print(f"\nShear Details:")
    print(f"  τv = {result.shear.tau_v:.2f} N/mm²")
    print(f"  τc = {result.shear.tau_c:.2f} N/mm²")
    print(f"  Stirrup: {result.shear.stirrup_desc}")
    
    return all_pass, result


# ============================================================================
# TEST CASE 4: Limiting Moment for Different Concrete Grades
# ============================================================================

def test_limiting_moment_grades():
    """
    Test Case 4: Limiting Moment Across Concrete Grades
    
    Compare Mu_lim for same section across different concrete grades:
    M20, M25, M30, M35, M40
    
    Expected:
      • Mu_lim increases with concrete grade
      • Relationship ~ fck
    """
    from analysis.solvers.rc_limit_state_design import (
        BeamSection, ConcreteProperties, RebarProperties,
        ConcreteGrade, RebarGrade, LimitingMomentCalculator
    )
    
    print("\n" + "="*70)
    print("TEST 4: LIMITING MOMENT ACROSS CONCRETE GRADES")
    print("="*70)
    
    beam = BeamSection(b=300, d=550, d_prime=60)
    rebar = RebarProperties(grade=RebarGrade.Fe500, fy=500.0)
    
    grades_fck = [
        (ConcreteGrade.M20, 20.0),
        (ConcreteGrade.M25, 25.0),
        (ConcreteGrade.M30, 30.0),
        (ConcreteGrade.M35, 35.0),
        (ConcreteGrade.M40, 40.0),
    ]
    
    results = []
    print("\nLimiting Moment vs Concrete Grade:")
    print("  Grade     fck(N/mm²)   Mu_lim(kN·m)   xu/d")
    print("  " + "-"*50)
    
    for grade, fck in grades_fck:
        concrete = ConcreteProperties(grade=grade, fck=fck)
        lim = LimitingMomentCalculator.calculate(beam, concrete, rebar)
        
        xu_d_ratio = lim.xu_lim / beam.d
        results.append((grade.name, fck, lim.Mu_lim, xu_d_ratio))
        
        print(f"  {grade.name:5s}     {fck:5.1f}        {lim.Mu_lim:7.2f}        {xu_d_ratio:.3f}")
    
    # Check monotonic increase
    all_pass = True
    for i in range(len(results) - 1):
        if results[i][2] >= results[i+1][2]:  # Check Mu_lim increases
            print(f"  ✗ FAIL: Mu_lim not monotonic increasing")
            all_pass = False
            break
    
    if all_pass:
        print("  ✓ PASS: Mu_lim correctly increases with concrete grade")
    
    return all_pass, results


# ============================================================================
# TEST CASE 5: Integration with Load Factoring
# ============================================================================

def test_load_factoring_integration():
    """
    Test Case 5: Integration with Load Factoring
    
    Simulate analysis → load factoring → LSD design workflow
    """
    from analysis.solvers.lsd_integration import (
        LoadFactoring, RCBeamDesigner, DesignInput
    )
    
    print("\n" + "="*70)
    print("TEST 5: LOAD FACTORING & DESIGN INTEGRATION")
    print("="*70)
    
    # Simulated analysis results (service loads)
    service_moment = 300.0  # kN·m
    service_shear = 120.0   # kN
    
    # Apply load factors (ultimate design)
    ultimate_moment, ultimate_shear = LoadFactoring.factor_loads(
        Md=service_moment,
        Vd=service_shear,
        load_factor=1.5  # IS 875 default
    )
    
    print(f"\nLoad Factoring (γ = 1.5):")
    print(f"  Service: Md = {service_moment:.2f} kN·m, Vd = {service_shear:.2f} kN")
    print(f"  Ultimate: Mu = {ultimate_moment:.2f} kN·m, Vu = {ultimate_shear:.2f} kN")
    
    # Design RC beam
    design_input = DesignInput(
        Mu=ultimate_moment,
        Vu=ultimate_shear,
        beam_width=300,
        beam_depth=600,
        cover_tension=50,
        concrete_grade='M30',
        steel_grade='Fe500'
    )
    
    designer = RCBeamDesigner(design_input)
    response = designer.design()
    
    checks = [
        ("Design validation passed", response['status'] == 'success'),
        ("Design passes", response['design_status']['passes'] == True),
        ("Rebar layout generated", 'summary' in response['rebar_layout']),
    ]
    
    print("\nValidation Checks:")
    all_pass = True
    for check_name, check_result in checks:
        status = "✓ PASS" if check_result else "✗ FAIL"
        print(f"  {status} - {check_name}")
        if not check_result:
            all_pass = False
    
    if all_pass:
        print(f"\nFinal Rebar Layout:")
        print(f"  {response['rebar_layout']['summary']}")
    
    return all_pass, response


# ============================================================================
# TEST CASE 6: Edge Cases
# ============================================================================

def test_edge_cases():
    """
    Test Case 6: Edge Cases & Boundary Conditions
    """
    from analysis.solvers.rc_limit_state_design import (
        BeamSection, ConcreteProperties, RebarProperties,
        ConcreteGrade, RebarGrade, LimitStateDesignBeam
    )
    
    print("\n" + "="*70)
    print("TEST 6: EDGE CASES & BOUNDARY CONDITIONS")
    print("="*70)
    
    beam = BeamSection(b=300, d=550, d_prime=60)
    concrete = ConcreteProperties(grade=ConcreteGrade.M30, fck=30.0)
    rebar = RebarProperties(grade=RebarGrade.Fe500, fy=500.0)
    
    test_cases = [
        ("Zero moment", 0.0, 100.0, True),          # Minimum steel case
        ("Zero shear", 200.0, 0.0, True),           # No stirrups needed
        ("High moment", 800.0, 300.0, True),        # Doubly reinforced handles it
        ("Balanced loading", 300.0, 150.0, True),   # Typical case
    ]
    
    print("\nEdge Case Testing:")
    all_pass = True
    
    for case_name, Mu, Vu, should_pass in test_cases:
        try:
            designer = LimitStateDesignBeam(Mu=Mu, Vu=Vu, beam=beam,
                                             concrete=concrete, rebar=rebar)
            result = designer.design()
            
            passed = (result.design_status == '✓ PASS') == should_pass
            status = "✓ PASS" if passed else "✗ FAIL"
            
            print(f"  {status} - {case_name:20s} (Mu={Mu:6.1f}, ratio={result.design_ratio:.2f})")
            
            if not passed:
                all_pass = False
                
        except Exception as e:
            print(f"  ✗ FAIL - {case_name}: {str(e)}")
            all_pass = False
    
    return all_pass


# ============================================================================
# COMPREHENSIVE TEST RUNNER
# ============================================================================

def run_all_tests():
    """Execute all test cases and generate summary."""
    
    print("\n" + "="*70)
    print("COMPREHENSIVE LSD ALGORITHM TEST SUITE")
    print("IS 456:2000 REINFORCED CONCRETE BEAM DESIGN")
    print("="*70)
    
    test_results = {}
    
    # Test 1
    try:
        pass1, res1 = test_singly_reinforced()
        test_results['Test 1: Singly Reinforced'] = \
            '✓ PASS' if pass1 else '✗ FAIL'
    except Exception as e:
        logger.error(f"Test 1 failed: {e}")
        test_results['Test 1: Singly Reinforced'] = '✗ FAIL'
    
    # Test 2
    try:
        pass2, res2 = test_doubly_reinforced()
        test_results['Test 2: Doubly Reinforced'] = \
            '✓ PASS' if pass2 else '✗ FAIL'
    except Exception as e:
        logger.error(f"Test 2 failed: {e}")
        test_results['Test 2: Doubly Reinforced'] = '✗ FAIL'
    
    # Test 3
    try:
        pass3, res3 = test_shear_design()
        test_results['Test 3: High Shear'] = \
            '✓ PASS' if pass3 else '✗ FAIL'
    except Exception as e:
        logger.error(f"Test 3 failed: {e}")
        test_results['Test 3: High Shear'] = '✗ FAIL'
    
    # Test 4
    try:
        pass4, res4 = test_limiting_moment_grades()
        test_results['Test 4: Limiting Moment Grades'] = \
            '✓ PASS' if pass4 else '✗ FAIL'
    except Exception as e:
        logger.error(f"Test 4 failed: {e}")
        test_results['Test 4: Limiting Moment Grades'] = '✗ FAIL'
    
    # Test 5
    try:
        pass5, res5 = test_load_factoring_integration()
        test_results['Test 5: Load Factoring Integration'] = \
            '✓ PASS' if pass5 else '✗ FAIL'
    except Exception as e:
        logger.error(f"Test 5 failed: {e}")
        test_results['Test 5: Load Factoring Integration'] = '✗ FAIL'
    
    # Test 6
    try:
        pass6 = test_edge_cases()
        test_results['Test 6: Edge Cases'] = \
            '✓ PASS' if pass6 else '✗ FAIL'
    except Exception as e:
        logger.error(f"Test 6 failed: {e}")
        test_results['Test 6: Edge Cases'] = '✗ FAIL'
    
    # Summary
    print("\n" + "="*70)
    print("TEST SUMMARY")
    print("="*70)
    
    for test_name, result in test_results.items():
        print(f"  {result} - {test_name}")
    
    total_pass = sum(1 for r in test_results.values() if '✓' in r)
    total_tests = len(test_results)
    
    print(f"\nTotal: {total_pass}/{total_tests} tests passed")
    
    if total_pass == total_tests:
        print("\n✓ ALL TESTS PASSED - LSD ALGORITHM VALIDATED")
        return True
    else:
        print(f"\n✗ {total_tests - total_pass} TEST(S) FAILED")
        return False


# ============================================================================
# EXAMPLE QUICK API USAGE
# ============================================================================

def quick_example():
    """Simple quick-start example."""
    from analysis.solvers.lsd_integration import design_rc_beam
    
    print("\n" + "="*70)
    print("QUICK EXAMPLE: RC BEAM DESIGN API")
    print("="*70)
    
    # Design a beam
    result = design_rc_beam(
        Mu=350.0,           # Ultimate moment (kN·m)
        Vu=200.0,           # Ultimate shear (kN)
        width_mm=300,       # Beam width (mm)
        depth_mm=600,       # Beam depth (mm)
        concrete_grade='M30',
        steel_grade='Fe500',
        cover_mm=50
    )
    
    if result['status'] == 'success':
        print(f"\n✓ Design Successful\n")
        print(f"Rebar Specification:")
        layout = result['rebar_layout']
        print(f"  {layout['summary']}\n")
        print(f"Design Ratio: {result['design_status']['design_ratio']:.3f}")
        print(f"Status: {result['design_status']['status']}")
    else:
        print(f"\n✗ Design Failed: {result.get('errors', [])}")


if __name__ == "__main__":
    # Run comprehensive tests
    success = run_all_tests()
    
    # Show quick example
    quick_example()
    
    # Exit with status
    sys.exit(0 if success else 1)
