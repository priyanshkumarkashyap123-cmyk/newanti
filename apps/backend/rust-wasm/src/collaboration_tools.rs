//! Real-time Collaboration Tools Module
//!
//! Collaborative structural design and analysis features.
//! Based on: OT/CRDT algorithms, WebSocket protocols
//!
//! Features:
//! - Real-time model synchronization
//! - Change tracking and conflict resolution
//! - User session management
//! - Design review annotations

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// User role in collaboration
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum UserRole {
    /// Project owner
    Owner,
    /// Full edit access
    Editor,
    /// Review and comment only
    Reviewer,
    /// View only
    Viewer,
}

/// User session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSession {
    /// Session ID
    pub session_id: String,
    /// User ID
    pub user_id: String,
    /// Display name
    pub display_name: String,
    /// User role
    pub role: UserRole,
    /// Cursor position (element ID)
    pub cursor_position: Option<String>,
    /// Selected elements
    pub selection: Vec<String>,
    /// Color for highlighting
    pub color: String,
    /// Connection status
    pub connected: bool,
    /// Last activity timestamp
    pub last_activity: u64,
}

impl UserSession {
    /// Create new user session
    pub fn new(session_id: &str, user_id: &str, display_name: &str, role: UserRole) -> Self {
        Self {
            session_id: session_id.to_string(),
            user_id: user_id.to_string(),
            display_name: display_name.to_string(),
            role,
            cursor_position: None,
            selection: Vec::new(),
            color: Self::generate_color(user_id),
            connected: true,
            last_activity: Self::current_timestamp(),
        }
    }
    
    fn generate_color(user_id: &str) -> String {
        // Simple hash-based color generation
        let hash: u32 = user_id.bytes().fold(0u32, |acc, b| acc.wrapping_add(b as u32).wrapping_mul(31));
        format!("#{:06x}", hash % 0xFFFFFF)
    }
    
    fn current_timestamp() -> u64 {
        1704067200 // Fixed timestamp for deterministic testing
    }
    
    /// Update activity
    pub fn update_activity(&mut self) {
        self.last_activity = Self::current_timestamp();
    }
    
    /// Can edit
    pub fn can_edit(&self) -> bool {
        matches!(self.role, UserRole::Owner | UserRole::Editor)
    }
}

/// Operation type for collaborative editing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum OperationType {
    /// Insert element
    Insert {
        element_type: String,
        properties: HashMap<String, String>,
    },
    /// Delete element
    Delete {
        element_id: String,
    },
    /// Update element property
    Update {
        element_id: String,
        property: String,
        old_value: String,
        new_value: String,
    },
    /// Move element
    Move {
        element_id: String,
        new_position: (f64, f64, f64),
    },
}

/// Collaborative operation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Operation {
    /// Operation ID
    pub id: String,
    /// Operation type
    pub operation: OperationType,
    /// User who performed operation
    pub user_id: String,
    /// Timestamp
    pub timestamp: u64,
    /// Vector clock for ordering
    pub vector_clock: HashMap<String, u64>,
}

impl Operation {
    /// Create new operation
    pub fn new(id: &str, operation: OperationType, user_id: &str) -> Self {
        Self {
            id: id.to_string(),
            operation,
            user_id: user_id.to_string(),
            timestamp: 1704067200,
            vector_clock: HashMap::new(),
        }
    }
}

/// Operational Transformation engine
#[derive(Debug, Clone)]
pub struct OTEngine {
    /// Operation history
    pub history: Vec<Operation>,
    /// Pending operations (not yet acknowledged)
    pub pending: Vec<Operation>,
    /// Current vector clock
    pub clock: HashMap<String, u64>,
}

impl OTEngine {
    /// Create new OT engine
    pub fn new() -> Self {
        Self {
            history: Vec::new(),
            pending: Vec::new(),
            clock: HashMap::new(),
        }
    }
    
    /// Apply local operation
    pub fn apply_local(&mut self, mut operation: Operation) {
        // Increment clock for this user
        let count = self.clock.entry(operation.user_id.clone()).or_insert(0);
        *count += 1;
        operation.vector_clock = self.clock.clone();
        
        self.history.push(operation.clone());
        self.pending.push(operation);
    }
    
    /// Apply remote operation with transformation
    pub fn apply_remote(&mut self, operation: Operation) -> Operation {
        // Transform against concurrent operations
        let transformed = self.transform_operation(operation);
        
        // Update clock
        for (user, count) in &transformed.vector_clock {
            let current = self.clock.entry(user.clone()).or_insert(0);
            *current = (*current).max(*count);
        }
        
        self.history.push(transformed.clone());
        transformed
    }
    
    fn transform_operation(&self, op: Operation) -> Operation {
        // Simplified transformation - in production would need full OT algorithm
        let mut transformed = op;
        
        // Find concurrent operations and transform
        for history_op in &self.history {
            if self.is_concurrent(&transformed, history_op) {
                transformed = self.transform_pair(&transformed, history_op);
            }
        }
        
        transformed
    }
    
    fn is_concurrent(&self, op1: &Operation, op2: &Operation) -> bool {
        // Check if operations are concurrent using vector clocks
        let mut op1_before_op2 = false;
        let mut op2_before_op1 = false;
        
        for (user, &count) in &op1.vector_clock {
            if let Some(&other_count) = op2.vector_clock.get(user) {
                if count < other_count {
                    op2_before_op1 = true;
                } else if count > other_count {
                    op1_before_op2 = true;
                }
            }
        }
        
        !op1_before_op2 && !op2_before_op1
    }
    
    fn transform_pair(&self, op1: &Operation, _op2: &Operation) -> Operation {
        // Simplified - just return op1 unchanged
        // Real implementation would handle Insert/Delete conflicts
        op1.clone()
    }
    
    /// Acknowledge operation
    pub fn acknowledge(&mut self, op_id: &str) {
        self.pending.retain(|op| op.id != op_id);
    }
    
    /// Get pending operations
    pub fn get_pending(&self) -> &[Operation] {
        &self.pending
    }
}

/// Design annotation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Annotation {
    /// Annotation ID
    pub id: String,
    /// Associated element ID (optional)
    pub element_id: Option<String>,
    /// Position (x, y, z)
    pub position: (f64, f64, f64),
    /// Annotation type
    pub annotation_type: AnnotationType,
    /// Content
    pub content: String,
    /// Author
    pub author: String,
    /// Created timestamp
    pub created_at: u64,
    /// Status
    pub status: AnnotationStatus,
    /// Replies
    pub replies: Vec<AnnotationReply>,
}

/// Annotation type
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnnotationType {
    /// General comment
    Comment,
    /// Design question
    Question,
    /// Issue/problem
    Issue,
    /// Suggestion
    Suggestion,
    /// Approval
    Approval,
}

/// Annotation status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AnnotationStatus {
    /// Open
    Open,
    /// In progress
    InProgress,
    /// Resolved
    Resolved,
    /// Closed
    Closed,
}

/// Annotation reply
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnnotationReply {
    /// Reply ID
    pub id: String,
    /// Content
    pub content: String,
    /// Author
    pub author: String,
    /// Timestamp
    pub timestamp: u64,
}

impl Annotation {
    /// Create new annotation
    pub fn new(
        id: &str,
        position: (f64, f64, f64),
        annotation_type: AnnotationType,
        content: &str,
        author: &str,
    ) -> Self {
        Self {
            id: id.to_string(),
            element_id: None,
            position,
            annotation_type,
            content: content.to_string(),
            author: author.to_string(),
            created_at: 1704067200,
            status: AnnotationStatus::Open,
            replies: Vec::new(),
        }
    }
    
    /// Add reply
    pub fn add_reply(&mut self, id: &str, content: &str, author: &str) {
        self.replies.push(AnnotationReply {
            id: id.to_string(),
            content: content.to_string(),
            author: author.to_string(),
            timestamp: 1704067200,
        });
    }
    
    /// Resolve annotation
    pub fn resolve(&mut self) {
        self.status = AnnotationStatus::Resolved;
    }
}

/// Collaboration session manager
#[derive(Debug, Clone)]
pub struct CollaborationSession {
    /// Project ID
    pub project_id: String,
    /// Active users
    pub users: HashMap<String, UserSession>,
    /// OT engine
    pub ot_engine: OTEngine,
    /// Annotations
    pub annotations: Vec<Annotation>,
    /// Change log
    pub change_log: Vec<ChangeLogEntry>,
}

/// Change log entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeLogEntry {
    /// Entry ID
    pub id: String,
    /// Operation summary
    pub summary: String,
    /// User
    pub user: String,
    /// Timestamp
    pub timestamp: u64,
    /// Can be undone
    pub undoable: bool,
}

impl CollaborationSession {
    /// Create new collaboration session
    pub fn new(project_id: &str) -> Self {
        Self {
            project_id: project_id.to_string(),
            users: HashMap::new(),
            ot_engine: OTEngine::new(),
            annotations: Vec::new(),
            change_log: Vec::new(),
        }
    }
    
    /// Add user to session
    pub fn add_user(&mut self, session: UserSession) {
        self.users.insert(session.session_id.clone(), session);
    }
    
    /// Remove user from session
    pub fn remove_user(&mut self, session_id: &str) {
        self.users.remove(session_id);
    }
    
    /// Get active users
    pub fn active_users(&self) -> Vec<&UserSession> {
        self.users.values().filter(|u| u.connected).collect()
    }
    
    /// Apply operation
    pub fn apply_operation(&mut self, operation: Operation) {
        let user_name = self.users
            .values()
            .find(|u| u.user_id == operation.user_id)
            .map(|u| u.display_name.clone())
            .unwrap_or_else(|| "Unknown".to_string());
        
        let summary = match &operation.operation {
            OperationType::Insert { element_type, .. } => {
                format!("Added {} element", element_type)
            },
            OperationType::Delete { element_id } => {
                format!("Deleted element {}", element_id)
            },
            OperationType::Update { element_id, property, .. } => {
                format!("Updated {} of element {}", property, element_id)
            },
            OperationType::Move { element_id, .. } => {
                format!("Moved element {}", element_id)
            },
        };
        
        self.ot_engine.apply_local(operation.clone());
        
        self.change_log.push(ChangeLogEntry {
            id: operation.id.clone(),
            summary,
            user: user_name,
            timestamp: operation.timestamp,
            undoable: true,
        });
    }
    
    /// Add annotation
    pub fn add_annotation(&mut self, annotation: Annotation) {
        self.annotations.push(annotation);
    }
    
    /// Get open annotations
    pub fn open_annotations(&self) -> Vec<&Annotation> {
        self.annotations.iter()
            .filter(|a| a.status == AnnotationStatus::Open || a.status == AnnotationStatus::InProgress)
            .collect()
    }
    
    /// Update user cursor
    pub fn update_cursor(&mut self, session_id: &str, element_id: Option<String>) {
        if let Some(user) = self.users.get_mut(session_id) {
            user.cursor_position = element_id;
            user.update_activity();
        }
    }
    
    /// Update user selection
    pub fn update_selection(&mut self, session_id: &str, selection: Vec<String>) {
        if let Some(user) = self.users.get_mut(session_id) {
            user.selection = selection;
            user.update_activity();
        }
    }
}

/// Model version
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelVersion {
    /// Version ID
    pub id: String,
    /// Version number
    pub version: u32,
    /// Label
    pub label: String,
    /// Description
    pub description: String,
    /// Creator
    pub creator: String,
    /// Timestamp
    pub timestamp: u64,
    /// Parent version
    pub parent: Option<String>,
    /// Snapshot data
    pub snapshot: String,
}

/// Version control for structural models
#[derive(Debug, Clone)]
pub struct VersionControl {
    /// Project ID
    pub project_id: String,
    /// Versions
    pub versions: Vec<ModelVersion>,
    /// Current version
    pub current_version: Option<String>,
    /// Branches
    pub branches: HashMap<String, String>, // branch name -> version id
}

impl VersionControl {
    /// Create new version control
    pub fn new(project_id: &str) -> Self {
        Self {
            project_id: project_id.to_string(),
            versions: Vec::new(),
            current_version: None,
            branches: HashMap::new(),
        }
    }
    
    /// Create new version
    pub fn create_version(&mut self, label: &str, description: &str, creator: &str, snapshot: &str) -> String {
        let version_num = self.versions.len() as u32 + 1;
        let version_id = format!("v{}", version_num);
        
        let version = ModelVersion {
            id: version_id.clone(),
            version: version_num,
            label: label.to_string(),
            description: description.to_string(),
            creator: creator.to_string(),
            timestamp: 1704067200,
            parent: self.current_version.clone(),
            snapshot: snapshot.to_string(),
        };
        
        self.versions.push(version);
        self.current_version = Some(version_id.clone());
        
        version_id
    }
    
    /// Create branch
    pub fn create_branch(&mut self, name: &str) -> bool {
        if let Some(current) = &self.current_version {
            self.branches.insert(name.to_string(), current.clone());
            true
        } else {
            false
        }
    }
    
    /// Switch to version
    pub fn checkout(&mut self, version_id: &str) -> bool {
        if self.versions.iter().any(|v| v.id == version_id) {
            self.current_version = Some(version_id.to_string());
            true
        } else {
            false
        }
    }
    
    /// Get version history
    pub fn history(&self) -> Vec<&ModelVersion> {
        let mut history = Vec::new();
        let mut current = self.current_version.as_ref();
        
        while let Some(version_id) = current {
            if let Some(version) = self.versions.iter().find(|v| &v.id == version_id) {
                history.push(version);
                current = version.parent.as_ref();
            } else {
                break;
            }
        }
        
        history
    }
    
    /// Compare versions
    pub fn compare(&self, v1: &str, v2: &str) -> Option<VersionDiff> {
        let version1 = self.versions.iter().find(|v| v.id == v1)?;
        let version2 = self.versions.iter().find(|v| v.id == v2)?;
        
        Some(VersionDiff {
            from_version: v1.to_string(),
            to_version: v2.to_string(),
            changes: format!("Diff between {} and {}", version1.label, version2.label),
        })
    }
}

/// Version diff
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionDiff {
    /// From version
    pub from_version: String,
    /// To version
    pub to_version: String,
    /// Changes description
    pub changes: String,
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_user_session() {
        let session = UserSession::new("sess1", "user1", "John Doe", UserRole::Editor);
        
        assert!(session.can_edit());
        assert!(session.connected);
        assert!(!session.color.is_empty());
    }
    
    #[test]
    fn test_viewer_cannot_edit() {
        let session = UserSession::new("sess2", "user2", "Jane Doe", UserRole::Viewer);
        assert!(!session.can_edit());
    }
    
    #[test]
    fn test_operation_creation() {
        let op = Operation::new(
            "op1",
            OperationType::Insert {
                element_type: "Beam".to_string(),
                properties: HashMap::new(),
            },
            "user1",
        );
        
        assert_eq!(op.id, "op1");
        assert_eq!(op.user_id, "user1");
    }
    
    #[test]
    fn test_ot_engine() {
        let mut engine = OTEngine::new();
        
        let op = Operation::new(
            "op1",
            OperationType::Update {
                element_id: "beam1".to_string(),
                property: "width".to_string(),
                old_value: "300".to_string(),
                new_value: "350".to_string(),
            },
            "user1",
        );
        
        engine.apply_local(op);
        
        assert_eq!(engine.history.len(), 1);
        assert_eq!(engine.pending.len(), 1);
    }
    
    #[test]
    fn test_acknowledge_operation() {
        let mut engine = OTEngine::new();
        
        let op = Operation::new("op1", OperationType::Delete { element_id: "elem1".to_string() }, "user1");
        engine.apply_local(op);
        
        engine.acknowledge("op1");
        assert!(engine.pending.is_empty());
    }
    
    #[test]
    fn test_annotation() {
        let mut annotation = Annotation::new(
            "ann1",
            (100.0, 200.0, 0.0),
            AnnotationType::Issue,
            "Check connection design",
            "reviewer1",
        );
        
        assert_eq!(annotation.status, AnnotationStatus::Open);
        
        annotation.add_reply("reply1", "Will review", "engineer1");
        assert_eq!(annotation.replies.len(), 1);
        
        annotation.resolve();
        assert_eq!(annotation.status, AnnotationStatus::Resolved);
    }
    
    #[test]
    fn test_collaboration_session() {
        let mut session = CollaborationSession::new("project1");
        
        let user = UserSession::new("sess1", "user1", "Engineer", UserRole::Editor);
        session.add_user(user);
        
        assert_eq!(session.active_users().len(), 1);
        
        session.remove_user("sess1");
        assert!(session.active_users().is_empty());
    }
    
    #[test]
    fn test_apply_operation() {
        let mut session = CollaborationSession::new("project1");
        
        let user = UserSession::new("sess1", "user1", "Engineer", UserRole::Editor);
        session.add_user(user);
        
        let op = Operation::new(
            "op1",
            OperationType::Insert {
                element_type: "Column".to_string(),
                properties: HashMap::new(),
            },
            "user1",
        );
        
        session.apply_operation(op);
        
        assert_eq!(session.change_log.len(), 1);
        assert!(session.change_log[0].summary.contains("Column"));
    }
    
    #[test]
    fn test_cursor_update() {
        let mut session = CollaborationSession::new("project1");
        
        let user = UserSession::new("sess1", "user1", "Engineer", UserRole::Editor);
        session.add_user(user);
        
        session.update_cursor("sess1", Some("beam1".to_string()));
        
        let user = session.users.get("sess1").unwrap();
        assert_eq!(user.cursor_position, Some("beam1".to_string()));
    }
    
    #[test]
    fn test_version_control() {
        let mut vc = VersionControl::new("project1");
        
        let v1 = vc.create_version("Initial", "Initial design", "engineer", "{}");
        assert_eq!(v1, "v1");
        
        let v2 = vc.create_version("Updated", "Added beams", "engineer", "{beams: []}");
        assert_eq!(v2, "v2");
        
        let history = vc.history();
        assert_eq!(history.len(), 2);
    }
    
    #[test]
    fn test_branch_creation() {
        let mut vc = VersionControl::new("project1");
        
        vc.create_version("v1", "Initial", "user", "{}");
        
        let created = vc.create_branch("feature-beams");
        assert!(created);
        assert!(vc.branches.contains_key("feature-beams"));
    }
    
    #[test]
    fn test_checkout() {
        let mut vc = VersionControl::new("project1");
        
        vc.create_version("v1", "First", "user", "{}");
        vc.create_version("v2", "Second", "user", "{}");
        
        let success = vc.checkout("v1");
        assert!(success);
        assert_eq!(vc.current_version, Some("v1".to_string()));
    }
    
    #[test]
    fn test_version_compare() {
        let mut vc = VersionControl::new("project1");
        
        vc.create_version("Initial", "First version", "user", "{}");
        vc.create_version("Updated", "Second version", "user", "{}");
        
        let diff = vc.compare("v1", "v2");
        assert!(diff.is_some());
    }
    
    #[test]
    fn test_annotation_types() {
        assert_ne!(AnnotationType::Comment, AnnotationType::Issue);
        assert_eq!(AnnotationType::Question, AnnotationType::Question);
    }
    
    #[test]
    fn test_open_annotations() {
        let mut session = CollaborationSession::new("project1");
        
        let mut ann1 = Annotation::new("ann1", (0.0, 0.0, 0.0), AnnotationType::Issue, "Issue 1", "user1");
        let mut ann2 = Annotation::new("ann2", (0.0, 0.0, 0.0), AnnotationType::Comment, "Comment", "user1");
        ann2.resolve();
        
        session.add_annotation(ann1);
        session.add_annotation(ann2);
        
        let open = session.open_annotations();
        assert_eq!(open.len(), 1);
    }
}
