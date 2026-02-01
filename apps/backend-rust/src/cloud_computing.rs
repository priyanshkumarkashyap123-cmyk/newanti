//! Cloud Computing Integration Module
//!
//! Distributed structural analysis and cloud resource management.
//! Based on: AWS HPC, Azure Batch, containerized workloads
//!
//! Features:
//! - Job scheduling and distribution
//! - Result aggregation
//! - Resource monitoring
//! - Checkpointing and recovery

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Cloud provider
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CloudProvider {
    /// Amazon Web Services
    AWS,
    /// Microsoft Azure
    Azure,
    /// Google Cloud Platform
    GCP,
    /// On-premise HPC
    OnPremise,
    /// Local (no cloud)
    Local,
}

/// Job status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum JobStatus {
    /// Pending in queue
    Pending,
    /// Currently running
    Running,
    /// Completed successfully
    Completed,
    /// Failed with error
    Failed,
    /// Cancelled by user
    Cancelled,
    /// Paused/suspended
    Paused,
}

/// Compute resource type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResourceType {
    /// CPU compute
    CPU,
    /// GPU compute
    GPU,
    /// High memory
    HighMemory,
    /// General purpose
    GeneralPurpose,
}

/// Analysis job definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisJob {
    /// Job ID
    pub id: String,
    /// Job name
    pub name: String,
    /// Analysis type
    pub analysis_type: AnalysisType,
    /// Model data (serialized)
    pub model_data: String,
    /// Job parameters
    pub parameters: JobParameters,
    /// Current status
    pub status: JobStatus,
    /// Progress (0-100)
    pub progress: f64,
    /// Priority (1-10)
    pub priority: u8,
    /// Created timestamp
    pub created_at: u64,
    /// Started timestamp
    pub started_at: Option<u64>,
    /// Completed timestamp
    pub completed_at: Option<u64>,
    /// Error message if failed
    pub error: Option<String>,
}

/// Analysis type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnalysisType {
    /// Linear static
    LinearStatic,
    /// Nonlinear static
    NonlinearStatic,
    /// Modal analysis
    Modal,
    /// Time history
    TimeHistory,
    /// Response spectrum
    ResponseSpectrum,
    /// Buckling
    Buckling,
    /// Topology optimization
    TopologyOptimization,
    /// Parametric study
    ParametricStudy,
}

/// Job parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobParameters {
    /// Number of CPUs requested
    pub n_cpus: usize,
    /// Memory in GB
    pub memory_gb: f64,
    /// Maximum runtime in seconds
    pub max_runtime: u64,
    /// Resource type
    pub resource_type: ResourceType,
    /// Enable checkpointing
    pub checkpointing: bool,
    /// Checkpoint interval (seconds)
    pub checkpoint_interval: u64,
    /// Custom parameters
    pub custom: HashMap<String, String>,
}

impl JobParameters {
    /// Default parameters for small job
    pub fn small() -> Self {
        Self {
            n_cpus: 2,
            memory_gb: 4.0,
            max_runtime: 3600, // 1 hour
            resource_type: ResourceType::GeneralPurpose,
            checkpointing: false,
            checkpoint_interval: 600,
            custom: HashMap::new(),
        }
    }
    
    /// Default parameters for medium job
    pub fn medium() -> Self {
        Self {
            n_cpus: 8,
            memory_gb: 32.0,
            max_runtime: 14400, // 4 hours
            resource_type: ResourceType::CPU,
            checkpointing: true,
            checkpoint_interval: 300,
            custom: HashMap::new(),
        }
    }
    
    /// Default parameters for large job
    pub fn large() -> Self {
        Self {
            n_cpus: 32,
            memory_gb: 128.0,
            max_runtime: 86400, // 24 hours
            resource_type: ResourceType::HighMemory,
            checkpointing: true,
            checkpoint_interval: 180,
            custom: HashMap::new(),
        }
    }
}

/// Job result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobResult {
    /// Job ID
    pub job_id: String,
    /// Result status
    pub status: JobStatus,
    /// Result data (serialized)
    pub result_data: Option<String>,
    /// Runtime in seconds
    pub runtime: f64,
    /// Peak memory usage (GB)
    pub peak_memory: f64,
    /// Number of iterations (if applicable)
    pub iterations: Option<usize>,
    /// Convergence achieved
    pub converged: bool,
    /// Output files
    pub output_files: Vec<OutputFile>,
    /// Metrics
    pub metrics: JobMetrics,
}

/// Output file reference
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutputFile {
    /// File name
    pub name: String,
    /// File path/URL
    pub path: String,
    /// File size in bytes
    pub size: usize,
    /// MIME type
    pub mime_type: String,
}

/// Job metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobMetrics {
    /// Total CPU time (seconds)
    pub cpu_time: f64,
    /// Wall clock time (seconds)
    pub wall_time: f64,
    /// Parallel efficiency
    pub parallel_efficiency: f64,
    /// I/O time (seconds)
    pub io_time: f64,
    /// Communication time (seconds)
    pub comm_time: f64,
}

/// Job scheduler
#[derive(Debug, Clone)]
pub struct JobScheduler {
    /// Cloud provider
    pub provider: CloudProvider,
    /// Job queue
    pub queue: Vec<AnalysisJob>,
    /// Running jobs
    pub running: HashMap<String, AnalysisJob>,
    /// Completed jobs
    pub completed: HashMap<String, JobResult>,
    /// Max concurrent jobs
    pub max_concurrent: usize,
}

impl JobScheduler {
    /// Create new job scheduler
    pub fn new(provider: CloudProvider) -> Self {
        Self {
            provider,
            queue: Vec::new(),
            running: HashMap::new(),
            completed: HashMap::new(),
            max_concurrent: 10,
        }
    }
    
    /// Submit new job
    pub fn submit(&mut self, job: AnalysisJob) -> String {
        let job_id = job.id.clone();
        self.queue.push(job);
        self.schedule_next();
        job_id
    }
    
    /// Schedule next job from queue
    fn schedule_next(&mut self) {
        if self.running.len() >= self.max_concurrent {
            return;
        }
        
        // Sort by priority
        self.queue.sort_by(|a, b| b.priority.cmp(&a.priority));
        
        if let Some(mut job) = self.queue.pop() {
            job.status = JobStatus::Running;
            job.started_at = Some(Self::current_timestamp());
            self.running.insert(job.id.clone(), job);
        }
    }
    
    /// Get job status
    pub fn get_status(&self, job_id: &str) -> Option<JobStatus> {
        if let Some(job) = self.running.get(job_id) {
            return Some(job.status);
        }
        if let Some(result) = self.completed.get(job_id) {
            return Some(result.status);
        }
        self.queue.iter().find(|j| j.id == job_id).map(|j| j.status)
    }
    
    /// Cancel job
    pub fn cancel(&mut self, job_id: &str) -> bool {
        // Remove from queue
        if let Some(pos) = self.queue.iter().position(|j| j.id == job_id) {
            self.queue.remove(pos);
            return true;
        }
        
        // Cancel running job
        if let Some(mut job) = self.running.remove(job_id) {
            job.status = JobStatus::Cancelled;
            job.completed_at = Some(Self::current_timestamp());
            self.completed.insert(job_id.to_string(), JobResult {
                job_id: job_id.to_string(),
                status: JobStatus::Cancelled,
                result_data: None,
                runtime: 0.0,
                peak_memory: 0.0,
                iterations: None,
                converged: false,
                output_files: vec![],
                metrics: JobMetrics {
                    cpu_time: 0.0,
                    wall_time: 0.0,
                    parallel_efficiency: 0.0,
                    io_time: 0.0,
                    comm_time: 0.0,
                },
            });
            self.schedule_next();
            return true;
        }
        
        false
    }
    
    /// Complete job
    pub fn complete(&mut self, job_id: &str, result: JobResult) {
        if let Some(mut job) = self.running.remove(job_id) {
            job.status = result.status;
            job.completed_at = Some(Self::current_timestamp());
            self.completed.insert(job_id.to_string(), result);
            self.schedule_next();
        }
    }
    
    /// Get queue length
    pub fn queue_length(&self) -> usize {
        self.queue.len()
    }
    
    /// Get running count
    pub fn running_count(&self) -> usize {
        self.running.len()
    }
    
    fn current_timestamp() -> u64 {
        // Simplified timestamp
        1704067200 // 2024-01-01 00:00:00
    }
}

/// Resource manager
#[derive(Debug, Clone)]
pub struct ResourceManager {
    /// Available resources
    pub resources: Vec<ComputeResource>,
    /// Allocated jobs
    pub allocations: HashMap<String, String>, // job_id -> resource_id
}

/// Compute resource
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComputeResource {
    /// Resource ID
    pub id: String,
    /// Resource name
    pub name: String,
    /// Resource type
    pub resource_type: ResourceType,
    /// Total CPUs
    pub total_cpus: usize,
    /// Available CPUs
    pub available_cpus: usize,
    /// Total memory (GB)
    pub total_memory: f64,
    /// Available memory (GB)
    pub available_memory: f64,
    /// Status
    pub status: ResourceStatus,
}

/// Resource status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ResourceStatus {
    /// Available
    Available,
    /// Partially used
    PartiallyUsed,
    /// Fully utilized
    FullyUtilized,
    /// Offline
    Offline,
    /// Maintenance
    Maintenance,
}

impl ResourceManager {
    /// Create new resource manager
    pub fn new() -> Self {
        Self {
            resources: Vec::new(),
            allocations: HashMap::new(),
        }
    }
    
    /// Add compute resource
    pub fn add_resource(&mut self, resource: ComputeResource) {
        self.resources.push(resource);
    }
    
    /// Allocate resources for job
    pub fn allocate(&mut self, job_id: &str, params: &JobParameters) -> Option<String> {
        for resource in &mut self.resources {
            if resource.status == ResourceStatus::Offline || 
               resource.status == ResourceStatus::Maintenance {
                continue;
            }
            
            if resource.available_cpus >= params.n_cpus &&
               resource.available_memory >= params.memory_gb {
                resource.available_cpus -= params.n_cpus;
                resource.available_memory -= params.memory_gb;
                
                resource.status = if resource.available_cpus == 0 {
                    ResourceStatus::FullyUtilized
                } else {
                    ResourceStatus::PartiallyUsed
                };
                
                self.allocations.insert(job_id.to_string(), resource.id.clone());
                return Some(resource.id.clone());
            }
        }
        None
    }
    
    /// Release resources
    pub fn release(&mut self, job_id: &str, params: &JobParameters) {
        if let Some(resource_id) = self.allocations.remove(job_id) {
            if let Some(resource) = self.resources.iter_mut().find(|r| r.id == resource_id) {
                resource.available_cpus = (resource.available_cpus + params.n_cpus)
                    .min(resource.total_cpus);
                resource.available_memory = (resource.available_memory + params.memory_gb)
                    .min(resource.total_memory);
                
                if resource.available_cpus == resource.total_cpus {
                    resource.status = ResourceStatus::Available;
                } else {
                    resource.status = ResourceStatus::PartiallyUsed;
                }
            }
        }
    }
    
    /// Get total available CPUs
    pub fn total_available_cpus(&self) -> usize {
        self.resources.iter()
            .filter(|r| r.status != ResourceStatus::Offline && r.status != ResourceStatus::Maintenance)
            .map(|r| r.available_cpus)
            .sum()
    }
    
    /// Get utilization percentage
    pub fn utilization(&self) -> f64 {
        let total: usize = self.resources.iter().map(|r| r.total_cpus).sum();
        let available: usize = self.resources.iter().map(|r| r.available_cpus).sum();
        
        if total > 0 {
            100.0 * (1.0 - available as f64 / total as f64)
        } else {
            0.0
        }
    }
}

/// Checkpointing manager
#[derive(Debug, Clone)]
pub struct CheckpointManager {
    /// Checkpoint storage path
    pub storage_path: String,
    /// Checkpoints
    pub checkpoints: HashMap<String, Checkpoint>,
}

/// Checkpoint data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Checkpoint {
    /// Job ID
    pub job_id: String,
    /// Checkpoint ID
    pub checkpoint_id: String,
    /// Iteration number
    pub iteration: usize,
    /// State data (serialized)
    pub state_data: String,
    /// Timestamp
    pub timestamp: u64,
    /// Size in bytes
    pub size: usize,
}

impl CheckpointManager {
    /// Create new checkpoint manager
    pub fn new(storage_path: &str) -> Self {
        Self {
            storage_path: storage_path.to_string(),
            checkpoints: HashMap::new(),
        }
    }
    
    /// Save checkpoint
    pub fn save(&mut self, job_id: &str, iteration: usize, state_data: &str) -> String {
        let checkpoint_id = format!("{}_{}", job_id, iteration);
        let checkpoint = Checkpoint {
            job_id: job_id.to_string(),
            checkpoint_id: checkpoint_id.clone(),
            iteration,
            state_data: state_data.to_string(),
            timestamp: 1704067200 + iteration as u64,
            size: state_data.len(),
        };
        
        self.checkpoints.insert(checkpoint_id.clone(), checkpoint);
        checkpoint_id
    }
    
    /// Load latest checkpoint for job
    pub fn load_latest(&self, job_id: &str) -> Option<&Checkpoint> {
        self.checkpoints.values()
            .filter(|c| c.job_id == job_id)
            .max_by_key(|c| c.iteration)
    }
    
    /// Delete checkpoints for job
    pub fn delete_job_checkpoints(&mut self, job_id: &str) {
        self.checkpoints.retain(|_, v| v.job_id != job_id);
    }
    
    /// Get total checkpoint size
    pub fn total_size(&self) -> usize {
        self.checkpoints.values().map(|c| c.size).sum()
    }
}

/// Parametric study manager
#[derive(Debug, Clone)]
pub struct ParametricStudy {
    /// Study ID
    pub id: String,
    /// Study name
    pub name: String,
    /// Base model
    pub base_model: String,
    /// Parameters to vary
    pub parameters: Vec<StudyParameter>,
    /// Generated cases
    pub cases: Vec<StudyCase>,
    /// Results
    pub results: HashMap<String, StudyCaseResult>,
}

/// Study parameter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyParameter {
    /// Parameter name
    pub name: String,
    /// Parameter values
    pub values: Vec<f64>,
}

/// Study case
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyCase {
    /// Case ID
    pub id: String,
    /// Parameter values
    pub parameters: HashMap<String, f64>,
    /// Job ID (when submitted)
    pub job_id: Option<String>,
}

/// Study case result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StudyCaseResult {
    /// Case ID
    pub case_id: String,
    /// Output values
    pub outputs: HashMap<String, f64>,
    /// Status
    pub status: JobStatus,
}

impl ParametricStudy {
    /// Create new parametric study
    pub fn new(id: &str, name: &str, base_model: &str) -> Self {
        Self {
            id: id.to_string(),
            name: name.to_string(),
            base_model: base_model.to_string(),
            parameters: Vec::new(),
            cases: Vec::new(),
            results: HashMap::new(),
        }
    }
    
    /// Add parameter
    pub fn add_parameter(&mut self, name: &str, values: Vec<f64>) {
        self.parameters.push(StudyParameter {
            name: name.to_string(),
            values,
        });
    }
    
    /// Generate all cases (full factorial)
    pub fn generate_cases(&mut self) {
        self.cases.clear();
        
        if self.parameters.is_empty() {
            return;
        }
        
        let mut indices = vec![0usize; self.parameters.len()];
        let mut case_num = 0;
        
        loop {
            // Create case with current parameter combination
            let mut params = HashMap::new();
            for (i, param) in self.parameters.iter().enumerate() {
                if let Some(&val) = param.values.get(indices[i]) {
                    params.insert(param.name.clone(), val);
                }
            }
            
            self.cases.push(StudyCase {
                id: format!("{}_case_{}", self.id, case_num),
                parameters: params,
                job_id: None,
            });
            
            case_num += 1;
            
            // Increment indices
            let mut carry = true;
            for i in 0..indices.len() {
                if carry {
                    indices[i] += 1;
                    if indices[i] >= self.parameters[i].values.len() {
                        indices[i] = 0;
                    } else {
                        carry = false;
                    }
                }
            }
            
            if carry {
                break; // All combinations generated
            }
        }
    }
    
    /// Get number of cases
    pub fn case_count(&self) -> usize {
        self.cases.len()
    }
    
    /// Add result for case
    pub fn add_result(&mut self, case_id: &str, outputs: HashMap<String, f64>) {
        self.results.insert(case_id.to_string(), StudyCaseResult {
            case_id: case_id.to_string(),
            outputs,
            status: JobStatus::Completed,
        });
    }
    
    /// Get completion percentage
    pub fn completion(&self) -> f64 {
        if self.cases.is_empty() {
            return 0.0;
        }
        100.0 * self.results.len() as f64 / self.cases.len() as f64
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_job_parameters() {
        let small = JobParameters::small();
        assert_eq!(small.n_cpus, 2);
        assert_eq!(small.memory_gb, 4.0);
        
        let large = JobParameters::large();
        assert_eq!(large.n_cpus, 32);
        assert!(large.checkpointing);
    }
    
    #[test]
    fn test_job_scheduler() {
        let mut scheduler = JobScheduler::new(CloudProvider::Local);
        
        let job = AnalysisJob {
            id: "JOB001".to_string(),
            name: "Test Job".to_string(),
            analysis_type: AnalysisType::LinearStatic,
            model_data: "{}".to_string(),
            parameters: JobParameters::small(),
            status: JobStatus::Pending,
            progress: 0.0,
            priority: 5,
            created_at: 1704067200,
            started_at: None,
            completed_at: None,
            error: None,
        };
        
        let job_id = scheduler.submit(job);
        assert_eq!(scheduler.running_count(), 1);
        
        let status = scheduler.get_status(&job_id);
        assert_eq!(status, Some(JobStatus::Running));
    }
    
    #[test]
    fn test_job_cancellation() {
        let mut scheduler = JobScheduler::new(CloudProvider::AWS);
        
        let job = AnalysisJob {
            id: "JOB002".to_string(),
            name: "Cancel Test".to_string(),
            analysis_type: AnalysisType::Modal,
            model_data: "{}".to_string(),
            parameters: JobParameters::medium(),
            status: JobStatus::Pending,
            progress: 0.0,
            priority: 3,
            created_at: 1704067200,
            started_at: None,
            completed_at: None,
            error: None,
        };
        
        let job_id = scheduler.submit(job);
        let cancelled = scheduler.cancel(&job_id);
        
        assert!(cancelled);
        assert_eq!(scheduler.get_status(&job_id), Some(JobStatus::Cancelled));
    }
    
    #[test]
    fn test_resource_manager() {
        let mut manager = ResourceManager::new();
        
        manager.add_resource(ComputeResource {
            id: "RES001".to_string(),
            name: "Compute Node 1".to_string(),
            resource_type: ResourceType::CPU,
            total_cpus: 16,
            available_cpus: 16,
            total_memory: 64.0,
            available_memory: 64.0,
            status: ResourceStatus::Available,
        });
        
        let params = JobParameters::small();
        let allocated = manager.allocate("JOB001", &params);
        
        assert!(allocated.is_some());
        assert_eq!(manager.total_available_cpus(), 14);
    }
    
    #[test]
    fn test_resource_release() {
        let mut manager = ResourceManager::new();
        
        manager.add_resource(ComputeResource {
            id: "RES002".to_string(),
            name: "Compute Node 2".to_string(),
            resource_type: ResourceType::GeneralPurpose,
            total_cpus: 8,
            available_cpus: 8,
            total_memory: 32.0,
            available_memory: 32.0,
            status: ResourceStatus::Available,
        });
        
        let params = JobParameters::small();
        manager.allocate("JOB002", &params);
        manager.release("JOB002", &params);
        
        assert_eq!(manager.total_available_cpus(), 8);
    }
    
    #[test]
    fn test_checkpoint_manager() {
        let mut manager = CheckpointManager::new("/tmp/checkpoints");
        
        let cp_id = manager.save("JOB001", 100, "{\"state\": \"iteration_100\"}");
        assert!(!cp_id.is_empty());
        
        manager.save("JOB001", 200, "{\"state\": \"iteration_200\"}");
        
        let latest = manager.load_latest("JOB001");
        assert!(latest.is_some());
        assert_eq!(latest.unwrap().iteration, 200);
    }
    
    #[test]
    fn test_checkpoint_deletion() {
        let mut manager = CheckpointManager::new("/tmp/checkpoints");
        
        manager.save("JOB001", 100, "data1");
        manager.save("JOB001", 200, "data2");
        manager.save("JOB002", 100, "data3");
        
        manager.delete_job_checkpoints("JOB001");
        
        assert!(manager.load_latest("JOB001").is_none());
        assert!(manager.load_latest("JOB002").is_some());
    }
    
    #[test]
    fn test_parametric_study() {
        let mut study = ParametricStudy::new("STUDY001", "Beam Depth Study", "base_model");
        
        study.add_parameter("depth", vec![300.0, 400.0, 500.0]);
        study.add_parameter("width", vec![200.0, 250.0]);
        
        study.generate_cases();
        
        // Full factorial: 3 * 2 = 6 cases
        assert_eq!(study.case_count(), 6);
    }
    
    #[test]
    fn test_study_completion() {
        let mut study = ParametricStudy::new("STUDY002", "Test Study", "model");
        
        study.add_parameter("x", vec![1.0, 2.0]);
        study.generate_cases();
        
        assert_eq!(study.completion(), 0.0);
        
        study.add_result("STUDY002_case_0", HashMap::new());
        assert_eq!(study.completion(), 50.0);
        
        study.add_result("STUDY002_case_1", HashMap::new());
        assert_eq!(study.completion(), 100.0);
    }
    
    #[test]
    fn test_cloud_providers() {
        assert_ne!(CloudProvider::AWS, CloudProvider::Azure);
        assert_eq!(CloudProvider::Local, CloudProvider::Local);
    }
    
    #[test]
    fn test_analysis_types() {
        assert_ne!(AnalysisType::LinearStatic, AnalysisType::Modal);
        assert_eq!(AnalysisType::Buckling, AnalysisType::Buckling);
    }
    
    #[test]
    fn test_resource_utilization() {
        let mut manager = ResourceManager::new();
        
        manager.add_resource(ComputeResource {
            id: "RES003".to_string(),
            name: "Node".to_string(),
            resource_type: ResourceType::CPU,
            total_cpus: 10,
            available_cpus: 5,
            total_memory: 64.0,
            available_memory: 32.0,
            status: ResourceStatus::PartiallyUsed,
        });
        
        let util = manager.utilization();
        assert!((util - 50.0).abs() < 0.1);
    }
    
    #[test]
    fn test_job_metrics() {
        let metrics = JobMetrics {
            cpu_time: 100.0,
            wall_time: 30.0,
            parallel_efficiency: 0.83,
            io_time: 5.0,
            comm_time: 2.0,
        };
        
        assert!(metrics.parallel_efficiency > 0.8);
    }
}
