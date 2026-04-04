#!/usr/bin/env python3
"""
test_factory_refactor.py - Validation script for factory module refactoring
"""

from factory import StructuralFactory

def test_all_generators():
    """Test all generator types."""
    factory = StructuralFactory()
    
    tests = [
        ("simple_beam", lambda: factory.generate_simple_beam(10)),
        ("portal_frame", lambda: factory.generate_portal_frame(20, 8)),
        ("continuous_beam", lambda: factory.generate_continuous_beam([5, 5, 5])),
        ("pratt_truss", lambda: factory.generate_pratt_truss(30, 4, 6)),
        ("warren_truss", lambda: factory.generate_warren_truss(30, 4, 6)),
        ("howe_truss", lambda: factory.generate_howe_truss(30, 4, 6)),
        ("3d_frame", lambda: factory.generate_3d_frame(20, 20, 4, 3, 2, 2)),
        ("tower", lambda: factory.generate_tower(10, 5, 50)),
        ("multi_bay_portal", lambda: factory.generate_multi_bay_portal(30, 8, 3, 10.0)),
        ("bridge", lambda: factory.generate_bridge(40, 8, 6)),
        ("space_truss", lambda: factory.generate_space_truss(30, 30, 5)),
        ("arch", lambda: factory.generate_arch(40, 8)),
    ]
    
    print("=" * 70)
    print("Testing Factory Module Refactoring")
    print("=" * 70)
    
    passed = 0
    failed = 0
    
    for name, gen_func in tests:
        try:
            result = gen_func()
            n_nodes = len(result.nodes)
            n_members = len(result.members)
            print(f"✓ {name:25s} | nodes: {n_nodes:4d} | members: {n_members:4d}")
            passed += 1
        except Exception as e:
            print(f"✗ {name:25s} | ERROR: {str(e)}")
            failed += 1
    
    print("=" * 70)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 70)
    
    if failed == 0:
        print("\n✓✓✓ All generators working correctly! ✓✓✓")
    else:
        print(f"\n✗ {failed} generator(s) failed")
        return False
    
    return True


if __name__ == "__main__":
    success = test_all_generators()
    exit(0 if success else 1)
