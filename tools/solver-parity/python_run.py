#!/usr/bin/env python3
"""Run a fixture directly using the Python sparse solver (no HTTP).

Run from the repo root with the Python venv activated for apps/backend-python

Usage:
  python tools/solver-parity/python_run.py tests/solver-parity/fixtures/basic_frame.json

This imports `analysis.sparse_solver.analyze_large_frame` and executes it with
fixed DOFs derived from the fixture `supports` array.
"""
import json
import sys
import os
from typing import List

# Make sure imports resolve to apps/backend-python package modules
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
BACKEND_PY = os.path.join(ROOT, 'apps', 'backend-python')
if BACKEND_PY not in sys.path:
    sys.path.insert(0, BACKEND_PY)

def compute_fixed_dofs(nodes: List[dict], supports: List[dict]) -> List[int]:
    node_map = {n['id']: i for i, n in enumerate(nodes)}
    fixed = []
    for s in supports or []:
        nid = s.get('nodeId')
        if nid is None:
            continue
        idx = node_map.get(nid)
        if idx is None:
            continue
        base = idx * 6
        # fx, fy, fz -> translational DOFs 0,1,2
        if s.get('fx'):
            fixed.append(base + 0)
        if s.get('fy'):
            fixed.append(base + 1)
        if s.get('fz'):
            fixed.append(base + 2)
        # mx,my,mz -> rotational DOFs 3,4,5
        if s.get('mx'):
            fixed.append(base + 3)
        if s.get('my'):
            fixed.append(base + 4)
        if s.get('mz'):
            fixed.append(base + 5)
    # remove duplicates
    return sorted(set(fixed))

def main():
    if len(sys.argv) < 2:
        print('Usage: python tools/solver-parity/python_run.py <fixture.json>')
        sys.exit(2)

    fixture_path = sys.argv[1]
    with open(fixture_path, 'r') as f:
        fixture = json.load(f)

    payload = fixture.get('payload') or fixture
    nodes = payload.get('nodes', [])
    members = payload.get('members', [])
    supports = payload.get('supports', [])
    loads = payload.get('loads', [])

    fixed_dofs = compute_fixed_dofs(nodes, supports)

    try:
        from analysis.sparse_solver import analyze_large_frame
    except Exception as e:
        print('Could not import analyze_large_frame from analysis.sparse_solver:', e)
        sys.exit(3)

    print(f'Running Python sparse solver on fixture {fixture_path} (nodes={len(nodes)}, members={len(members)})')
    res = analyze_large_frame(nodes=nodes, members=members, loads=loads, fixed_dofs=fixed_dofs, method='auto')
    print(json.dumps(res, indent=2))

if __name__ == '__main__':
    main()
