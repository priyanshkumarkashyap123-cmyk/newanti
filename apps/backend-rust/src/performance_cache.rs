// ============================================================================
// PERFORMANCE OPTIMIZATION AND CACHING
// ============================================================================
//
// P2 REQUIREMENT: Performance Worker/Offloading and Caching
//
// Features:
// - LRU cache for computation results
// - Response spectrum caching
// - Material library caching
// - Solver state memoization
// - Background computation support
// - Memory-efficient storage
//
// Industry Standard: RAM Elements, ETABS caching strategies
// ============================================================================

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

// ============================================================================
// LRU CACHE
// ============================================================================

/// Generic LRU cache with TTL support
pub struct LruCache<K, V> {
    capacity: usize,
    ttl: Option<Duration>,
    entries: RwLock<HashMap<K, CacheEntry<V>>>,
    access_order: RwLock<Vec<K>>,
    stats: RwLock<CacheStats>,
}

struct CacheEntry<V> {
    value: V,
    created: Instant,
    last_accessed: Instant,
    access_count: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct CacheStats {
    pub hits: u64,
    pub misses: u64,
    pub evictions: u64,
    pub expirations: u64,
    pub total_entries: usize,
    pub memory_bytes: usize,
}

impl CacheStats {
    pub fn hit_rate(&self) -> f64 {
        let total = self.hits + self.misses;
        if total == 0 {
            0.0
        } else {
            self.hits as f64 / total as f64
        }
    }
}

impl<K, V> LruCache<K, V>
where
    K: std::hash::Hash + Eq + Clone,
    V: Clone,
{
    pub fn new(capacity: usize) -> Self {
        Self {
            capacity,
            ttl: None,
            entries: RwLock::new(HashMap::with_capacity(capacity)),
            access_order: RwLock::new(Vec::with_capacity(capacity)),
            stats: RwLock::new(CacheStats::default()),
        }
    }

    pub fn with_ttl(capacity: usize, ttl: Duration) -> Self {
        Self {
            capacity,
            ttl: Some(ttl),
            entries: RwLock::new(HashMap::with_capacity(capacity)),
            access_order: RwLock::new(Vec::with_capacity(capacity)),
            stats: RwLock::new(CacheStats::default()),
        }
    }

    pub fn get(&self, key: &K) -> Option<V> {
        let mut entries = self.entries.write().ok()?;
        let mut stats = self.stats.write().ok()?;

        if let Some(entry) = entries.get_mut(key) {
            // Check TTL
            if let Some(ttl) = self.ttl {
                if entry.created.elapsed() > ttl {
                    entries.remove(key);
                    stats.expirations += 1;
                    stats.misses += 1;
                    return None;
                }
            }

            entry.last_accessed = Instant::now();
            entry.access_count += 1;
            stats.hits += 1;

            // Update access order
            if let Ok(mut order) = self.access_order.write() {
                if let Some(pos) = order.iter().position(|k| k == key) {
                    order.remove(pos);
                }
                order.push(key.clone());
            }

            Some(entry.value.clone())
        } else {
            stats.misses += 1;
            None
        }
    }

    pub fn insert(&self, key: K, value: V) {
        let mut entries = self.entries.write().unwrap_or_else(|e| e.into_inner());
        let mut order = self.access_order.write().unwrap_or_else(|e| e.into_inner());
        let mut stats = self.stats.write().unwrap_or_else(|e| e.into_inner());

        // Evict if at capacity
        while entries.len() >= self.capacity && !order.is_empty() {
            let lru_key = order.remove(0);
            entries.remove(&lru_key);
            stats.evictions += 1;
        }

        // Remove existing entry if present
        if entries.contains_key(&key) {
            if let Some(pos) = order.iter().position(|k| k == &key) {
                order.remove(pos);
            }
        }

        entries.insert(key.clone(), CacheEntry {
            value,
            created: Instant::now(),
            last_accessed: Instant::now(),
            access_count: 1,
        });

        order.push(key);
        stats.total_entries = entries.len();
    }

    pub fn remove(&self, key: &K) -> Option<V> {
        let mut entries = self.entries.write().ok()?;
        let mut order = self.access_order.write().ok()?;

        if let Some(pos) = order.iter().position(|k| k == key) {
            order.remove(pos);
        }

        entries.remove(key).map(|e| e.value)
    }

    pub fn clear(&self) {
        if let Ok(mut entries) = self.entries.write() {
            entries.clear();
        }
        if let Ok(mut order) = self.access_order.write() {
            order.clear();
        }
        if let Ok(mut stats) = self.stats.write() {
            stats.total_entries = 0;
        }
    }

    pub fn stats(&self) -> CacheStats {
        self.stats.read()
            .map(|s| s.clone())
            .unwrap_or_default()
    }

    pub fn len(&self) -> usize {
        self.entries.read().map(|e| e.len()).unwrap_or(0)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

// ============================================================================
// RESPONSE SPECTRUM CACHE
// ============================================================================

/// Cache key for response spectrum
#[derive(Debug, Clone, Hash, PartialEq, Eq, Serialize, Deserialize)]
pub struct SpectrumKey {
    pub code: String,           // e.g., "IS1893:2016", "ASCE7-22"
    pub soil_type: String,      // e.g., "D", "III"
    pub zone_factor: u32,       // Multiplied by 1000 to avoid float hashing
    pub importance_factor: u32, // Multiplied by 100
    pub damping_ratio: u32,     // Multiplied by 100 (e.g., 500 for 5%)
}

impl SpectrumKey {
    pub fn new(code: &str, soil_type: &str, zone: f64, importance: f64, damping: f64) -> Self {
        Self {
            code: code.to_string(),
            soil_type: soil_type.to_string(),
            zone_factor: (zone * 1000.0) as u32,
            importance_factor: (importance * 100.0) as u32,
            damping_ratio: (damping * 100.0) as u32,
        }
    }
}

/// Cached response spectrum data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedSpectrum {
    pub periods: Vec<f64>,
    pub accelerations: Vec<f64>,
    pub velocities: Vec<f64>,
    pub displacements: Vec<f64>,
    pub metadata: SpectrumMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpectrumMetadata {
    pub code_reference: String,
    pub computed_at: String,
    pub parameters: HashMap<String, f64>,
}

/// Response spectrum cache
pub struct SpectrumCache {
    cache: LruCache<SpectrumKey, CachedSpectrum>,
}

impl SpectrumCache {
    pub fn new(capacity: usize) -> Self {
        Self {
            cache: LruCache::with_ttl(capacity, Duration::from_secs(3600)), // 1 hour TTL
        }
    }

    pub fn get(&self, key: &SpectrumKey) -> Option<CachedSpectrum> {
        self.cache.get(key)
    }

    pub fn insert(&self, key: SpectrumKey, spectrum: CachedSpectrum) {
        self.cache.insert(key, spectrum);
    }

    pub fn stats(&self) -> CacheStats {
        self.cache.stats()
    }

    /// Precompute and cache common spectra
    pub fn preload_common_spectra(&self) {
        // IS 1893:2016 common configurations
        let is_configs = [
            ("I", 0.10), ("I", 0.16), ("I", 0.24), ("I", 0.36),
            ("II", 0.10), ("II", 0.16), ("II", 0.24), ("II", 0.36),
            ("III", 0.10), ("III", 0.16), ("III", 0.24), ("III", 0.36),
        ];

        for (soil, zone) in is_configs {
            let key = SpectrumKey::new("IS1893:2016", soil, zone, 1.0, 0.05);
            let spectrum = self.compute_is1893_spectrum(soil, zone, 1.0, 0.05);
            self.insert(key, spectrum);
        }
    }

    fn compute_is1893_spectrum(
        &self,
        soil_type: &str,
        zone_factor: f64,
        importance: f64,
        damping: f64,
    ) -> CachedSpectrum {
        let mut periods = Vec::new();
        let mut accelerations = Vec::new();
        let mut velocities = Vec::new();
        let mut displacements = Vec::new();

        // Soil type dependent periods
        let (ta, tb, tc) = match soil_type {
            "I" => (0.0, 0.10, 0.40),
            "II" => (0.0, 0.10, 0.55),
            "III" => (0.0, 0.10, 0.67),
            _ => (0.0, 0.10, 0.55),
        };

        // Damping correction factor
        let eta = (10.0_f64 / (5.0 + damping * 100.0)).sqrt().max(0.55);

        // Generate spectrum points
        let mut t = 0.0_f64;
        while t <= 4.0 {
            let sa_g = if t <= ta {
                1.0 + 15.0 * t / ta.max(0.01)
            } else if t <= tb {
                2.5
            } else if t <= tc {
                2.5
            } else {
                2.5 * tc / t
            };

            let sa = zone_factor * importance * sa_g / 2.0 * eta; // R = 2 for simplicity

            periods.push(t);
            accelerations.push(sa);
            velocities.push(sa * t / (2.0 * std::f64::consts::PI));
            displacements.push(sa * t * t / (4.0 * std::f64::consts::PI * std::f64::consts::PI));

            t += if t < 0.5 { 0.01 } else if t < 2.0 { 0.05 } else { 0.1 };
        }

        CachedSpectrum {
            periods,
            accelerations,
            velocities,
            displacements,
            metadata: SpectrumMetadata {
                code_reference: "IS 1893:2016 Clause 6.4".to_string(),
                computed_at: chrono_lite_now(),
                parameters: HashMap::from([
                    ("zone_factor".to_string(), zone_factor),
                    ("importance".to_string(), importance),
                    ("damping".to_string(), damping),
                ]),
            },
        }
    }
}

/// Simple timestamp generator (avoid chrono dependency)
fn chrono_lite_now() -> String {
    format!("2025-01-01T00:00:00Z") // Placeholder
}

// ============================================================================
// MATERIAL LIBRARY CACHE
// ============================================================================

/// Material property cache key
#[derive(Debug, Clone, Hash, PartialEq, Eq, Serialize, Deserialize)]
pub struct MaterialKey {
    pub code: String,       // e.g., "IS456", "EN1992", "ACI318"
    pub grade: String,      // e.g., "M30", "C30/37", "f'c=4000psi"
    pub variant: String,    // e.g., "normal", "lightweight"
}

/// Cached material properties
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedMaterial {
    pub name: String,
    pub material_type: String,
    pub properties: MaterialProperties,
    pub code_reference: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialProperties {
    // Elastic properties
    pub e_modulus: f64,       // Pa
    pub g_modulus: f64,       // Pa
    pub poisson_ratio: f64,
    
    // Strength
    pub fy: Option<f64>,      // Yield (steel)
    pub fu: Option<f64>,      // Ultimate (steel)
    pub fck: Option<f64>,     // Characteristic (concrete)
    pub fcd: Option<f64>,     // Design (concrete)
    pub fcm: Option<f64>,     // Mean (concrete)
    
    // Other
    pub density: f64,         // kg/m³
    pub thermal_coeff: f64,   // per °C
    pub creep_coeff: Option<f64>,
    pub shrinkage: Option<f64>,
}

/// Material library cache
pub struct MaterialCache {
    cache: LruCache<MaterialKey, CachedMaterial>,
}

impl MaterialCache {
    pub fn new() -> Self {
        let cache = LruCache::new(500);
        let instance = Self { cache };
        instance.preload_common_materials();
        instance
    }

    pub fn get(&self, key: &MaterialKey) -> Option<CachedMaterial> {
        self.cache.get(key)
    }

    pub fn insert(&self, key: MaterialKey, material: CachedMaterial) {
        self.cache.insert(key, material);
    }

    fn preload_common_materials(&self) {
        // IS 456 concrete grades
        for grade in ["M20", "M25", "M30", "M35", "M40", "M45", "M50"] {
            let fck = grade[1..].parse::<f64>().unwrap_or(30.0) * 1e6;
            
            self.cache.insert(
                MaterialKey {
                    code: "IS456".to_string(),
                    grade: grade.to_string(),
                    variant: "normal".to_string(),
                },
                CachedMaterial {
                    name: format!("{} Concrete (IS 456)", grade),
                    material_type: "Concrete".to_string(),
                    properties: MaterialProperties {
                        e_modulus: 5000.0 * (fck / 1e6).sqrt() * 1e6,
                        g_modulus: 5000.0 * (fck / 1e6).sqrt() * 1e6 / 2.4,
                        poisson_ratio: 0.2,
                        fy: None,
                        fu: None,
                        fck: Some(fck),
                        fcd: Some(fck / 1.5),
                        fcm: Some(fck + 8e6),
                        density: 25000.0,
                        thermal_coeff: 10e-6,
                        creep_coeff: Some(2.5),
                        shrinkage: Some(0.0003),
                    },
                    code_reference: "IS 456:2000".to_string(),
                },
            );
        }

        // IS 800 steel grades
        for (grade, fy) in [("E250", 250e6), ("E300", 300e6), ("E350", 350e6), ("E410", 410e6)] {
            self.cache.insert(
                MaterialKey {
                    code: "IS800".to_string(),
                    grade: grade.to_string(),
                    variant: "hot-rolled".to_string(),
                },
                CachedMaterial {
                    name: format!("{} Steel (IS 800)", grade),
                    material_type: "Steel".to_string(),
                    properties: MaterialProperties {
                        e_modulus: 200e9,
                        g_modulus: 77e9,
                        poisson_ratio: 0.3,
                        fy: Some(fy),
                        fu: Some(fy * 1.5),
                        fck: None,
                        fcd: None,
                        fcm: None,
                        density: 78500.0,
                        thermal_coeff: 12e-6,
                        creep_coeff: None,
                        shrinkage: None,
                    },
                    code_reference: "IS 800:2007".to_string(),
                },
            );
        }

        // EN 1992 concrete grades
        for (grade, fck) in [
            ("C20/25", 20e6_f64), ("C25/30", 25e6_f64), ("C30/37", 30e6_f64),
            ("C35/45", 35e6_f64), ("C40/50", 40e6_f64), ("C45/55", 45e6_f64),
        ] {
            self.cache.insert(
                MaterialKey {
                    code: "EN1992".to_string(),
                    grade: grade.to_string(),
                    variant: "normal".to_string(),
                },
                CachedMaterial {
                    name: format!("{} Concrete (EN 1992)", grade),
                    material_type: "Concrete".to_string(),
                    properties: MaterialProperties {
                        e_modulus: 22000.0 * ((fck / 1e6 + 8.0) / 10.0).powf(0.3) * 1e6,
                        g_modulus: 22000.0 * ((fck / 1e6 + 8.0) / 10.0).powf(0.3) * 1e6 / 2.4,
                        poisson_ratio: 0.2,
                        fy: None,
                        fu: None,
                        fck: Some(fck),
                        fcd: Some(fck / 1.5),
                        fcm: Some(fck + 8e6),
                        density: 25000.0,
                        thermal_coeff: 10e-6,
                        creep_coeff: Some(2.0),
                        shrinkage: Some(0.0003),
                    },
                    code_reference: "EN 1992-1-1".to_string(),
                },
            );
        }
    }

    pub fn stats(&self) -> CacheStats {
        self.cache.stats()
    }
}

impl Default for MaterialCache {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// SOLVER RESULT MEMOIZATION
// ============================================================================

/// Cache key for solver results
#[derive(Debug, Clone, Hash, PartialEq, Eq)]
pub struct SolverKey {
    /// Hash of model geometry
    pub geometry_hash: u64,
    /// Hash of loading
    pub loading_hash: u64,
    /// Analysis type
    pub analysis_type: String,
    /// Solver settings hash
    pub settings_hash: u64,
}

/// Cached solver results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CachedSolverResult {
    pub displacements: Vec<f64>,
    pub reactions: Vec<f64>,
    pub member_forces: Vec<MemberForceResult>,
    pub eigen_values: Option<Vec<f64>>,
    pub convergence_info: ConvergenceInfo,
    pub computed_at: String,
    pub computation_time_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemberForceResult {
    pub element_id: String,
    pub axial: f64,
    pub shear_y: f64,
    pub shear_z: f64,
    pub moment_y: f64,
    pub moment_z: f64,
    pub torsion: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvergenceInfo {
    pub converged: bool,
    pub iterations: usize,
    pub residual: f64,
    pub tolerance: f64,
}

/// Solver result cache with incremental invalidation
pub struct SolverCache {
    cache: Arc<RwLock<HashMap<SolverKey, CachedSolverResult>>>,
    max_entries: usize,
}

impl SolverCache {
    pub fn new(max_entries: usize) -> Self {
        Self {
            cache: Arc::new(RwLock::new(HashMap::with_capacity(max_entries))),
            max_entries,
        }
    }

    pub fn get(&self, key: &SolverKey) -> Option<CachedSolverResult> {
        self.cache.read().ok()?.get(key).cloned()
    }

    pub fn insert(&self, key: SolverKey, result: CachedSolverResult) {
        if let Ok(mut cache) = self.cache.write() {
            // Evict oldest if at capacity
            if cache.len() >= self.max_entries {
                // Simple eviction: remove first key (not truly LRU but simple)
                if let Some(first_key) = cache.keys().next().cloned() {
                    cache.remove(&first_key);
                }
            }
            cache.insert(key, result);
        }
    }

    /// Invalidate results for changed geometry
    pub fn invalidate_geometry(&self, geometry_hash: u64) {
        if let Ok(mut cache) = self.cache.write() {
            cache.retain(|k, _| k.geometry_hash != geometry_hash);
        }
    }

    /// Invalidate results for changed loading
    pub fn invalidate_loading(&self, loading_hash: u64) {
        if let Ok(mut cache) = self.cache.write() {
            cache.retain(|k, _| k.loading_hash != loading_hash);
        }
    }

    /// Clear all cached results
    pub fn clear(&self) {
        if let Ok(mut cache) = self.cache.write() {
            cache.clear();
        }
    }

    pub fn len(&self) -> usize {
        self.cache.read().map(|c| c.len()).unwrap_or(0)
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }
}

// ============================================================================
// BACKGROUND COMPUTATION MANAGER
// ============================================================================

/// Status of background computation
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ComputationStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Background computation task
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComputationTask {
    pub id: String,
    pub task_type: String,
    pub status: ComputationStatus,
    pub progress: f64,
    pub message: String,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
    pub result_key: Option<String>,
}

/// Background computation manager
pub struct ComputationManager {
    tasks: RwLock<HashMap<String, ComputationTask>>,
    max_concurrent: usize,
}

impl ComputationManager {
    pub fn new(max_concurrent: usize) -> Self {
        Self {
            tasks: RwLock::new(HashMap::new()),
            max_concurrent,
        }
    }

    /// Submit a new computation task
    pub fn submit(&self, task_type: &str, description: &str) -> String {
        let id = format!("TASK-{:08X}", rand_u32());
        
        let task = ComputationTask {
            id: id.clone(),
            task_type: task_type.to_string(),
            status: ComputationStatus::Pending,
            progress: 0.0,
            message: description.to_string(),
            created_at: chrono_lite_now(),
            started_at: None,
            completed_at: None,
            result_key: None,
        };

        if let Ok(mut tasks) = self.tasks.write() {
            tasks.insert(id.clone(), task);
        }

        id
    }

    /// Update task progress
    pub fn update_progress(&self, id: &str, progress: f64, message: &str) {
        if let Ok(mut tasks) = self.tasks.write() {
            if let Some(task) = tasks.get_mut(id) {
                task.progress = progress.min(1.0).max(0.0);
                task.message = message.to_string();
                
                if task.status == ComputationStatus::Pending {
                    task.status = ComputationStatus::Running;
                    task.started_at = Some(chrono_lite_now());
                }
            }
        }
    }

    /// Mark task as completed
    pub fn complete(&self, id: &str, result_key: Option<String>) {
        if let Ok(mut tasks) = self.tasks.write() {
            if let Some(task) = tasks.get_mut(id) {
                task.status = ComputationStatus::Completed;
                task.progress = 1.0;
                task.completed_at = Some(chrono_lite_now());
                task.result_key = result_key;
            }
        }
    }

    /// Mark task as failed
    pub fn fail(&self, id: &str, error: &str) {
        if let Ok(mut tasks) = self.tasks.write() {
            if let Some(task) = tasks.get_mut(id) {
                task.status = ComputationStatus::Failed;
                task.message = format!("Error: {}", error);
                task.completed_at = Some(chrono_lite_now());
            }
        }
    }

    /// Cancel a pending/running task
    pub fn cancel(&self, id: &str) -> bool {
        if let Ok(mut tasks) = self.tasks.write() {
            if let Some(task) = tasks.get_mut(id) {
                if task.status == ComputationStatus::Pending 
                    || task.status == ComputationStatus::Running 
                {
                    task.status = ComputationStatus::Cancelled;
                    task.completed_at = Some(chrono_lite_now());
                    return true;
                }
            }
        }
        false
    }

    /// Get task status
    pub fn get_task(&self, id: &str) -> Option<ComputationTask> {
        self.tasks.read().ok()?.get(id).cloned()
    }

    /// Get all tasks
    pub fn list_tasks(&self) -> Vec<ComputationTask> {
        self.tasks.read()
            .map(|t| t.values().cloned().collect())
            .unwrap_or_default()
    }

    /// Get running task count
    pub fn running_count(&self) -> usize {
        self.tasks.read()
            .map(|t| t.values()
                .filter(|task| task.status == ComputationStatus::Running)
                .count())
            .unwrap_or(0)
    }

    /// Check if can accept new task
    pub fn can_accept(&self) -> bool {
        self.running_count() < self.max_concurrent
    }

    /// Clean up completed tasks older than given duration
    pub fn cleanup_old_tasks(&self, _max_age_secs: u64) {
        // Simplified: just keep recent 100 tasks
        if let Ok(mut tasks) = self.tasks.write() {
            if tasks.len() > 100 {
                let completed: Vec<_> = tasks.iter()
                    .filter(|(_, t)| t.status == ComputationStatus::Completed 
                                  || t.status == ComputationStatus::Failed
                                  || t.status == ComputationStatus::Cancelled)
                    .map(|(k, _)| k.clone())
                    .take(tasks.len() - 50)
                    .collect();
                
                for key in completed {
                    tasks.remove(&key);
                }
            }
        }
    }
}

/// Simple random u32 generator (no external deps)
fn rand_u32() -> u32 {
    use std::time::SystemTime;
    let seed = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0) as u32;
    
    // Simple xorshift
    let mut x = seed;
    x ^= x << 13;
    x ^= x >> 17;
    x ^= x << 5;
    x
}

// ============================================================================
// GLOBAL CACHE MANAGER
// ============================================================================

/// Unified cache manager for the application
pub struct CacheManager {
    pub spectrum_cache: SpectrumCache,
    pub material_cache: MaterialCache,
    pub solver_cache: SolverCache,
    pub computation_manager: ComputationManager,
}

impl CacheManager {
    pub fn new() -> Self {
        Self {
            spectrum_cache: SpectrumCache::new(100),
            material_cache: MaterialCache::new(),
            solver_cache: SolverCache::new(50),
            computation_manager: ComputationManager::new(4),
        }
    }

    /// Get overall cache statistics
    pub fn stats(&self) -> CacheManagerStats {
        CacheManagerStats {
            spectrum_stats: self.spectrum_cache.stats(),
            material_stats: self.material_cache.stats(),
            solver_entries: self.solver_cache.len(),
            active_computations: self.computation_manager.running_count(),
        }
    }

    /// Clear all caches
    pub fn clear_all(&self) {
        self.solver_cache.clear();
        // Spectrum and material caches keep their preloaded data
    }
}

impl Default for CacheManager {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheManagerStats {
    pub spectrum_stats: CacheStats,
    pub material_stats: CacheStats,
    pub solver_entries: usize,
    pub active_computations: usize,
}

// ============================================================================
// TESTS
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lru_cache_basic() {
        let cache: LruCache<String, i32> = LruCache::new(3);
        
        cache.insert("a".to_string(), 1);
        cache.insert("b".to_string(), 2);
        cache.insert("c".to_string(), 3);
        
        assert_eq!(cache.get(&"a".to_string()), Some(1));
        assert_eq!(cache.get(&"b".to_string()), Some(2));
        assert_eq!(cache.len(), 3);
        
        // Adding 4th should evict oldest
        cache.insert("d".to_string(), 4);
        // "a" was accessed, so "b" should be evicted
        assert_eq!(cache.len(), 3);
    }

    #[test]
    fn test_lru_cache_eviction() {
        let cache: LruCache<i32, i32> = LruCache::new(2);
        
        cache.insert(1, 10);
        cache.insert(2, 20);
        
        // Access 1 to make it most recently used
        cache.get(&1);
        
        // Insert 3, should evict 2
        cache.insert(3, 30);
        
        assert_eq!(cache.get(&1), Some(10));
        assert_eq!(cache.get(&2), None);
        assert_eq!(cache.get(&3), Some(30));
    }

    #[test]
    fn test_spectrum_cache() {
        let cache = SpectrumCache::new(10);
        
        let key = SpectrumKey::new("IS1893:2016", "II", 0.24, 1.5, 0.05);
        
        // Should not exist initially
        assert!(cache.get(&key).is_none());
        
        // Create and insert spectrum
        let spectrum = CachedSpectrum {
            periods: vec![0.0, 0.5, 1.0, 2.0],
            accelerations: vec![0.1, 0.25, 0.2, 0.1],
            velocities: vec![],
            displacements: vec![],
            metadata: SpectrumMetadata {
                code_reference: "IS 1893:2016".to_string(),
                computed_at: "2025-01-01".to_string(),
                parameters: HashMap::new(),
            },
        };
        
        cache.insert(key.clone(), spectrum);
        
        // Should exist now
        assert!(cache.get(&key).is_some());
    }

    #[test]
    fn test_material_cache() {
        let cache = MaterialCache::new();
        
        // Should have preloaded common materials
        let key = MaterialKey {
            code: "IS456".to_string(),
            grade: "M30".to_string(),
            variant: "normal".to_string(),
        };
        
        let material = cache.get(&key);
        assert!(material.is_some());
        
        let mat = material.unwrap();
        assert!(mat.properties.fck.unwrap() > 0.0);
    }

    #[test]
    fn test_computation_manager() {
        let manager = ComputationManager::new(2);
        
        // Submit task
        let id = manager.submit("analysis", "Running modal analysis");
        
        // Check initial status
        let task = manager.get_task(&id).unwrap();
        assert_eq!(task.status, ComputationStatus::Pending);
        
        // Update progress
        manager.update_progress(&id, 0.5, "50% complete");
        let task = manager.get_task(&id).unwrap();
        assert_eq!(task.status, ComputationStatus::Running);
        assert!((task.progress - 0.5).abs() < 0.01);
        
        // Complete
        manager.complete(&id, Some("result-key".to_string()));
        let task = manager.get_task(&id).unwrap();
        assert_eq!(task.status, ComputationStatus::Completed);
    }

    #[test]
    fn test_cache_manager() {
        let manager = CacheManager::new();
        
        let stats = manager.stats();
        assert!(stats.material_stats.total_entries > 0); // Should have preloaded materials
    }
}
