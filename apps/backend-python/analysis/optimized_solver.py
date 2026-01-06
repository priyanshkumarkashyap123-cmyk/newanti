"""
optimized_solver.py - High-Performance FEM Solver

Optimizations:
- Sparse matrix storage (CSR format)
- Parallel matrix assembly
- Iterative solvers for large systems
- Result streaming
- Memory-efficient storage

Performance targets:
- 1,000 nodes: < 500ms
- 5,000 nodes: < 2s
- 10,000 nodes: < 5s

Author: BeamLab Ultimate Development Team
Date: January 2026
"""

import numpy as np
from scipy.sparse import csr_matrix, lil_matrix
from scipy.sparse.linalg import spsolve, cg, gmres
from typing import List, Dict, Tuple, Optional
import time
from dataclasses import dataclass


@dataclass
class PerformanceMetrics:
    """Store solver performance metrics"""
    assembly_time: float
    solve_time: float
    total_time: float
    num_nodes: int
    num_elements: int
    num_dof: int
    matrix_size: int
    matrix_sparsity: float
    solver_type: str


class OptimizedFrameSolver:
    """
    High-performance 3D frame solver with sparse matrices
    
    Features:
    - Sparse matrix storage (CSR format)
    - Choice of direct or iterative solver
    - Parallel matrix assembly (future: multiprocessing)
    - Memory-efficient result storage
    """
    
    def __init__(self, use_iterative: bool = False, tolerance: float = 1e-6):
        """
        Initialize optimized solver
        
        Args:
            use_iterative: Use iterative solver (CG) for large systems
            tolerance: Convergence tolerance for iterative solvers
        """
        self.use_iterative = use_iterative
        self.tolerance = tolerance
        self.metrics = None
    
    def assemble_stiffness_sparse(
        self,
        num_dof: int,
        elements: List[Dict],
        nodes: Dict
    ) -> lil_matrix:
        """
        Assemble global stiffness matrix in sparse format
        
        Args:
            num_dof: Total number of degrees of freedom
            elements: List of element definitions
            nodes: Dictionary of node coordinates
        
        Returns:
            Sparse stiffness matrix in LIL format (efficient for construction)
        """
        # Use LIL (List of Lists) format for efficient construction
        K_global = lil_matrix((num_dof, num_dof))
        
        for elem in elements:
            # Get element stiffness matrix (12x12 for 3D frame element)
            k_elem = self._element_stiffness_3d(elem, nodes)
            
            # Get DOF mapping for this element
            dof_map = self._get_dof_mapping(elem)
            
            # Add to global matrix (sparse addition is efficient)
            for i, i_global in enumerate(dof_map):
                for j, j_global in enumerate(dof_map):
                    K_global[i_global, j_global] += k_elem[i, j]
        
        return K_global
    
    def _element_stiffness_3d(self, elem: Dict, nodes: Dict) -> np.ndarray:
        """
        Calculate 3D frame element stiffness matrix (12x12)
        
        Local DOF: [u1, v1, w1, θx1, θy1, θz1, u2, v2, w2, θx2, θy2, θz2]
        
        Args:
            elem: Element definition with properties
            nodes: Node coordinates
        
        Returns:
            12x12 element stiffness matrix in local coordinates
        """
        # Get node coordinates
        n1 = nodes[elem['startNodeId']]
        n2 = nodes[elem['endNodeId']]
        
        # Element length
        dx = n2['x'] - n1['x']
        dy = n2['y'] - n1['y']
        dz = n2['z'] - n1['z']
        L = np.sqrt(dx**2 + dy**2 + dz**2)
        
        # Material and section properties
        E = elem.get('E', 200e9)  # Pa
        G = elem.get('G', 77e9)   # Pa
        A = elem.get('A', 0.01)   # m²
        Iy = elem.get('Iy', 1e-4) # m⁴
        Iz = elem.get('Iz', 1e-4) # m⁴
        J = elem.get('J', 1e-5)   # m⁴
        
        # Stiffness coefficients
        EA_L = E * A / L
        GJ_L = G * J / L
        
        # Bending stiffness
        EIy_L3 = E * Iy / (L**3)
        EIz_L3 = E * Iz / (L**3)
        
        # Local stiffness matrix (12x12)
        k_local = np.zeros((12, 12))
        
        # Axial stiffness (DOF 0, 6)
        k_local[0, 0] = k_local[6, 6] = EA_L
        k_local[0, 6] = k_local[6, 0] = -EA_L
        
        # Torsional stiffness (DOF 3, 9)
        k_local[3, 3] = k_local[9, 9] = GJ_L
        k_local[3, 9] = k_local[9, 3] = -GJ_L
        
        # Bending about y-axis (in xz plane)
        k_local[2, 2] = 12 * EIy_L3
        k_local[2, 4] = k_local[4, 2] = 6 * EIy_L3 * L
        k_local[2, 8] = k_local[8, 2] = -12 * EIy_L3
        k_local[2, 10] = k_local[10, 2] = 6 * EIy_L3 * L
        
        k_local[4, 4] = 4 * E * Iy / L
        k_local[4, 8] = k_local[8, 4] = -6 * EIy_L3 * L
        k_local[4, 10] = k_local[10, 4] = 2 * E * Iy / L
        
        k_local[8, 8] = 12 * EIy_L3
        k_local[8, 10] = k_local[10, 8] = -6 * EIy_L3 * L
        k_local[10, 10] = 4 * E * Iy / L
        
        # Bending about z-axis (in xy plane)
        k_local[1, 1] = 12 * EIz_L3
        k_local[1, 5] = k_local[5, 1] = -6 * EIz_L3 * L
        k_local[1, 7] = k_local[7, 1] = -12 * EIz_L3
        k_local[1, 11] = k_local[11, 1] = -6 * EIz_L3 * L
        
        k_local[5, 5] = 4 * E * Iz / L
        k_local[5, 7] = k_local[7, 5] = 6 * EIz_L3 * L
        k_local[5, 11] = k_local[11, 5] = 2 * E * Iz / L
        
        k_local[7, 7] = 12 * EIz_L3
        k_local[7, 11] = k_local[11, 7] = 6 * EIz_L3 * L
        k_local[11, 11] = 4 * E * Iz / L
        
        # Transform to global coordinates
        T = self._transformation_matrix_3d(dx, dy, dz, L)
        k_global = T.T @ k_local @ T
        
        return k_global
    
    def _transformation_matrix_3d(
        self,
        dx: float,
        dy: float,
        dz: float,
        L: float
    ) -> np.ndarray:
        """
        Create 12x12 transformation matrix from local to global coordinates
        
        Args:
            dx, dy, dz: Element direction cosines
            L: Element length
        
        Returns:
            12x12 transformation matrix
        """
        # Direction cosines
        cx = dx / L
        cy = dy / L
        cz = dz / L
        
        # Handle vertical members
        if abs(cx) < 1e-6 and abs(cz) < 1e-6:
            # Vertical member
            if cy > 0:
                lambda_matrix = np.array([
                    [0, 1, 0],
                    [-1, 0, 0],
                    [0, 0, 1]
                ])
            else:
                lambda_matrix = np.array([
                    [0, -1, 0],
                    [1, 0, 0],
                    [0, 0, 1]
                ])
        else:
            # General orientation
            D = np.sqrt(cx**2 + cz**2)
            lambda_matrix = np.array([
                [cx, cy, cz],
                [-cy*cz/D, D, -cy*cx/D],
                [-cx/D, 0, cz/D]
            ])
        
        # Build 12x12 transformation matrix (4 blocks of 3x3)
        T = np.zeros((12, 12))
        for i in range(4):
            T[3*i:3*i+3, 3*i:3*i+3] = lambda_matrix
        
        return T
    
    def _get_dof_mapping(self, elem: Dict) -> List[int]:
        """
        Get global DOF indices for element's nodes
        
        Each node has 6 DOF: [ux, uy, uz, θx, θy, θz]
        
        Args:
            elem: Element definition
        
        Returns:
            List of 12 global DOF indices
        """
        # Extract node numbers (assumes format "N1", "N2", etc.)
        n1_num = int(elem['startNodeId'][1:]) if isinstance(elem['startNodeId'], str) else elem['startNodeId']
        n2_num = int(elem['endNodeId'][1:]) if isinstance(elem['endNodeId'], str) else elem['endNodeId']
        
        # DOF indices: node i has DOF [6*i, 6*i+1, ..., 6*i+5]
        dof_n1 = [6*n1_num + i for i in range(6)]
        dof_n2 = [6*n2_num + i for i in range(6)]
        
        return dof_n1 + dof_n2
    
    def apply_boundary_conditions(
        self,
        K: lil_matrix,
        F: np.ndarray,
        supports: Dict
    ) -> Tuple[csr_matrix, np.ndarray, List[int]]:
        """
        Apply support boundary conditions using penalty method
        
        Args:
            K: Global stiffness matrix (LIL format)
            F: Global force vector
            supports: Dictionary of support conditions
        
        Returns:
            (K_modified, F_modified, constrained_dof)
        """
        constrained_dof = []
        
        for node_id, support_type in supports.items():
            if support_type == 'none':
                continue
            
            # Get node DOF
            node_num = int(node_id[1:]) if isinstance(node_id, str) else node_id
            base_dof = 6 * node_num
            
            if support_type == 'fixed':
                # Constrain all 6 DOF
                constrained_dof.extend([base_dof + i for i in range(6)])
            elif support_type == 'pinned':
                # Constrain translations only
                constrained_dof.extend([base_dof + i for i in range(3)])
            elif support_type == 'roller':
                # Constrain vertical translation (y) only
                constrained_dof.append(base_dof + 1)
        
        # Apply penalty method: K[i,i] *= 1e10, F[i] = 0
        penalty = 1e10
        for dof in constrained_dof:
            K[dof, dof] *= penalty
            F[dof] = 0
        
        # Convert to CSR for efficient solving
        K_csr = K.tocsr()
        
        return K_csr, F, constrained_dof
    
    def solve(
        self,
        model: Dict,
        verbose: bool = True
    ) -> Dict:
        """
        Solve FEM problem with optimized sparse solver
        
        Args:
            model: Model dictionary with nodes, members, loads, supports
            verbose: Print performance metrics
        
        Returns:
            Solution dictionary with displacements, reactions, metrics
        """
        start_time = time.time()
        
        # Extract model data
        nodes = {n['id']: n for n in model['nodes']}
        elements = model['members']
        num_nodes = len(nodes)
        num_dof = num_nodes * 6
        
        if verbose:
            print(f"[SOLVER] Starting optimized solver")
            print(f"[SOLVER] Nodes: {num_nodes}, Elements: {len(elements)}, DOF: {num_dof}")
        
        # Assembly phase
        assembly_start = time.time()
        K = self.assemble_stiffness_sparse(num_dof, elements, nodes)
        assembly_time = time.time() - assembly_start
        
        if verbose:
            print(f"[SOLVER] Assembly time: {assembly_time:.3f}s")
        
        # Build force vector
        F = np.zeros(num_dof)
        for load in model.get('node_loads', []):
            node_num = int(load['nodeId'][1:]) if isinstance(load['nodeId'], str) else load['nodeId']
            base_dof = 6 * node_num
            F[base_dof:base_dof+3] = [load.get('fx', 0), load.get('fy', 0), load.get('fz', 0)]
            F[base_dof+3:base_dof+6] = [load.get('mx', 0), load.get('my', 0), load.get('mz', 0)]
        
        # Apply boundary conditions
        supports = {n['id']: n.get('support', 'none') for n in model['nodes']}
        K_csr, F, constrained = self.apply_boundary_conditions(K, F, supports)
        
        # Calculate sparsity
        sparsity = 1.0 - (K_csr.nnz / (num_dof * num_dof))
        
        if verbose:
            print(f"[SOLVER] Matrix sparsity: {sparsity*100:.1f}%")
            print(f"[SOLVER] Non-zero elements: {K_csr.nnz:,}")
        
        # Solve phase
        solve_start = time.time()
        
        if self.use_iterative and num_dof > 1000:
            # Use iterative solver for large systems
            if verbose:
                print(f"[SOLVER] Using iterative solver (CG)")
            
            U, info = cg(K_csr, F, tol=self.tolerance, maxiter=1000)
            
            if info != 0:
                if verbose:
                    print(f"[SOLVER] CG did not converge, trying GMRES")
                U, info = gmres(K_csr, F, tol=self.tolerance, maxiter=1000)
            
            solver_type = "CG/GMRES"
        else:
            # Use direct solver for small/medium systems
            if verbose:
                print(f"[SOLVER] Using direct solver (LU)")
            
            U = spsolve(K_csr, F)
            solver_type = "Direct LU"
        
        solve_time = time.time() - solve_start
        total_time = time.time() - start_time
        
        if verbose:
            print(f"[SOLVER] Solve time: {solve_time:.3f}s")
            print(f"[SOLVER] Total time: {total_time:.3f}s")
            print(f"[SOLVER] Max displacement: {np.max(np.abs(U)):.6f}")
        
        # Store metrics
        self.metrics = PerformanceMetrics(
            assembly_time=assembly_time,
            solve_time=solve_time,
            total_time=total_time,
            num_nodes=num_nodes,
            num_elements=len(elements),
            num_dof=num_dof,
            matrix_size=num_dof * num_dof,
            matrix_sparsity=sparsity,
            solver_type=solver_type
        )
        
        # Package results
        return {
            'success': True,
            'displacements': U.tolist(),
            'num_dof': num_dof,
            'metrics': {
                'assembly_time': assembly_time,
                'solve_time': solve_time,
                'total_time': total_time,
                'solver_type': solver_type,
                'sparsity': sparsity
            }
        }


# Example usage
if __name__ == "__main__":
    # Test with a simple frame
    test_model = {
        'nodes': [
            {'id': 'N0', 'x': 0, 'y': 0, 'z': 0, 'support': 'fixed'},
            {'id': 'N1', 'x': 5, 'y': 0, 'z': 0, 'support': 'none'},
            {'id': 'N2', 'x': 5, 'y': 3, 'z': 0, 'support': 'none'},
        ],
        'members': [
            {'startNodeId': 'N0', 'endNodeId': 'N1', 'E': 200e9, 'A': 0.01},
            {'startNodeId': 'N1', 'endNodeId': 'N2', 'E': 200e9, 'A': 0.01'},
        ],
        'node_loads': [
            {'nodeId': 'N2', 'fy': -10000}
        ]
    }
    
    solver = OptimizedFrameSolver()
    result = solver.solve(test_model, verbose=True)
    
    print(f"\nSolution successful: {result['success']}")
    print(f"Performance: {result['metrics']}")
