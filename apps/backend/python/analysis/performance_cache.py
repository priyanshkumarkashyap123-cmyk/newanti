"""Result caching utilities for performance-sensitive computations."""

from __future__ import annotations

import hashlib
from typing import Any, Dict, Optional, Tuple

import numpy as np


class ResultCache:
    """Cache expensive computation results."""

    def __init__(self, max_size: int = 128):
        self.max_size = max_size
        self._cache: Dict[str, Any] = {}

    def get(self, key: str) -> Optional[Any]:
        """Get cached result."""
        return self._cache.get(key)

    def set(self, key: str, value: Any) -> None:
        """Set cached result with simple FIFO eviction."""
        if len(self._cache) >= self.max_size:
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]
        self._cache[key] = value

    def cached_modal_analysis(self, sparse_eigenvalues, K: np.ndarray, M: np.ndarray, num_modes: int) -> Tuple[np.ndarray, np.ndarray]:
        """Cached modal analysis (eigenvalue computation)."""
        K_hash = hashlib.md5(K.tobytes()).hexdigest()
        M_hash = hashlib.md5(M.tobytes()).hexdigest()
        cache_key = f"modal_{K_hash}_{M_hash}_{num_modes}"

        cached = self.get(cache_key)
        if cached is not None:
            print("Modal analysis: Using cached results")
            return cached

        print("Modal analysis: Computing (not cached)")
        eigenvalues, eigenvectors = sparse_eigenvalues(K, M, num_modes)
        self.set(cache_key, (eigenvalues, eigenvectors))
        return eigenvalues, eigenvectors


_result_cache = ResultCache(max_size=128)


def get_result_cache() -> ResultCache:
    """Get global result cache instance."""
    return _result_cache


__all__ = ["ResultCache", "get_result_cache"]
