"""Sparse matrix utilities for performance-sensitive structural analysis."""

from __future__ import annotations

from typing import Any, Tuple

import numpy as np

try:
    from scipy import sparse
    from scipy.sparse import linalg as sparse_linalg

    SCIPY_AVAILABLE = True
except ImportError:
    SCIPY_AVAILABLE = False
    print("Warning: scipy not available. Sparse matrix optimization disabled.")


class SparseMatrixHandler:
    """Handle sparse matrix operations for memory efficiency."""

    @staticmethod
    def is_sparse_beneficial(matrix: np.ndarray, sparsity_threshold: float = 0.7) -> bool:
        if not SCIPY_AVAILABLE:
            return False
        if matrix.size == 0:
            return False
        zero_count = np.count_nonzero(matrix == 0)
        sparsity = zero_count / matrix.size
        return sparsity >= sparsity_threshold

    @staticmethod
    def to_sparse(matrix: np.ndarray, format: str = "csr") -> Any:
        if not SCIPY_AVAILABLE:
            return matrix
        if format == "csr":
            return sparse.csr_matrix(matrix)
        if format == "csc":
            return sparse.csc_matrix(matrix)
        if format == "coo":
            return sparse.coo_matrix(matrix)
        return sparse.csr_matrix(matrix)

    @staticmethod
    def to_dense(sparse_matrix: Any) -> np.ndarray:
        if not SCIPY_AVAILABLE or isinstance(sparse_matrix, np.ndarray):
            return sparse_matrix
        return sparse_matrix.toarray()

    @staticmethod
    def sparse_solve(A: Any, b: np.ndarray, method: str = "direct") -> np.ndarray:
        if not SCIPY_AVAILABLE:
            return np.linalg.solve(A, b)

        if isinstance(A, np.ndarray):
            if SparseMatrixHandler.is_sparse_beneficial(A):
                A = sparse.csr_matrix(A)
            else:
                return np.linalg.solve(A, b)

        if method == "direct":
            return sparse_linalg.spsolve(A, b)

        x, info = sparse_linalg.cg(A, b, tol=1e-6)
        if info != 0:
            print(f"Warning: Iterative solver did not converge (info={info})")
        return x

    @staticmethod
    def sparse_eigenvalues(K: Any, M: Any, num_modes: int = 10) -> Tuple[np.ndarray, np.ndarray]:
        if not SCIPY_AVAILABLE:
            return np.linalg.eigh(K, M)

        if isinstance(K, np.ndarray) and SparseMatrixHandler.is_sparse_beneficial(K):
            K = sparse.csr_matrix(K)
        if isinstance(M, np.ndarray) and SparseMatrixHandler.is_sparse_beneficial(M):
            M = sparse.csr_matrix(M)

        n = K.shape[0]
        k = min(num_modes, n - 2)

        try:
            eigenvalues, eigenvectors = sparse_linalg.eigsh(K, k=k, M=M, which="SM")
            return eigenvalues, eigenvectors
        except Exception as exc:
            print(f"Sparse eigenvalue solver failed: {exc}. Falling back to dense.")
            K_dense = K.toarray() if sparse.issparse(K) else K
            M_dense = M.toarray() if sparse.issparse(M) else M
            eigenvalues, eigenvectors = np.linalg.eigh(K_dense, M_dense)
            return eigenvalues[:k], eigenvectors[:, :k]


__all__ = ["SCIPY_AVAILABLE", "SparseMatrixHandler"]
