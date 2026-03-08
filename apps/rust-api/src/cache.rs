//! In-memory result caching using moka
//!
//! Caches analysis results to avoid re-computing identical inputs.
//! Uses SHA-256 hash of serialized input as cache key.
//!
//! Default: 100 entries, 10-minute TTL, ~200MB max weight

use moka::future::Cache;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::time::Duration;

/// Cache for serializable analysis results stored as JSON bytes
#[derive(Clone)]
pub struct AnalysisCache {
    inner: Cache<String, Vec<u8>>,
}

impl AnalysisCache {
    /// Create a new cache with the given max capacity and TTL
    pub fn new(max_capacity: u64, ttl_secs: u64) -> Self {
        let inner = Cache::builder()
            .max_capacity(max_capacity)
            .time_to_live(Duration::from_secs(ttl_secs))
            .time_to_idle(Duration::from_secs(ttl_secs / 2))
            .build();
        Self { inner }
    }

    /// Default cache: 256 entries, 10-minute TTL
    pub fn default_analysis() -> Self {
        Self::new(256, 600)
    }

    /// Design code cache: 512 entries, 1-hour TTL (design codes are deterministic)
    pub fn default_design() -> Self {
        Self::new(512, 3600)
    }

    /// Heavy computation cache: 128 entries, 30-minute TTL (modal analysis, P-Delta)
    pub fn default_heavy() -> Self {
        Self::new(128, 1800)
    }

    /// Compute a SHA-256 cache key from any serializable input
    pub fn cache_key<T: Serialize>(prefix: &str, input: &T) -> String {
        let json = serde_json::to_vec(input).unwrap_or_default();
        let hash = Sha256::digest(&json);
        format!("{}:{:x}", prefix, hash)
    }

    /// Try to get a cached result, deserializing from JSON bytes
    pub async fn get<T: serde::de::DeserializeOwned>(&self, key: &str) -> Option<T> {
        self.inner
            .get(key)
            .await
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
    }

    /// Store a result in the cache as JSON bytes
    pub async fn insert<T: Serialize>(&self, key: String, value: &T) {
        if let Ok(bytes) = serde_json::to_vec(value) {
            self.inner.insert(key, bytes).await;
        }
    }

    /// Number of entries in cache
    pub fn entry_count(&self) -> u64 {
        self.inner.entry_count()
    }

    /// Invalidate all cached entries
    pub fn invalidate_all(&self) {
        self.inner.invalidate_all();
    }

    /// Get cache statistics
    pub fn stats(&self) -> CacheStats {
        CacheStats {
            entry_count: self.entry_count(),
            weighted_size: self.inner.weighted_size(),
        }
    }
}

/// Cache statistics
#[derive(Debug, Clone, serde::Serialize)]
pub struct CacheStats {
    pub entry_count: u64,
    pub weighted_size: u64,
}
