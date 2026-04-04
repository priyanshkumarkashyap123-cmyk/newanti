//! Performance metrics handlers

use axum::{extract::State, Json};
use serde::Serialize;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use crate::error::ApiResult;
use crate::middleware::rate_limit::{internal_auth_metrics_snapshot, InternalAuthMetrics};
use crate::AppState;

/// Global metrics (thread-safe counters)
pub static TOTAL_ANALYSES: AtomicU64 = AtomicU64::new(0);
pub static TOTAL_NODES_PROCESSED: AtomicU64 = AtomicU64::new(0);
pub static TOTAL_MEMBERS_PROCESSED: AtomicU64 = AtomicU64::new(0);
pub static TOTAL_SOLVE_TIME_MS: AtomicU64 = AtomicU64::new(0);
pub static CACHE_HITS: AtomicU64 = AtomicU64::new(0);
pub static CACHE_MISSES: AtomicU64 = AtomicU64::new(0);

/// Metrics response
#[derive(Debug, Serialize)]
pub struct MetricsResponse {
    pub success: bool,

    // Analysis statistics
    pub total_analyses: u64,
    pub total_nodes_processed: u64,
    pub total_members_processed: u64,
    pub avg_nodes_per_analysis: f64,
    pub avg_members_per_analysis: f64,

    // Performance
    pub total_solve_time_ms: u64,
    pub avg_solve_time_ms: f64,

    // Cache
    pub cache_hits: u64,
    pub cache_misses: u64,
    pub cache_hit_rate: f64,

    // Internal service auth security observability
    pub internal_auth: InternalAuthMetrics,

    // Server info
    pub uptime_seconds: u64,
    pub thread_count: usize,
    pub version: String,
}

/// GET /api/metrics - Performance metrics
pub async fn get_metrics(State(_state): State<Arc<AppState>>) -> ApiResult<Json<MetricsResponse>> {
    let total_analyses = TOTAL_ANALYSES.load(Ordering::Relaxed);
    let total_nodes = TOTAL_NODES_PROCESSED.load(Ordering::Relaxed);
    let total_members = TOTAL_MEMBERS_PROCESSED.load(Ordering::Relaxed);
    let total_time = TOTAL_SOLVE_TIME_MS.load(Ordering::Relaxed);
    let hits = CACHE_HITS.load(Ordering::Relaxed);
    let misses = CACHE_MISSES.load(Ordering::Relaxed);

    let avg_nodes = if total_analyses > 0 {
        total_nodes as f64 / total_analyses as f64
    } else {
        0.0
    };

    let avg_members = if total_analyses > 0 {
        total_members as f64 / total_analyses as f64
    } else {
        0.0
    };

    let avg_time = if total_analyses > 0 {
        total_time as f64 / total_analyses as f64
    } else {
        0.0
    };

    let cache_hit_rate = if hits + misses > 0 {
        hits as f64 / (hits + misses) as f64
    } else {
        0.0
    };

    let internal_auth = internal_auth_metrics_snapshot();

    Ok(Json(MetricsResponse {
        success: true,
        total_analyses,
        total_nodes_processed: total_nodes,
        total_members_processed: total_members,
        avg_nodes_per_analysis: avg_nodes,
        avg_members_per_analysis: avg_members,
        total_solve_time_ms: total_time,
        avg_solve_time_ms: avg_time,
        cache_hits: hits,
        cache_misses: misses,
        cache_hit_rate,
        internal_auth,
        uptime_seconds: 0, // Would track from server start
        thread_count: rayon::current_num_threads(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }))
}

/// Record an analysis for metrics
#[allow(dead_code)]
pub fn record_analysis(nodes: usize, members: usize, solve_time_ms: u64) {
    TOTAL_ANALYSES.fetch_add(1, Ordering::Relaxed);
    TOTAL_NODES_PROCESSED.fetch_add(nodes as u64, Ordering::Relaxed);
    TOTAL_MEMBERS_PROCESSED.fetch_add(members as u64, Ordering::Relaxed);
    TOTAL_SOLVE_TIME_MS.fetch_add(solve_time_ms, Ordering::Relaxed);
}

/// Record cache hit
#[allow(dead_code)]
pub fn record_cache_hit() {
    CACHE_HITS.fetch_add(1, Ordering::Relaxed);
}

/// Record cache miss
#[allow(dead_code)]
pub fn record_cache_miss() {
    CACHE_MISSES.fetch_add(1, Ordering::Relaxed);
}

/// Detailed performance breakdown
#[derive(Debug, Serialize)]
pub struct DetailedMetrics {
    pub solver_stats: SolverStats,
    pub memory_stats: MemoryStats,
    pub throughput: ThroughputStats,
}

#[derive(Debug, Serialize)]
pub struct SolverStats {
    pub matrix_assembly_avg_ms: f64,
    pub factorization_avg_ms: f64,
    pub solve_avg_ms: f64,
    pub post_process_avg_ms: f64,
}

#[derive(Debug, Serialize)]
pub struct MemoryStats {
    pub peak_memory_mb: f64,
    pub current_memory_mb: f64,
    pub matrix_memory_mb: f64,
}

#[derive(Debug, Serialize)]
pub struct ThroughputStats {
    pub analyses_per_second: f64,
    pub nodes_per_second: f64,
    pub dofs_per_second: f64,
}

/// GET /api/metrics/detailed - Detailed performance breakdown
pub async fn get_detailed_metrics(
    State(_state): State<Arc<AppState>>,
) -> ApiResult<Json<DetailedMetrics>> {
    let total = TOTAL_ANALYSES.load(Ordering::Relaxed) as f64;
    let total_time = TOTAL_SOLVE_TIME_MS.load(Ordering::Relaxed) as f64;

    let avg_time = if total > 0.0 { total_time / total } else { 0.0 };

    Ok(Json(DetailedMetrics {
        solver_stats: SolverStats {
            matrix_assembly_avg_ms: avg_time * 0.20, // ~20% of solve time
            factorization_avg_ms: avg_time * 0.50,   // ~50% of solve time
            solve_avg_ms: avg_time * 0.20,           // ~20% of solve time
            post_process_avg_ms: avg_time * 0.10,    // ~10% of solve time
        },
        memory_stats: MemoryStats {
            peak_memory_mb: 0.0, // Would need actual tracking
            current_memory_mb: 0.0,
            matrix_memory_mb: 0.0,
        },
        throughput: ThroughputStats {
            analyses_per_second: if total_time > 0.0 {
                total * 1000.0 / total_time
            } else {
                0.0
            },
            nodes_per_second: if total_time > 0.0 {
                TOTAL_NODES_PROCESSED.load(Ordering::Relaxed) as f64 * 1000.0 / total_time
            } else {
                0.0
            },
            dofs_per_second: if total_time > 0.0 {
                TOTAL_NODES_PROCESSED.load(Ordering::Relaxed) as f64 * 6.0 * 1000.0 / total_time
            } else {
                0.0
            },
        },
    }))
}
