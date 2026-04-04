"""Performance optimization shim re-exporting split modules."""

from __future__ import annotations

from typing import Tuple

import numpy as np

from .performance_sparse import SparseMatrixHandler
from .performance_parallel import ParallelProcessor
from .performance_vectorized import VectorizedOperations as _VectorizedOperations
from .performance_cache import ResultCache as _BaseResultCache, get_result_cache as _get_result_cache
from .performance_monitoring import PerformanceMonitor, get_performance_monitor as _get_performance_monitor


def _vectorized_newmark_step_compat(
    u: np.ndarray,
    v: np.ndarray,
    a: np.ndarray,
    K_eff: np.ndarray,
    f_ext: float,
    dt: float,
    beta: float = 0.25,
    gamma: float = 0.5,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    return _VectorizedOperations.vectorized_newmark_step(
        u,
        v,
        a,
        K_eff,
        f_ext,
        dt,
        SparseMatrixHandler.sparse_solve,
        beta,
        gamma,
    )


class VectorizedOperations(_VectorizedOperations):
    """Compatibility facade preserving original vectorized API."""

    vectorized_newmark_step = staticmethod(_vectorized_newmark_step_compat)


class ResultCache(_BaseResultCache):
    """Compatibility facade preserving cached modal analysis API."""

    def cached_modal_analysis(self, K: np.ndarray, M: np.ndarray, num_modes: int):
        return super().cached_modal_analysis(SparseMatrixHandler.sparse_eigenvalues, K, M, num_modes)


def get_result_cache() -> ResultCache:
    return _get_result_cache()


def get_performance_monitor() -> PerformanceMonitor:
    return _get_performance_monitor()


__all__ = [
    "SparseMatrixHandler",
    "ParallelProcessor",
    "VectorizedOperations",
    "ResultCache",
    "get_result_cache",
    "PerformanceMonitor",
    "get_performance_monitor",
]
