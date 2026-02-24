//! # Engineering Computation Logging & Metrics
//!
//! Industry-standard logging, tracing, and performance metrics for engineering computations.
//! Works both in native Rust and WASM environments.
//!
//! ## Features
//! - **Structured logging**: JSON-formatted logs for analysis tools
//! - **Performance metrics**: Timing, memory, iteration counts
//! - **WASM-compatible**: Uses console.log/warn/error in browser
//! - **Feature-gated**: Can be disabled for production performance

use serde::{Deserialize, Serialize};
use std::time::Duration;
use wasm_bindgen::prelude::*;

// =============================================================================
// LOG LEVELS
// =============================================================================

/// Log severity levels (following syslog conventions)
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize, Deserialize)]
#[repr(u8)]
pub enum LogLevel {
    /// Detailed debugging information
    Trace = 0,
    /// General debugging information
    Debug = 1,
    /// Normal operational messages
    Info = 2,
    /// Warning conditions
    Warn = 3,
    /// Error conditions
    Error = 4,
    /// Critical/fatal conditions
    Critical = 5,
}

impl std::fmt::Display for LogLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LogLevel::Trace => write!(f, "TRACE"),
            LogLevel::Debug => write!(f, "DEBUG"),
            LogLevel::Info => write!(f, "INFO"),
            LogLevel::Warn => write!(f, "WARN"),
            LogLevel::Error => write!(f, "ERROR"),
            LogLevel::Critical => write!(f, "CRITICAL"),
        }
    }
}

// =============================================================================
// STRUCTURED LOG ENTRY
// =============================================================================

/// A structured log entry with context
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    /// Timestamp (milliseconds since epoch or page load)
    pub timestamp_ms: f64,
    /// Log level
    pub level: LogLevel,
    /// Component/module name
    pub component: String,
    /// Message
    pub message: String,
    /// Optional structured data
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    /// Optional duration for timed operations
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<f64>,
}

impl LogEntry {
    /// Create a new log entry
    pub fn new(level: LogLevel, component: impl Into<String>, message: impl Into<String>) -> Self {
        Self {
            timestamp_ms: get_timestamp_ms(),
            level,
            component: component.into(),
            message: message.into(),
            data: None,
            duration_ms: None,
        }
    }

    /// Add structured data to the log entry
    pub fn with_data(mut self, data: impl Serialize) -> Self {
        self.data = serde_json::to_value(data).ok();
        self
    }

    /// Add duration to the log entry
    pub fn with_duration(mut self, duration: Duration) -> Self {
        self.duration_ms = Some(duration.as_secs_f64() * 1000.0);
        self
    }

    /// Convert to JSON string
    pub fn to_json(&self) -> String {
        serde_json::to_string(self).unwrap_or_else(|_| self.message.clone())
    }
}

// =============================================================================
// WASM-COMPATIBLE LOGGING
// =============================================================================

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    fn log(s: &str);
    #[wasm_bindgen(js_namespace = console)]
    fn warn(s: &str);
    #[wasm_bindgen(js_namespace = console)]
    fn error(s: &str);
    #[wasm_bindgen(js_namespace = console)]
    fn debug(s: &str);
    
    #[wasm_bindgen(js_namespace = performance)]
    fn now() -> f64;
}

/// Get current timestamp in milliseconds
fn get_timestamp_ms() -> f64 {
    #[cfg(target_arch = "wasm32")]
    {
        now()
    }
    #[cfg(not(target_arch = "wasm32"))]
    {
        use std::time::{SystemTime, UNIX_EPOCH};
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_secs_f64() * 1000.0)
            .unwrap_or(0.0)
    }
}

/// Log a message (WASM-compatible)
pub fn log_message(entry: &LogEntry) {
    let json = entry.to_json();
    
    #[cfg(target_arch = "wasm32")]
    {
        match entry.level {
            LogLevel::Trace | LogLevel::Debug => debug(&json),
            LogLevel::Info => log(&json),
            LogLevel::Warn => warn(&json),
            LogLevel::Error | LogLevel::Critical => error(&json),
        }
    }
    
    #[cfg(not(target_arch = "wasm32"))]
    {
        eprintln!("[{}] {}: {} - {}", entry.level, entry.component, entry.message, 
                  entry.data.as_ref().map(|d| d.to_string()).unwrap_or_default());
    }
}

// =============================================================================
// CONVENIENCE MACROS AND FUNCTIONS
// =============================================================================

/// Log at trace level
pub fn trace(component: &str, message: &str) {
    log_message(&LogEntry::new(LogLevel::Trace, component, message));
}

/// Log at debug level
pub fn debug_log(component: &str, message: &str) {
    log_message(&LogEntry::new(LogLevel::Debug, component, message));
}

/// Log at info level
pub fn info(component: &str, message: &str) {
    log_message(&LogEntry::new(LogLevel::Info, component, message));
}

/// Log at warn level
pub fn warn_log(component: &str, message: &str) {
    log_message(&LogEntry::new(LogLevel::Warn, component, message));
}

/// Log at error level
pub fn error_log(component: &str, message: &str) {
    log_message(&LogEntry::new(LogLevel::Error, component, message));
}

// =============================================================================
// PERFORMANCE METRICS
// =============================================================================

/// Performance metrics for a computation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComputationMetrics {
    /// Name of the computation
    pub name: String,
    /// Total execution time in milliseconds
    pub total_time_ms: f64,
    /// Time breakdown by phase
    pub phase_times_ms: Vec<(String, f64)>,
    /// Problem size (e.g., DOF count)
    pub problem_size: usize,
    /// Number of iterations (for iterative solvers)
    pub iterations: Option<usize>,
    /// Final residual norm (for iterative solvers)
    pub residual_norm: Option<f64>,
    /// Memory usage in bytes (if available)
    pub memory_bytes: Option<usize>,
    /// Throughput (elements/second, DOF/second, etc.)
    pub throughput: Option<f64>,
}

impl ComputationMetrics {
    /// Create new metrics
    pub fn new(name: impl Into<String>) -> Self {
        Self {
            name: name.into(),
            total_time_ms: 0.0,
            phase_times_ms: Vec::new(),
            problem_size: 0,
            iterations: None,
            residual_norm: None,
            memory_bytes: None,
            throughput: None,
        }
    }

    /// Log the metrics
    pub fn log(&self) {
        let entry = LogEntry::new(LogLevel::Info, "metrics", &self.name)
            .with_data(self);
        log_message(&entry);
    }

    /// Calculate throughput
    pub fn calculate_throughput(&mut self) {
        if self.total_time_ms > 0.0 {
            self.throughput = Some(self.problem_size as f64 / (self.total_time_ms / 1000.0));
        }
    }
}

/// Timer for measuring computation phases
pub struct PhaseTimer {
    component: String,
    phase_name: String,
    start_ms: f64,
    log_on_drop: bool,
}

impl PhaseTimer {
    /// Start a new phase timer
    pub fn start(component: impl Into<String>, phase: impl Into<String>) -> Self {
        Self {
            component: component.into(),
            phase_name: phase.into(),
            start_ms: get_timestamp_ms(),
            log_on_drop: true,
        }
    }

    /// Start a timer that doesn't log on drop
    pub fn silent(component: impl Into<String>, phase: impl Into<String>) -> Self {
        Self {
            component: component.into(),
            phase_name: phase.into(),
            start_ms: get_timestamp_ms(),
            log_on_drop: false,
        }
    }

    /// Get elapsed time in milliseconds
    pub fn elapsed_ms(&self) -> f64 {
        get_timestamp_ms() - self.start_ms
    }

    /// Stop and return elapsed time
    pub fn stop(mut self) -> f64 {
        self.log_on_drop = false;
        self.elapsed_ms()
    }

    /// Stop and log
    pub fn stop_and_log(mut self) -> f64 {
        self.log_on_drop = false;
        let elapsed = self.elapsed_ms();
        let entry = LogEntry::new(LogLevel::Debug, &self.component, &self.phase_name)
            .with_duration(Duration::from_secs_f64(elapsed / 1000.0));
        log_message(&entry);
        elapsed
    }
}

impl Drop for PhaseTimer {
    fn drop(&mut self) {
        if self.log_on_drop {
            let elapsed = self.elapsed_ms();
            let entry = LogEntry::new(LogLevel::Debug, &self.component, &self.phase_name)
                .with_duration(Duration::from_secs_f64(elapsed / 1000.0));
            log_message(&entry);
        }
    }
}

// =============================================================================
// SOLVER CONVERGENCE TRACKING
// =============================================================================

/// Track convergence of iterative solvers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvergenceHistory {
    /// Solver name
    pub solver: String,
    /// Residual norms at each iteration
    pub residuals: Vec<f64>,
    /// Convergence rate (ratio of consecutive residuals)
    pub convergence_rates: Vec<f64>,
    /// Did the solver converge?
    pub converged: bool,
    /// Final iteration count
    pub iterations: usize,
    /// Target tolerance
    pub tolerance: f64,
}

impl ConvergenceHistory {
    /// Create a new convergence tracker
    pub fn new(solver: impl Into<String>, tolerance: f64) -> Self {
        Self {
            solver: solver.into(),
            residuals: Vec::new(),
            convergence_rates: Vec::new(),
            converged: false,
            iterations: 0,
            tolerance,
        }
    }

    /// Record a residual value
    pub fn record(&mut self, residual: f64) {
        if !self.residuals.is_empty() {
            let prev = *self.residuals.last().unwrap();
            if prev > 0.0 {
                self.convergence_rates.push(residual / prev);
            }
        }
        self.residuals.push(residual);
        self.iterations += 1;
        
        if residual <= self.tolerance {
            self.converged = true;
        }
    }

    /// Get average convergence rate
    pub fn average_rate(&self) -> Option<f64> {
        if self.convergence_rates.is_empty() {
            None
        } else {
            Some(self.convergence_rates.iter().sum::<f64>() / self.convergence_rates.len() as f64)
        }
    }

    /// Log the convergence history
    pub fn log(&self) {
        let entry = LogEntry::new(
            if self.converged { LogLevel::Info } else { LogLevel::Warn },
            "convergence",
            format!(
                "{}: {} in {} iterations (rate: {:.3})",
                self.solver,
                if self.converged { "converged" } else { "FAILED" },
                self.iterations,
                self.average_rate().unwrap_or(0.0)
            )
        ).with_data(self);
        log_message(&entry);
    }
}

// =============================================================================
// MEMORY TRACKING (for WASM with limited memory)
// =============================================================================

/// Estimate memory usage for common data structures
pub struct MemoryEstimator;

impl MemoryEstimator {
    /// Estimate memory for a dense matrix
    pub fn dense_matrix(rows: usize, cols: usize) -> usize {
        rows * cols * std::mem::size_of::<f64>()
    }

    /// Estimate memory for a sparse matrix (CSR format)
    pub fn sparse_matrix_csr(nnz: usize, rows: usize) -> usize {
        nnz * std::mem::size_of::<f64>()        // values
        + nnz * std::mem::size_of::<usize>()    // column indices
        + (rows + 1) * std::mem::size_of::<usize>() // row pointers
    }

    /// Estimate memory for a vector
    pub fn vector(len: usize) -> usize {
        len * std::mem::size_of::<f64>()
    }

    /// Format bytes as human-readable string
    pub fn format_bytes(bytes: usize) -> String {
        const KB: usize = 1024;
        const MB: usize = KB * 1024;
        const GB: usize = MB * 1024;

        if bytes >= GB {
            format!("{:.2} GB", bytes as f64 / GB as f64)
        } else if bytes >= MB {
            format!("{:.2} MB", bytes as f64 / MB as f64)
        } else if bytes >= KB {
            format!("{:.2} KB", bytes as f64 / KB as f64)
        } else {
            format!("{} B", bytes)
        }
    }
}

// =============================================================================
// ANALYSIS SUMMARY
// =============================================================================

/// Summary of a structural analysis for reporting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisSummary {
    /// Analysis type (linear, nonlinear, dynamic, etc.)
    pub analysis_type: String,
    /// Number of nodes
    pub num_nodes: usize,
    /// Number of elements
    pub num_elements: usize,
    /// Total DOF
    pub total_dof: usize,
    /// Free DOF (after applying BCs)
    pub free_dof: usize,
    /// Solver used
    pub solver: String,
    /// Computation metrics
    pub metrics: ComputationMetrics,
    /// Maximum displacement
    pub max_displacement: Option<f64>,
    /// Maximum stress
    pub max_stress: Option<f64>,
    /// Warnings generated
    pub warnings: Vec<String>,
}

impl AnalysisSummary {
    /// Create a new summary
    pub fn new(analysis_type: impl Into<String>) -> Self {
        Self {
            analysis_type: analysis_type.into(),
            num_nodes: 0,
            num_elements: 0,
            total_dof: 0,
            free_dof: 0,
            solver: String::new(),
            metrics: ComputationMetrics::new("analysis"),
            max_displacement: None,
            max_stress: None,
            warnings: Vec::new(),
        }
    }

    /// Log the summary
    pub fn log(&self) {
        let entry = LogEntry::new(LogLevel::Info, "analysis", &self.analysis_type)
            .with_data(self);
        log_message(&entry);
    }

    /// Convert to JSON string
    pub fn to_json(&self) -> String {
        serde_json::to_string_pretty(self).unwrap_or_default()
    }
}

// =============================================================================
// TESTS
// =============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_entry() {
        let entry = LogEntry::new(LogLevel::Info, "test", "Hello, world!")
            .with_data(serde_json::json!({"key": "value"}));
        
        let json = entry.to_json();
        assert!(json.contains("Hello, world!"));
        assert!(json.contains("test")); // component name
    }

    #[test]
    fn test_convergence_history() {
        let mut history = ConvergenceHistory::new("CG", 1e-6);
        history.record(1.0);
        history.record(0.1);
        history.record(0.01);
        history.record(1e-7);
        
        assert!(history.converged);
        assert_eq!(history.iterations, 4);
        assert!(history.average_rate().unwrap() < 0.2);
    }

    #[test]
    fn test_memory_estimator() {
        let dense = MemoryEstimator::dense_matrix(1000, 1000);
        assert_eq!(dense, 8_000_000); // 8 MB
        
        assert_eq!(MemoryEstimator::format_bytes(1024), "1.00 KB");
        assert_eq!(MemoryEstimator::format_bytes(1024 * 1024), "1.00 MB");
    }
}
