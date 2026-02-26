#!/usr/bin/env python3
"""
Structural Solver - High-Performance Python Solver
Uses scipy.sparse for efficient sparse matrix operations.

Usage:
    python solver.py input.json
    python solver.py --stdin < input.json
"""

import sys
import json
import time
import argparse
import numpy as np
from scipy import sparse
from scipy.sparse import linalg as spla
from typing import Dict, List, Optional, Tuple

# ============================================
# TYPES
# ============================================

class Node:
    def __init__(self, id: str, x: float, y: float, z: float, restraints: Optional[Dict] = None):
        self.id = id
        self.x = x
        self.y = y
        self.z = z
        self.restraints = restraints or {}

class Member:
    def __init__(self, id: str, start_node_id: str, end_node_id: str, 
                 E: float = 200e9, A: float = 0.01, I: float = 1e-4):
        self.id = id
        self.start_node_id = start_node_id
        self.end_node_id = end_node_id
        self.E = E
        self.A = A
        self.I = I

class Load:
    def __init__(self, node_id: str, fx: float = 0, fy: float = 0, fz: float = 0,
                 mx: float = 0, my: float = 0, mz: float = 0):
        self.node_id = node_id
        self.fx = fx
        self.fy = fy
        self.fz = fz
        self.mx = mx
        self.my = my
        self.mz = mz

# ============================================
# SPARSE STIFFNESS ASSEMBLER
# ============================================

class SparseStiffnessAssembler:
    def __init__(self, nodes: List[Node], members: List[Member], loads: List[Load], 
                 dof_per_node: int = 6):
        self.nodes = nodes
        self.members = members
        self.loads = loads
        self.dof_per_node = dof_per_node
        self.total_dof = len(nodes) * dof_per_node
        
        # Create node index map
        self.node_index = {node.id: i for i, node in enumerate(nodes)}
        
        # Identify fixed DOFs
        self.fixed_dofs = set()
        for node_idx, node in enumerate(nodes):
            base_dof = node_idx * dof_per_node
            restraints = node.restraints
            if restraints:
                if restraints.get('fx', False): self.fixed_dofs.add(base_dof)
                if restraints.get('fy', False): self.fixed_dofs.add(base_dof + 1)
                if restraints.get('fz', False) and dof_per_node >= 3: self.fixed_dofs.add(base_dof + 2)
                if restraints.get('mx', False) and dof_per_node >= 4: self.fixed_dofs.add(base_dof + 3)
                if restraints.get('my', False) and dof_per_node >= 5: self.fixed_dofs.add(base_dof + 4)
                if restraints.get('mz', False) and dof_per_node >= 6: self.fixed_dofs.add(base_dof + 5)
    
    def assemble(self) -> Tuple[sparse.csr_matrix, np.ndarray]:
        """Assemble global stiffness matrix and force vector using COO format."""
        row_indices = []
        col_indices = []
        values = []
        
        # Assemble element stiffness matrices
        for member in self.members:
            start_idx = self.node_index[member.start_node_id]
            end_idx = self.node_index[member.end_node_id]
            
            start_node = self.nodes[start_idx]
            end_node = self.nodes[end_idx]
            
            # Element geometry
            dx = end_node.x - start_node.x
            dy = end_node.y - start_node.y
            dz = end_node.z - start_node.z
            L = np.sqrt(dx**2 + dy**2 + dz**2)
            
            # Direction cosines
            cx, cy, cz = dx/L, dy/L, dz/L
            
            # Element stiffness
            ke = self._compute_element_stiffness(member.E, member.A, L, cx, cy, cz)
            
            # DOF mapping
            dof_map = []
            for i in range(self.dof_per_node):
                dof_map.append(start_idx * self.dof_per_node + i)
            for i in range(self.dof_per_node):
                dof_map.append(end_idx * self.dof_per_node + i)
            
            # Add to COO lists
            n = len(ke)
            for i in range(n):
                for j in range(n):
                    if abs(ke[i, j]) > 1e-15:
                        row_indices.append(dof_map[i])
                        col_indices.append(dof_map[j])
                        values.append(ke[i, j])
        
        # Create sparse matrix in COO, then convert to CSR
        K_coo = sparse.coo_matrix(
            (values, (row_indices, col_indices)),
            shape=(self.total_dof, self.total_dof)
        )
        K = K_coo.tocsr()
        
        # Assemble force vector
        F = np.zeros(self.total_dof)
        for load in self.loads:
            node_idx = self.node_index.get(load.node_id)
            if node_idx is None:
                continue
            
            base_dof = node_idx * self.dof_per_node
            F[base_dof] += load.fx
            F[base_dof + 1] += load.fy
            if self.dof_per_node >= 3: F[base_dof + 2] += load.fz
            if self.dof_per_node >= 4: F[base_dof + 3] += load.mx
            if self.dof_per_node >= 5: F[base_dof + 4] += load.my
            if self.dof_per_node >= 6: F[base_dof + 5] += load.mz
        
        return K, F
    
    def _compute_element_stiffness(self, E: float, A: float, L: float, 
                                   cx: float, cy: float, cz: float) -> np.ndarray:
        """Compute 3D truss element stiffness matrix."""
        k = E * A / L
        
        if self.dof_per_node == 2:
            # 2D truss
            c2, s2, cs = cx**2, cy**2, cx*cy
            return k * np.array([
                [c2,  cs, -c2, -cs],
                [cs,  s2, -cs, -s2],
                [-c2, -cs, c2,  cs],
                [-cs, -s2, cs,  s2]
            ])
        else:
            # 3D truss
            return k * np.array([
                [cx*cx,  cx*cy,  cx*cz, -cx*cx, -cx*cy, -cx*cz],
                [cy*cx,  cy*cy,  cy*cz, -cy*cx, -cy*cy, -cy*cz],
                [cz*cx,  cz*cy,  cz*cz, -cz*cx, -cz*cy, -cz*cz],
                [-cx*cx, -cx*cy, -cx*cz, cx*cx,  cx*cy,  cx*cz],
                [-cy*cx, -cy*cy, -cy*cz, cy*cx,  cy*cy,  cy*cz],
                [-cz*cx, -cz*cy, -cz*cz, cz*cx,  cz*cy,  cz*cz]
            ])
    
    def apply_boundary_conditions(self, K: sparse.csr_matrix, F: np.ndarray) -> Tuple[sparse.csr_matrix, np.ndarray]:
        """Apply boundary conditions using elimination method."""
        # Create lists of free and fixed DOFs
        all_dofs = set(range(self.total_dof))
        free_dofs = sorted(all_dofs - self.fixed_dofs)
        
        # Extract submatrix and subvector for free DOFs
        K_ff = K[np.ix_(free_dofs, free_dofs)]
        F_f = F[free_dofs]
        
        return K_ff, F_f, free_dofs
    
    def solve(self, method: str = 'spsolve') -> Dict:
        """Solve the structural system."""
        start_time = time.time()
        
        # Assemble
        assembly_start = time.time()
        K, F = self.assemble()
        assembly_time = time.time() - assembly_start
        
        # Apply boundary conditions
        K_ff, F_f, free_dofs = self.apply_boundary_conditions(K, F)
        
        # Solve
        solve_start = time.time()
        
        if method == 'cg':
            # Conjugate Gradient (iterative)
            u_f, info = spla.cg(K_ff, F_f, tol=1e-10, maxiter=self.total_dof * 2)
            if info != 0:
                raise ValueError(f"CG solver did not converge, info={info}")
        elif method == 'gmres':
            # GMRES (for non-symmetric)
            u_f, info = spla.gmres(K_ff, F_f, tol=1e-10)
            if info != 0:
                raise ValueError(f"GMRES solver did not converge, info={info}")
        else:
            # Direct solver (SuperLU)
            u_f = spla.spsolve(K_ff, F_f)
        
        solve_time = time.time() - solve_start
        
        # Reconstruct full displacement vector
        u = np.zeros(self.total_dof)
        for i, dof in enumerate(free_dofs):
            u[dof] = u_f[i]
        
        # Calculate reactions
        reactions = K.dot(u) - F
        
        # Prepare results
        displacement_map = {}
        for i, node in enumerate(self.nodes):
            base_dof = i * self.dof_per_node
            displacement_map[node.id] = u[base_dof:base_dof + self.dof_per_node].tolist()
        
        reaction_map = {}
        for i, node in enumerate(self.nodes):
            if node.restraints:
                base_dof = i * self.dof_per_node
                reaction_map[node.id] = reactions[base_dof:base_dof + self.dof_per_node].tolist()
        
        return {
            'success': True,
            'displacements': displacement_map,
            'reactions': reaction_map,
            'stats': {
                'totalDof': self.total_dof,
                'freeDof': len(free_dofs),
                'fixedDof': len(self.fixed_dofs),
                'nnz': K.nnz,
                'sparsity': 1 - (K.nnz / (self.total_dof ** 2)),
                'assemblyTimeMs': assembly_time * 1000,
                'solveTimeMs': solve_time * 1000,
                'totalTimeMs': (time.time() - start_time) * 1000,
                'method': method
            }
        }

# ============================================
# MAIN
# ============================================

def parse_input(data: Dict) -> Tuple[List[Node], List[Member], List[Load], int]:
    """Parse input JSON into model objects."""
    nodes = [
        Node(
            id=n['id'],
            x=n['x'],
            y=n['y'],
            z=n.get('z', 0),
            restraints=n.get('restraints')
        )
        for n in data.get('nodes', [])
    ]
    
    members = [
        Member(
            id=m['id'],
            start_node_id=m['startNodeId'],
            end_node_id=m['endNodeId'],
            E=m.get('E', 200e9),
            A=m.get('A', 0.01),
            I=m.get('I', 1e-4)
        )
        for m in data.get('members', [])
    ]
    
    loads = [
        Load(
            node_id=l['nodeId'],
            fx=l.get('fx', 0),
            fy=l.get('fy', 0),
            fz=l.get('fz', 0),
            mx=l.get('mx', 0),
            my=l.get('my', 0),
            mz=l.get('mz', 0)
        )
        for l in data.get('loads', [])
    ]
    
    dof_per_node = data.get('dofPerNode', 6)
    
    return nodes, members, loads, dof_per_node


def main():
    parser = argparse.ArgumentParser(description='Structural Solver')
    parser.add_argument('input_file', nargs='?', help='Input JSON file')
    parser.add_argument('--stdin', action='store_true', help='Read from stdin')
    parser.add_argument('--method', default='spsolve', 
                        choices=['spsolve', 'cg', 'gmres'],
                        help='Solver method')
    args = parser.parse_args()
    
    try:
        # Read input
        if args.stdin:
            input_data = json.load(sys.stdin)
        elif args.input_file:
            with open(args.input_file, 'r') as f:
                input_data = json.load(f)
        else:
            print(json.dumps({'success': False, 'error': 'No input provided'}))
            sys.exit(1)
        
        # Parse model
        nodes, members, loads, dof_per_node = parse_input(input_data)
        
        if len(nodes) == 0:
            print(json.dumps({'success': False, 'error': 'No nodes provided'}))
            sys.exit(1)
        
        # Solve
        assembler = SparseStiffnessAssembler(nodes, members, loads, dof_per_node)
        result = assembler.solve(method=args.method)
        
        # Output
        print(json.dumps(result))
        
    except Exception as e:
        print(json.dumps({
            'success': False,
            'error': str(e)
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
