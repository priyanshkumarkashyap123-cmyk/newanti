"""
performance_optimizer.py - Performance Optimization Module

Provides optimized computation strategies for large-scale analysis:
- Sparse matrix operations for memory efficiency
- Parallel processing for multi-core utilization
- Vectorized NumPy operations
- Result caching and memoization
- GPU acceleration (when available)

Author: BeamLab Team
Date: January 2026
"""

import numpy as np
from typing import Dict, List, Tuple, Any, Optional, Callable
from functools import lru_cache
import hashlib
import pickle
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
import multiprocessing

# Try to import scipy for sparse matrices
try:
    from scipy import sparse
    from scipy.sparse import linalg as sparse_linalg
    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    print("Warning: scipy not available. Sparse matrix optimization disabled.")


class SparseMatrixHandler:
    """Handle sparse matrix operations for memory efficiency"""
    
    @staticmethod
    def is_sparse_beneficial(matrix: np.ndarray, sparsity_threshold: float = 0.7) -> bool:
        """
        Check if converting to sparse format would be beneficial
        
        Args:
            matrix: Dense numpy array
            sparsity_threshold: Minimum fraction of zeros to convert (0.7 = 70% zeros)
            
        Returns:
            True if sparse conversion recommended
        """
        if not SCIPY_AVAILABLE:
            return False
            
        if matrix.size == 0:
            return False
            
        zero_count = np.count_nonzero(matrix == 0)
        sparsity = zero_count / matrix.size
        
        return sparsity >= sparsity_threshold
    
    @staticmethod
    def to_sparse(matrix: np.ndarray, format: str = 'csr') -> Any:
        """
        Convert dense matrix to sparse format
        
        Args:
            matrix: Dense numpy array
            format: Sparse format ('csr', 'csc', 'coo')
                - 'csr': Compressed Sparse Row (good for row operations)
                - 'csc': Compressed Sparse Column (good for column operations)
                - 'coo': Coordinate format (good for construction)
                
        Returns:
            Sparse matrix or original if scipy not available
        """
        if not SCIPY_AVAILABLE:
            return matrix
            
        if format == 'csr':
            return sparse.csr_matrix(matrix)
        elif format == 'csc':
            return sparse.csc_matrix(matrix)
        elif format == 'coo':
            return sparse.coo_matrix(matrix)
        else:
            return sparse.csr_matrix(matrix)
    
    @staticmethod
    def to_dense(sparse_matrix: Any) -> np.ndarray:
        """Convert sparse matrix back to dense"""
        if not SCIPY_AVAILABLE or isinstance(sparse_matrix, np.ndarray):
            return sparse_matrix
        return sparse_matrix.toarray()
    
    @staticmethod
    def sparse_solve(A: Any, b: np.ndarray, method: str = 'direct') -> np.ndarray:
        """
        Solve sparse linear system Ax = b
        
        Args:
            A: Sparse or dense matrix
            b: Right-hand side vector
            method: 'direct' or 'iterative'
            
        Returns:
            Solution vector x
        """
        if not SCIPY_AVAILABLE:
            # Fallback to numpy
            return np.linalg.solve(A, b)
        
        # Convert to sparse if not already
        if isinstance(A, np.ndarray):
            if SparseMatrixHandler.is_sparse_beneficial(A):
                A = sparse.csr_matrix(A)
            else:
                return np.linalg.solve(A, b)
        
        if method == 'direct':
            # Direct solver (LU decomposition)
            return sparse_linalg.spsolve(A, b)
        else:
            # Iterative solver (Conjugate Gradient for symmetric positive definite)
            x, info = sparse_linalg.cg(A, b, tol=1e-6)
            if info != 0:
                print(f"Warning: Iterative solver did not converge (info={info})")
            return x
    
    @staticmethod
    def sparse_eigenvalues(K: Any, M: Any, num_modes: int = 10) -> Tuple[np.ndarray, np.ndarray]:
        """
        Solve generalized eigenvalue problem: K φ = λ M φ
        Optimized for sparse matrices
        
        Args:
            K: Stiffness matrix (sparse or dense)
            M: Mass matrix (sparse or dense)
            num_modes: Number of eigenvalues to compute
            
        Returns:
            (eigenvalues, eigenvectors)
        """
        if not SCIPY_AVAILABLE:
            # Fallback to numpy (computes ALL eigenvalues - slow for large matrices)
            return np.linalg.eigh(K, M)
        
        # Convert to sparse if beneficial
        if isinstance(K, np.ndarray) and SparseMatrixHandler.is_sparse_beneficial(K):
            K = sparse.csr_matrix(K)
        if isinstance(M, np.ndarray) and SparseMatrixHandler.is_sparse_beneficial(M):
            M = sparse.csr_matrix(M)
        
        # Use sparse eigenvalue solver (computes only requested modes)
        n = K.shape[0]
        k = min(num_modes, n - 2)  # scipy.sparse.linalg.eigsh limitation
        
        try:
            eigenvalues, eigenvectors = sparse_linalg.eigsh(K, k=k, M=M, which='SM')
            return eigenvalues, eigenvectors
        except Exception as e:
            print(f"Sparse eigenvalue solver failed: {e}. Falling back to dense.")
            # Fallback to dense
            K_dense = K.toarray() if sparse.issparse(K) else K
            M_dense = M.toarray() if sparse.issparse(M) else M
            eigenvalues, eigenvectors = np.linalg.eigh(K_dense, M_dense)
            return eigenvalues[:k], eigenvectors[:, :k]


class ParallelProcessor:
    """Parallel processing for multi-core utilization"""
    
    def __init__(self, max_workers: Optional[int] = None):
        """
        Initialize parallel processor
        
        Args:
            max_workers: Maximum number of worker processes
                        None = number of CPU cores
        """
        self.max_workers = max_workers or multiprocessing.cpu_count()
    
    def map_parallel(self, func: Callable, items: List[Any], use_threads: bool = False) -> List[Any]:
        """
        Apply function to items in parallel
        
        Args:
            func: Function to apply
            items: List of items to process
            use_threads: Use threads instead of processes (for I/O bound tasks)
            
        Returns:
            List of results
        """
        if len(items) == 0:
            return []
        
        # For small workloads, parallel overhead not worth it
        if len(items) < 4:
            return [func(item) for item in items]
        
        executor_class = ThreadPoolExecutor if use_threads else ProcessPoolExecutor
        
        with executor_class(max_workers=self.max_workers) as executor:
            results = list(executor.map(func, items))
        
        return results
    
    @staticmethod
    def parallel_stress_calculation(member_data_list: List[Dict]) -> List[Dict]:
        """
        Calculate stresses for multiple members in parallel
        
        Args:
            member_data_list: List of member data dictionaries
            
        Returns:
            List of stress results
        """
        # Import here to avoid circular dependency
        from .stress_calculator import StressCalculator
        
        def calculate_single_member(member_data: Dict) -> Dict:
            """Calculate stress for a single member"""
            calculator = StressCalculator()
            stress_points = calculator.calculate_member_stresses(
                member_id=member_data['member_id'],
                member_forces=member_data['forces'],
                section_properties=member_data['section'],
                member_length=member_data['length'],
                fy=member_data.get('fy', 250.0),
                safety_factor=member_data.get('safety_factor', 1.67),
                num_points=member_data.get('num_points', 20)
            )
            
            return {
                'member_id': member_data['member_id'],
                'stress_points': [vars(sp) for sp in stress_points]
            }
        
        processor = ParallelProcessor()
        return processor.map_parallel(calculate_single_member, member_data_list)


class ResultCache:
    """Cache expensive computation results"""
    
    def __init__(self, max_size: int = 128):
        """
        Initialize result cache
        
        Args:
            max_size: Maximum number of cached results (LRU eviction)
        """
        self.max_size = max_size
        self._cache: Dict[str, Any] = {}
    
    @staticmethod
    def _hash_inputs(*args, **kwargs) -> str:
        """Create hash from function inputs"""
        # Create deterministic string representation
        inputs_str = pickle.dumps((args, sorted(kwargs.items())))
        return hashlib.md5(inputs_str).hexdigest()
    
    def get(self, key: str) -> Optional[Any]:
        """Get cached result"""
        return self._cache.get(key)
    
    def set(self, key: str, value: Any) -> None:
        """Set cached result"""
        if len(self._cache) >= self.max_size:
            # Remove oldest entry (simple FIFO, not true LRU)
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]
        self._cache[key] = value
    
    def cached_modal_analysis(self, K: np.ndarray, M: np.ndarray, num_modes: int) -> Tuple[np.ndarray, np.ndarray]:
        """
        Cached modal analysis (eigenvalue computation)
        
        Args:
            K: Stiffness matrix
            M: Mass matrix
            num_modes: Number of modes
            
        Returns:
            (eigenvalues, eigenvectors) from cache or fresh computation
        """
        # Create cache key from matrix properties
        K_hash = hashlib.md5(K.tobytes()).hexdigest()
        M_hash = hashlib.md5(M.tobytes()).hexdigest()
        cache_key = f"modal_{K_hash}_{M_hash}_{num_modes}"
        
        # Check cache
        cached = self.get(cache_key)
        if cached is not None:
            print(f"Modal analysis: Using cached results")
            return cached
        
        # Compute
        print(f"Modal analysis: Computing (not cached)")
        eigenvalues, eigenvectors = SparseMatrixHandler.sparse_eigenvalues(K, M, num_modes)
        
        # Cache result
        self.set(cache_key, (eigenvalues, eigenvectors))
        
        return eigenvalues, eigenvectors


class VectorizedOperations:
    """Vectorized NumPy operations for performance"""
    
    @staticmethod
    def vectorized_von_mises(sigma_x: np.ndarray, sigma_y: np.ndarray, sigma_z: np.ndarray,
                            tau_xy: np.ndarray, tau_yz: np.ndarray, tau_zx: np.ndarray) -> np.ndarray:
        """
        Vectorized Von Mises stress calculation
        
        σ_vm = √(0.5 * [(σx-σy)² + (σy-σz)² + (σz-σx)² + 6(τxy² + τyz² + τzx²)])
        
        Args:
            All stress components as numpy arrays
            
        Returns:
            Von Mises stress array
        """
        # Compute all differences at once (vectorized)
        diff_xy = sigma_x - sigma_y
        diff_yz = sigma_y - sigma_z
        diff_zx = sigma_z - sigma_x
        
        # Square terms
        sq_diff = diff_xy**2 + diff_yz**2 + diff_zx**2
        sq_shear = tau_xy**2 + tau_yz**2 + tau_zx**2
        
        # Von Mises formula
        von_mises = np.sqrt(0.5 * sq_diff + 3.0 * sq_shear)
        
        return von_mises
    
    @staticmethod
    def vectorized_principal_stresses_2d(sigma_x: np.ndarray, sigma_y: np.ndarray, 
                                        tau_xy: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """
        Vectorized principal stress calculation (2D plane stress)
        
        Args:
            sigma_x, sigma_y: Normal stresses
            tau_xy: Shear stress
            
        Returns:
            (sigma_1, sigma_3) - max and min principal stresses
        """
        # Average normal stress
        sigma_avg = (sigma_x + sigma_y) / 2.0
        
        # Radius of Mohr's circle
        R = np.sqrt(((sigma_x - sigma_y) / 2.0)**2 + tau_xy**2)
        
        # Principal stresses
        sigma_1 = sigma_avg + R  # Maximum
        sigma_3 = sigma_avg - R  # Minimum
        
        return sigma_1, sigma_3
    
    @staticmethod
    def vectorized_newmark_step(u: np.ndarray, v: np.ndarray, a: np.ndarray,
                               K_eff: np.ndarray, f_ext: float, dt: float,
                               beta: float = 0.25, gamma: float = 0.5) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Vectorized Newmark-beta time integration step
        
        Args:
            u, v, a: Displacement, velocity, acceleration at time t
            K_eff: Effective stiffness matrix
            f_ext: External force at time t+dt
            dt: Time step
            beta, gamma: Newmark parameters
            
        Returns:
            (u_new, v_new, a_new) at time t+dt
        """
        # Predict displacement
        u_pred = u + dt * v + (0.5 - beta) * dt**2 * a
        
        # Predict velocity  
        v_pred = v + (1.0 - gamma) * dt * a
        
        # Effective force
        f_eff = f_ext  # Simplified - actual implementation needs M and C terms
        
        # Solve for acceleration
        a_new = SparseMatrixHandler.sparse_solve(K_eff, f_eff)
        
        # Correct displacement and velocity
        u_new = u_pred + beta * dt**2 * a_new
        v_new = v_pred + gamma * dt * a_new
        
        return u_new, v_new, a_new


class PerformanceMonitor:
    """Monitor and report performance metrics"""
    
    def __init__(self):
        self.metrics: Dict[str, float] = {}
    
    def record_operation(self, operation: str, duration: float, size: int = None):
        """
        Record operation performance
        
        Args:
            operation: Operation name
            duration: Time taken (seconds)
            size: Problem size (e.g., matrix dimension)
        """
        key = f"{operation}_{size}" if size else operation
        self.metrics[key] = duration
    
    def get_metrics(self) -> Dict[str, float]:
        """Get all recorded metrics"""
        return self.metrics.copy()
    
    def print_report(self):
        """Print performance report"""
        print("\n" + "="*60)
        print("PERFORMANCE REPORT")
        print("="*60)
        
        for operation, duration in sorted(self.metrics.items()):
            print(f"{operation:40s}: {duration:8.4f} s")
        
        print("="*60 + "\n")


# Global instances
_result_cache = ResultCache(max_size=128)
_performance_monitor = PerformanceMonitor()


def get_result_cache() -> ResultCache:
    """Get global result cache instance"""
    return _result_cache


def get_performance_monitor() -> PerformanceMonitor:
    """Get global performance monitor instance"""
    return _performance_monitor
