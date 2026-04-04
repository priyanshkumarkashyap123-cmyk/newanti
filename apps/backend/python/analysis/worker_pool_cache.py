"""
Result caching for worker pool.
"""

import hashlib
import json
import time
from typing import Any, Dict, Optional, Tuple


class ResultCache:
    """Manages cached analysis results"""
    
    def __init__(self, ttl: int = 3600):
        """Initialize cache with TTL (time-to-live)"""
        self._cache: Dict[str, Tuple[Any, float]] = {}
        self.ttl = ttl
    
    def get(self, cache_key: str) -> Optional[Any]:
        """Get cached result if valid"""
        if cache_key not in self._cache:
            return None
        
        result, cached_time = self._cache[cache_key]
        if time.time() - cached_time > self.ttl:
            del self._cache[cache_key]
            return None
        
        return result
    
    def put(self, cache_key: str, result: Any):
        """Store result in cache"""
        self._cache[cache_key] = (result, time.time())
    
    def compute_cache_key(self, job_type: str, input_data: Dict) -> str:
        """Deterministic hash for caching results"""
        canonical = json.dumps(
            {"type": job_type, "input": input_data},
            sort_keys=True,
            default=str,
        )
        return hashlib.sha256(canonical.encode()).hexdigest()[:16]
    
    def cleanup(self):
        """Remove expired entries"""
        now = time.time()
        expired = [
            k for k, (_, timestamp) in self._cache.items()
            if now - timestamp > self.ttl
        ]
        for k in expired:
            del self._cache[k]
    
    def get_size(self) -> int:
        """Get number of cached entries"""
        return len(self._cache)
    
    def clear(self):
        """Clear all cache"""
        self._cache.clear()


__all__ = ["ResultCache"]
