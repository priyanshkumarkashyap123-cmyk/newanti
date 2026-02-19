//! Background Job Queue and Worker System
//!
//! Production-grade async job queue for:
//! - Long-running analyses (>10s)
//! - Batch processing of multiple models
//! - Priority scheduling (urgent jobs first)
//! - Progress tracking with WebSocket updates
//! - Result caching
//! - Automatic retry on failure

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{BinaryHeap, HashMap};
use std::cmp::Ordering;
use std::sync::Arc;
use tokio::sync::{mpsc, Mutex, RwLock};
use uuid::Uuid;

/// Job priority levels
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum JobPriority {
    Low = 0,
    Normal = 1,
    High = 2,
    Urgent = 3,
}

impl Ord for JobPriority {
    fn cmp(&self, other: &Self) -> Ordering {
        (*self as u8).cmp(&(*other as u8))
    }
}

impl PartialOrd for JobPriority {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Current state of a job
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum JobStatus {
    Queued,
    Running,
    Completed,
    Failed,
    Cancelled,
}

/// Type of analysis job
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum JobType {
    StaticAnalysis,
    ModalAnalysis,
    PDeltaAnalysis,
    SeismicAnalysis,
    TimeHistoryAnalysis,
    BucklingAnalysis,
    DesignCheck,
    BatchAnalysis { model_count: usize },
}

/// A single analysis job
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: String,
    pub job_type: JobType,
    pub priority: JobPriority,
    pub status: JobStatus,
    pub progress: f64,           // 0.0 to 1.0
    pub message: String,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub user_id: String,
    pub input_data: serde_json::Value,
    pub result_data: Option<serde_json::Value>,
    pub error: Option<String>,
    pub retry_count: u32,
    pub max_retries: u32,
}

/// Priority queue wrapper for jobs
#[derive(Debug)]
struct PrioritizedJob {
    priority: JobPriority,
    created_at: DateTime<Utc>,
    job_id: String,
}

impl Eq for PrioritizedJob {}

impl PartialEq for PrioritizedJob {
    fn eq(&self, other: &Self) -> bool {
        self.job_id == other.job_id
    }
}

impl Ord for PrioritizedJob {
    fn cmp(&self, other: &Self) -> Ordering {
        self.priority.cmp(&other.priority)
            .then_with(|| other.created_at.cmp(&self.created_at)) // Earlier jobs first at same priority
    }
}

impl PartialOrd for PrioritizedJob {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

/// Job Queue System
pub struct JobQueue {
    jobs: Arc<RwLock<HashMap<String, Job>>>,
    queue: Arc<Mutex<BinaryHeap<PrioritizedJob>>>,
    max_concurrent: usize,
    running_count: Arc<std::sync::atomic::AtomicUsize>,
    progress_tx: mpsc::UnboundedSender<JobProgressEvent>,
}

/// Progress event for WebSocket broadcasting
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobProgressEvent {
    pub job_id: String,
    pub status: JobStatus,
    pub progress: f64,
    pub message: String,
    pub timestamp: DateTime<Utc>,
}

/// Summary of queue state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QueueStatus {
    pub queued: usize,
    pub running: usize,
    pub completed: usize,
    pub failed: usize,
    pub total: usize,
}

impl JobQueue {
    /// Create a new job queue with progress channel
    pub fn new(max_concurrent: usize) -> (Self, mpsc::UnboundedReceiver<JobProgressEvent>) {
        let (tx, rx) = mpsc::unbounded_channel();

        let queue = Self {
            jobs: Arc::new(RwLock::new(HashMap::new())),
            queue: Arc::new(Mutex::new(BinaryHeap::new())),
            max_concurrent,
            running_count: Arc::new(std::sync::atomic::AtomicUsize::new(0)),
            progress_tx: tx,
        };

        (queue, rx)
    }

    /// Submit a new job to the queue
    pub async fn submit(
        &self,
        job_type: JobType,
        priority: JobPriority,
        user_id: String,
        input_data: serde_json::Value,
    ) -> String {
        let job_id = Uuid::new_v4().to_string();
        let now = Utc::now();

        let job = Job {
            id: job_id.clone(),
            job_type,
            priority,
            status: JobStatus::Queued,
            progress: 0.0,
            message: "Queued for processing".into(),
            created_at: now,
            started_at: None,
            completed_at: None,
            user_id,
            input_data,
            result_data: None,
            error: None,
            retry_count: 0,
            max_retries: 3,
        };

        // Store job
        self.jobs.write().await.insert(job_id.clone(), job);

        // Add to priority queue
        self.queue.lock().await.push(PrioritizedJob {
            priority,
            created_at: now,
            job_id: job_id.clone(),
        });

        // Send progress event
        let _ = self.progress_tx.send(JobProgressEvent {
            job_id: job_id.clone(),
            status: JobStatus::Queued,
            progress: 0.0,
            message: "Job queued".into(),
            timestamp: now,
        });

        job_id
    }

    /// Get job status
    pub async fn get_job(&self, job_id: &str) -> Option<Job> {
        self.jobs.read().await.get(job_id).cloned()
    }

    /// Get all jobs for a user
    pub async fn get_user_jobs(&self, user_id: &str) -> Vec<Job> {
        self.jobs.read().await.values()
            .filter(|j| j.user_id == user_id)
            .cloned()
            .collect()
    }

    /// Cancel a job
    pub async fn cancel(&self, job_id: &str) -> bool {
        let mut jobs = self.jobs.write().await;
        if let Some(job) = jobs.get_mut(job_id) {
            if job.status == JobStatus::Queued || job.status == JobStatus::Running {
                job.status = JobStatus::Cancelled;
                job.message = "Cancelled by user".into();
                job.completed_at = Some(Utc::now());

                let _ = self.progress_tx.send(JobProgressEvent {
                    job_id: job_id.to_string(),
                    status: JobStatus::Cancelled,
                    progress: job.progress,
                    message: "Cancelled".into(),
                    timestamp: Utc::now(),
                });
                return true;
            }
        }
        false
    }

    /// Dequeue next job (called by workers)
    pub async fn dequeue(&self) -> Option<Job> {
        let current = self.running_count.load(std::sync::atomic::Ordering::SeqCst);
        if current >= self.max_concurrent {
            return None;
        }

        let mut queue = self.queue.lock().await;
        while let Some(pj) = queue.pop() {
            let mut jobs = self.jobs.write().await;
            if let Some(job) = jobs.get_mut(&pj.job_id) {
                if job.status == JobStatus::Queued {
                    job.status = JobStatus::Running;
                    job.started_at = Some(Utc::now());
                    job.message = "Analysis in progress...".into();
                    self.running_count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);

                    let _ = self.progress_tx.send(JobProgressEvent {
                        job_id: pj.job_id.clone(),
                        status: JobStatus::Running,
                        progress: 0.0,
                        message: "Started".into(),
                        timestamp: Utc::now(),
                    });

                    return Some(job.clone());
                }
            }
        }
        None
    }

    /// Update job progress (called from worker)
    pub async fn update_progress(&self, job_id: &str, progress: f64, message: &str) {
        let mut jobs = self.jobs.write().await;
        if let Some(job) = jobs.get_mut(job_id) {
            job.progress = progress.clamp(0.0, 1.0);
            job.message = message.to_string();

            let _ = self.progress_tx.send(JobProgressEvent {
                job_id: job_id.to_string(),
                status: JobStatus::Running,
                progress: job.progress,
                message: message.to_string(),
                timestamp: Utc::now(),
            });
        }
    }

    /// Mark job as completed
    pub async fn complete(&self, job_id: &str, result: serde_json::Value) {
        let mut jobs = self.jobs.write().await;
        if let Some(job) = jobs.get_mut(job_id) {
            job.status = JobStatus::Completed;
            job.progress = 1.0;
            job.message = "Analysis complete".into();
            job.completed_at = Some(Utc::now());
            job.result_data = Some(result);
            self.running_count.fetch_sub(1, std::sync::atomic::Ordering::SeqCst);

            let _ = self.progress_tx.send(JobProgressEvent {
                job_id: job_id.to_string(),
                status: JobStatus::Completed,
                progress: 1.0,
                message: "Complete".into(),
                timestamp: Utc::now(),
            });
        }
    }

    /// Mark job as failed (with optional retry)
    pub async fn fail(&self, job_id: &str, error: &str) {
        let mut jobs = self.jobs.write().await;
        if let Some(job) = jobs.get_mut(job_id) {
            self.running_count.fetch_sub(1, std::sync::atomic::Ordering::SeqCst);

            if job.retry_count < job.max_retries {
                // Retry
                job.retry_count += 1;
                job.status = JobStatus::Queued;
                job.message = format!("Retrying ({}/{}): {}", job.retry_count, job.max_retries, error);

                // Re-queue (need queue lock separately)
                let pj = PrioritizedJob {
                    priority: job.priority,
                    created_at: job.created_at,
                    job_id: job_id.to_string(),
                };
                // We can't acquire queue lock while holding jobs lock, so we'll do it after
                drop(jobs);
                self.queue.lock().await.push(pj);
            } else {
                job.status = JobStatus::Failed;
                job.error = Some(error.to_string());
                job.message = format!("Failed after {} retries: {}", job.max_retries, error);
                job.completed_at = Some(Utc::now());

                let _ = self.progress_tx.send(JobProgressEvent {
                    job_id: job_id.to_string(),
                    status: JobStatus::Failed,
                    progress: job.progress,
                    message: format!("Failed: {}", error),
                    timestamp: Utc::now(),
                });
            }
        }
    }

    /// Get queue status summary
    pub async fn status(&self) -> QueueStatus {
        let jobs = self.jobs.read().await;
        let mut queued = 0;
        let mut running = 0;
        let mut completed = 0;
        let mut failed = 0;

        for job in jobs.values() {
            match job.status {
                JobStatus::Queued => queued += 1,
                JobStatus::Running => running += 1,
                JobStatus::Completed => completed += 1,
                JobStatus::Failed | JobStatus::Cancelled => failed += 1,
            }
        }

        QueueStatus {
            queued,
            running,
            completed,
            failed,
            total: jobs.len(),
        }
    }

    /// Clean up old completed/failed jobs (older than specified hours)
    pub async fn cleanup(&self, max_age_hours: i64) {
        let cutoff = Utc::now() - chrono::Duration::hours(max_age_hours);
        let mut jobs = self.jobs.write().await;
        jobs.retain(|_, job| {
            match job.status {
                JobStatus::Completed | JobStatus::Failed | JobStatus::Cancelled => {
                    job.completed_at.map(|t| t > cutoff).unwrap_or(true)
                }
                _ => true,
            }
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_submit_and_dequeue() {
        let (queue, _rx) = JobQueue::new(4);

        let job_id = queue.submit(
            JobType::StaticAnalysis,
            JobPriority::Normal,
            "user1".into(),
            serde_json::json!({"test": true}),
        ).await;

        assert!(!job_id.is_empty());

        let job = queue.dequeue().await.unwrap();
        assert_eq!(job.id, job_id);
        assert_eq!(job.status, JobStatus::Running);
    }

    #[tokio::test]
    async fn test_priority_ordering() {
        let (queue, _rx) = JobQueue::new(4);

        let low_id = queue.submit(
            JobType::StaticAnalysis, JobPriority::Low,
            "user1".into(), serde_json::json!({}),
        ).await;

        let high_id = queue.submit(
            JobType::ModalAnalysis, JobPriority::High,
            "user1".into(), serde_json::json!({}),
        ).await;

        // High priority should dequeue first
        let first = queue.dequeue().await.unwrap();
        assert_eq!(first.id, high_id);
    }

    #[tokio::test]
    async fn test_completion() {
        let (queue, _rx) = JobQueue::new(4);

        let job_id = queue.submit(
            JobType::StaticAnalysis, JobPriority::Normal,
            "user1".into(), serde_json::json!({}),
        ).await;

        let _ = queue.dequeue().await;
        queue.update_progress(&job_id, 0.5, "Assembling stiffness matrix").await;
        queue.complete(&job_id, serde_json::json!({"success": true})).await;

        let job = queue.get_job(&job_id).await.unwrap();
        assert_eq!(job.status, JobStatus::Completed);
        assert!(job.result_data.is_some());
    }

    #[tokio::test]
    async fn test_queue_status() {
        let (queue, _rx) = JobQueue::new(4);

        queue.submit(JobType::StaticAnalysis, JobPriority::Normal, "u1".into(), serde_json::json!({})).await;
        queue.submit(JobType::ModalAnalysis, JobPriority::High, "u1".into(), serde_json::json!({})).await;

        let status = queue.status().await;
        assert_eq!(status.queued, 2);
        assert_eq!(status.total, 2);
    }
}
