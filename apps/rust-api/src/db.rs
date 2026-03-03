//! MongoDB database connection and operations

use anyhow::{Context, Result};
use mongodb::{
    bson::{doc, oid::ObjectId, Document},
    options::ClientOptions,
    Client, Collection, Database as MongoDatabase,
};
use serde::{Deserialize, Serialize};

/// Database wrapper for MongoDB operations
#[derive(Clone)]
pub struct Database {
    client: Client,
    db: MongoDatabase,
}

impl Database {
    /// Connect to MongoDB with connection timeout
    pub async fn connect(uri: &str) -> Result<Self> {
        use std::time::Duration;
        
        let mut client_options = ClientOptions::parse(uri)
            .await
            .context("Failed to parse MongoDB URI")?;
        
        client_options.app_name = Some("BeamLab-Rust-API".to_string());
        client_options.max_pool_size = Some(20);
        client_options.min_pool_size = Some(5);
        client_options.max_idle_time = Some(Duration::from_secs(30));
        client_options.connect_timeout = Some(Duration::from_secs(30));
        client_options.server_selection_timeout = Some(Duration::from_secs(30));
        
        let client = Client::with_options(client_options)
            .context("Failed to create MongoDB client")?;
        
        // Ping to verify connection with timeout
        tokio::time::timeout(
            Duration::from_secs(30),
            client.database("admin").run_command(doc! { "ping": 1 }, None)
        )
        .await
        .context("MongoDB ping timeout")?
        .context("Failed to ping MongoDB")?;
        
        let db = client.database("beamlab");
        
        Ok(Database { client, db })
    }

    /// Get structures collection
    pub fn structures(&self) -> Collection<StructureDocument> {
        self.db.collection("structures")
    }

    /// Get projects collection
    pub fn projects(&self) -> Collection<Document> {
        self.db.collection("projects")
    }

    /// Get users collection
    pub fn users(&self) -> Collection<Document> {
        self.db.collection("users")
    }

    /// Get analysis results collection
    pub fn analysis_results(&self) -> Collection<AnalysisResultDocument> {
        self.db.collection("analysis_results")
    }
}

/// Structure document in MongoDB
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StructureDocument {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub user_id: String,
    pub name: String,
    pub description: Option<String>,
    pub nodes: Vec<NodeData>,
    pub members: Vec<MemberData>,
    pub loads: Vec<LoadData>,
    pub supports: Vec<SupportData>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NodeData {
    pub id: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemberData {
    pub id: String,
    pub start_node_id: String,
    pub end_node_id: String,
    #[serde(rename = "E")]
    pub e: f64,
    #[serde(rename = "A")]
    pub a: f64,
    #[serde(rename = "I")]
    pub i: f64,
    pub section_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LoadData {
    pub node_id: String,
    pub fx: Option<f64>,
    pub fy: Option<f64>,
    pub fz: Option<f64>,
    pub mx: Option<f64>,
    pub my: Option<f64>,
    pub mz: Option<f64>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SupportData {
    pub node_id: String,
    pub support_type: String, // FIXED, PIN, ROLLER
    pub fx: Option<bool>,
    pub fy: Option<bool>,
    pub fz: Option<bool>,
    pub mx: Option<bool>,
    pub my: Option<bool>,
    pub mz: Option<bool>,
}

/// Analysis result document
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalysisResultDocument {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub structure_id: String,
    pub analysis_type: String,
    pub displacements: Vec<DisplacementResult>,
    pub member_forces: Vec<MemberForceResult>,
    pub reactions: Vec<ReactionResult>,
    pub performance_ms: f64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DisplacementResult {
    pub node_id: String,
    pub dx: f64,
    pub dy: f64,
    pub dz: f64,
    pub rx: f64,
    pub ry: f64,
    pub rz: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MemberForceResult {
    pub member_id: String,
    pub axial: f64,
    pub shear_y: f64,
    pub shear_z: f64,
    pub moment_x: f64,
    pub moment_y: f64,
    pub moment_z: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ReactionResult {
    pub node_id: String,
    pub fx: f64,
    pub fy: f64,
    pub fz: f64,
    pub mx: f64,
    pub my: f64,
    pub mz: f64,
}
