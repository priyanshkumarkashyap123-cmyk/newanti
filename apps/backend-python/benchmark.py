"""
benchmark.py - Performance Benchmarking Tool

Measures performance of FEA operations:
- Matrix operations (assembly, solution)
- Stress calculations
- Time history integration
- Eigenvalue analysis
- Comparison of dense vs sparse methods

Usage:
    python benchmark.py --test all --size 1000
    python benchmark.py --test stress --members 100
    python benchmark.py --test modal --dof 500
"""

import numpy as np
import time
from typing import Dict, List, Tuple
import argparse
import multiprocessing


try:
    from analysis.performance_optimizer import (
        SparseMatrixHandler,
        ParallelProcessor,
        VectorizedOperations,
        get_performance_monitor
    )
    from analysis.stress_calculator import StressCalculator
    from analysis.time_history_analysis import TimeHistoryAnalyzer
    IMPORTS_OK = True
except ImportError as e:
    print(f"Warning: Could not import modules: {e}")
    IMPORTS_OK = False


class PerformanceBenchmark:
    """Benchmark suite for performance testing"""
    
    def __init__(self):
        self.results: Dict[str, Dict[str, float]] = {}
    
    def benchmark_matrix_solve(self, sizes: List[int] = [100, 500, 1000, 2000]):
        """
        Benchmark dense vs sparse matrix solve
        
        Tests:
        - Dense numpy.linalg.solve
        - Sparse scipy.sparse.linalg.spsolve
        - Iterative sparse solver
        """
        print("\n" + "="*70)
        print("BENCHMARK: Matrix Solve (Ax = b)")
        print("="*70)
        
        for n in sizes:
            print(f"\nMatrix size: {n}x{n}")
            
            # Create sparse banded matrix (typical FEA structure)
            K = np.zeros((n, n))
            for i in range(n):
                K[i, i] = 4.0
                if i > 0:
                    K[i, i-1] = -1.0
                if i < n-1:
                    K[i, i+1] = -1.0
            
            b = np.random.rand(n)
            
            # Dense solve
            start = time.time()
            x_dense = np.linalg.solve(K, b)
            time_dense = time.time() - start
            print(f"  Dense solve:     {time_dense:8.4f} s")
            
            if SCIPY_AVAILABLE:
                # Sparse solve (direct)
                start = time.time()
                x_sparse = SparseMatrixHandler.sparse_solve(K, b, method='direct')
                time_sparse_direct = time.time() - start
                print(f"  Sparse direct:   {time_sparse_direct:8.4f} s  (speedup: {time_dense/time_sparse_direct:.2f}x)")
                
                # Sparse solve (iterative)
                start = time.time()
                x_sparse_iter = SparseMatrixHandler.sparse_solve(K, b, method='iterative')
                time_sparse_iter = time.time() - start
                print(f"  Sparse iterative:{time_sparse_iter:8.4f} s  (speedup: {time_dense/time_sparse_iter:.2f}x)")
                
                # Check accuracy
                error = np.linalg.norm(x_dense - x_sparse) / np.linalg.norm(x_dense)
                print(f"  Accuracy error:  {error:.2e}")
                
                self.results[f'matrix_solve_{n}'] = {
                    'dense': time_dense,
                    'sparse_direct': time_sparse_direct,
                    'sparse_iter': time_sparse_iter,
                    'speedup': time_dense / time_sparse_direct
                }
            else:
                self.results[f'matrix_solve_{n}'] = {
                    'dense': time_dense
                }
    
    def benchmark_eigenvalue(self, sizes: List[int] = [100, 500, 1000], num_modes: int = 10):
        """
        Benchmark eigenvalue computation
        
        Tests modal analysis performance
        """
        print("\n" + "="*70)
        print(f"BENCHMARK: Eigenvalue Problem (first {num_modes} modes)")
        print("="*70)
        
        for n in sizes:
            print(f"\nMatrix size: {n}x{n}")
            
            # Create stiffness and mass matrices
            K = np.zeros((n, n))
            M = np.eye(n)
            
            for i in range(n):
                K[i, i] = 4.0
                if i > 0:
                    K[i, i-1] = -1.0
                if i < n-1:
                    K[i, i+1] = -1.0
            
            # Dense eigenvalue
            start = time.time()
            eigenvalues_dense, eigenvectors_dense = np.linalg.eigh(K, M)
            eigenvalues_dense = eigenvalues_dense[:num_modes]
            time_dense = time.time() - start
            print(f"  Dense eigh:      {time_dense:8.4f} s (computes ALL {n} modes)")
            
            if SCIPY_AVAILABLE:
                # Sparse eigenvalue
                start = time.time()
                eigenvalues_sparse, eigenvectors_sparse = SparseMatrixHandler.sparse_eigenvalues(
                    K, M, num_modes
                )
                time_sparse = time.time() - start
                print(f"  Sparse eigsh:    {time_sparse:8.4f} s (computes {num_modes} modes)")
                print(f"  Speedup:         {time_dense/time_sparse:.2f}x")
                
                # Check accuracy
                error = np.abs(eigenvalues_dense - eigenvalues_sparse).max()
                print(f"  Max eigen error: {error:.2e}")
                
                self.results[f'eigenvalue_{n}'] = {
                    'dense': time_dense,
                    'sparse': time_sparse,
                    'speedup': time_dense / time_sparse
                }
            else:
                self.results[f'eigenvalue_{n}'] = {
                    'dense': time_dense
                }
    
    def benchmark_stress_calculation(self, num_members: List[int] = [10, 50, 100, 200]):
        """
        Benchmark stress calculation with/without parallelization
        """
        print("\n" + "="*70)
        print("BENCHMARK: Stress Calculation (Sequential vs Parallel)")
        print("="*70)
        
        for n in num_members:
            print(f"\nNumber of members: {n}")
            
            # Create dummy member data
            member_data_list = []
            for i in range(n):
                member_data_list.append({
                    'member_id': f'M{i}',
                    'forces': {
                        'axial': [50.0 + i],
                        'moment_x': [25.0 + i * 0.5],
                        'shear_y': [12.5 + i * 0.25]
                    },
                    'section': {
                        'area': 0.01,
                        'Ixx': 1e-4,
                        'depth': 0.3,
                        'width': 0.2
                    },
                    'length': 5.0,
                    'fy': 250.0,
                    'safety_factor': 1.67,
                    'num_points': 20
                })
            
            # Sequential calculation
            start = time.time()
            calculator = StressCalculator()
            results_seq = []
            for member_data in member_data_list:
                stress_points = calculator.calculate_member_stresses(
                    member_id=member_data['member_id'],
                    member_forces=member_data['forces'],
                    section_properties=member_data['section'],
                    member_length=member_data['length'],
                    fy=member_data.get('fy', 250.0),
                    safety_factor=member_data.get('safety_factor', 1.67),
                    num_points=member_data.get('num_points', 20)
                )
                results_seq.append(stress_points)
            time_sequential = time.time() - start
            print(f"  Sequential:      {time_sequential:8.4f} s")
            
            # Parallel calculation
            start = time.time()
            results_parallel = ParallelProcessor.parallel_stress_calculation(member_data_list)
            time_parallel = time.time() - start
            print(f"  Parallel:        {time_parallel:8.4f} s")
            print(f"  Speedup:         {time_sequential/time_parallel:.2f}x")
            
            self.results[f'stress_{n}'] = {
                'sequential': time_sequential,
                'parallel': time_parallel,
                'speedup': time_sequential / time_parallel
            }
    
    def benchmark_vectorized_operations(self, array_size: int = 100000):
        """
        Benchmark vectorized vs loop-based operations
        """
        print("\n" + "="*70)
        print(f"BENCHMARK: Vectorized Operations (array size: {array_size})")
        print("="*70)
        
        # Generate random stress components
        sigma_x = np.random.rand(array_size) * 100
        sigma_y = np.random.rand(array_size) * 100
        sigma_z = np.random.rand(array_size) * 100
        tau_xy = np.random.rand(array_size) * 50
        tau_yz = np.random.rand(array_size) * 50
        tau_zx = np.random.rand(array_size) * 50
        
        # Loop-based Von Mises
        start = time.time()
        von_mises_loop = np.zeros(array_size)
        for i in range(array_size):
            diff_xy = sigma_x[i] - sigma_y[i]
            diff_yz = sigma_y[i] - sigma_z[i]
            diff_zx = sigma_z[i] - sigma_x[i]
            sq_diff = diff_xy**2 + diff_yz**2 + diff_zx**2
            sq_shear = tau_xy[i]**2 + tau_yz[i]**2 + tau_zx[i]**2
            von_mises_loop[i] = np.sqrt(0.5 * sq_diff + 3.0 * sq_shear)
        time_loop = time.time() - start
        print(f"\n  Von Mises (loop):      {time_loop:8.4f} s")
        
        # Vectorized Von Mises
        start = time.time()
        von_mises_vec = VectorizedOperations.vectorized_von_mises(
            sigma_x, sigma_y, sigma_z, tau_xy, tau_yz, tau_zx
        )
        time_vectorized = time.time() - start
        print(f"  Von Mises (vectorized):{time_vectorized:8.4f} s")
        print(f"  Speedup:               {time_loop/time_vectorized:.2f}x")
        
        # Check accuracy
        error = np.abs(von_mises_loop - von_mises_vec).max()
        print(f"  Max error:             {error:.2e}")
        
        self.results['vectorized'] = {
            'loop': time_loop,
            'vectorized': time_vectorized,
            'speedup': time_loop / time_vectorized
        }
    
    def print_summary(self):
        """Print benchmark summary"""
        print("\n" + "="*70)
        print("BENCHMARK SUMMARY")
        print("="*70)
        
        print("\nSpeedup Summary:")
        for test_name, metrics in self.results.items():
            if 'speedup' in metrics:
                print(f"  {test_name:30s}: {metrics['speedup']:6.2f}x faster")
        
        print("\n" + "="*70 + "\n")


# Import scipy check
try:
    from scipy import sparse
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False


def main():
    """Run benchmarks"""
    parser = argparse.ArgumentParser(description='Performance Benchmarking Tool')
    parser.add_argument('--test', type=str, default='all',
                       choices=['all', 'matrix', 'eigen', 'stress', 'vectorized'],
                       help='Test to run')
    parser.add_argument('--size', type=int, default=None,
                       help='Problem size (matrix dimension or number of members)')
    
    args = parser.parse_args()
    
    if not IMPORTS_OK:
        print("ERROR: Required modules not available. Install dependencies:")
        print("  pip install numpy scipy")
        return
    
    benchmark = PerformanceBenchmark()
    
    print("\n" + "="*70)
    print("BeamLab Performance Benchmark Suite")
    print("="*70)
    print(f"NumPy available: Yes")
    print(f"SciPy available: {SCIPY_AVAILABLE}")
    print(f"CPU cores: {multiprocessing.cpu_count()}")
    print("="*70)
    
    if args.test in ['all', 'matrix']:
        sizes = [args.size] if args.size else [100, 500, 1000]
        benchmark.benchmark_matrix_solve(sizes)
    
    if args.test in ['all', 'eigen']:
        sizes = [args.size] if args.size else [100, 500, 1000]
        benchmark.benchmark_eigenvalue(sizes, num_modes=10)
    
    if args.test in ['all', 'stress']:
        num_members = [args.size] if args.size else [10, 50, 100]
        benchmark.benchmark_stress_calculation(num_members)
    
    if args.test in ['all', 'vectorized']:
        size = args.size if args.size else 100000
        benchmark.benchmark_vectorized_operations(size)
    
    benchmark.print_summary()


if __name__ == '__main__':
    main()
