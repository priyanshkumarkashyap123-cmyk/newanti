//! Structure CRUD handlers

use axum::{
    extract::{Extension, Path, State},
    Json,
};
use mongodb::bson::{doc, oid::ObjectId};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::db::{StructureDocument, NodeData, MemberData, LoadData, SupportData};
use crate::error::{ApiError, ApiResult};
use crate::AppState;

#[derive(Debug, Deserialize)]
pub struct CreateStructureRequest {
    pub name: String,
    pub description: Option<String>,
    pub nodes: Vec<NodeData>,
    pub members: Vec<MemberData>,
    #[serde(default)]
    pub loads: Vec<LoadData>,
    #[serde(default)]
    pub supports: Vec<SupportData>,
}

#[derive(Debug, Serialize)]
pub struct StructureResponse {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub node_count: usize,
    pub member_count: usize,
    pub created_at: String,
}

#[derive(Debug, Serialize)]
pub struct StructureListResponse {
    pub success: bool,
    pub structures: Vec<StructureResponse>,
    pub total: usize,
}

/// GET /api/structures - List all structures
pub async fn list_structures(
    State(state): State<Arc<AppState>>,
) -> ApiResult<Json<StructureListResponse>> {
    use futures::stream::TryStreamExt;

    let cursor = state.db.structures()
        .find(None, None)
        .await
        .map_err(|e| ApiError::DatabaseError(e.to_string()))?;

    let structures: Vec<StructureDocument> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::DatabaseError(e.to_string()))?;

    let responses: Vec<StructureResponse> = structures
        .iter()
        .map(|s| StructureResponse {
            id: s.id.map(|id| id.to_hex()).unwrap_or_default(),
            name: s.name.clone(),
            description: s.description.clone(),
            node_count: s.nodes.len(),
            member_count: s.members.len(),
            created_at: s.created_at.to_rfc3339(),
        })
        .collect();

    let total = responses.len();

    Ok(Json(StructureListResponse {
        success: true,
        structures: responses,
        total,
    }))
}

/// POST /api/structures - Create a new structure
pub async fn create_structure(
    State(state): State<Arc<AppState>>,
    auth_user: Option<Extension<crate::middleware::AuthUser>>,
    Json(req): Json<CreateStructureRequest>,
) -> ApiResult<Json<StructureResponse>> {
    let now = chrono::Utc::now();

    // Extract authenticated user from request extensions
    let user_id = auth_user
        .map(|Extension(user)| user.user_id)
        .unwrap_or_else(|| "anonymous".to_string());

    let doc = StructureDocument {
        id: None,
        user_id,
        name: req.name.clone(),
        description: req.description.clone(),
        nodes: req.nodes,
        members: req.members,
        loads: req.loads,
        supports: req.supports,
        created_at: now,
        updated_at: now,
    };

    let result = state.db.structures()
        .insert_one(&doc, None)
        .await
        .map_err(|e| ApiError::DatabaseError(e.to_string()))?;

    let id = result.inserted_id
        .as_object_id()
        .map(|id| id.to_hex())
        .unwrap_or_default();

    Ok(Json(StructureResponse {
        id,
        name: req.name,
        description: req.description,
        node_count: doc.nodes.len(),
        member_count: doc.members.len(),
        created_at: now.to_rfc3339(),
    }))
}

/// GET /api/structures/:id - Get a structure by ID
pub async fn get_structure(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<Json<StructureDocument>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::BadRequest("Invalid structure ID".into()))?;

    let structure = state.db.structures()
        .find_one(doc! { "_id": object_id }, None)
        .await
        .map_err(|e| ApiError::DatabaseError(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("Structure not found".into()))?;

    Ok(Json(structure))
}

/// POST /api/structures/:id - Update a structure
pub async fn update_structure(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(req): Json<CreateStructureRequest>,
) -> ApiResult<Json<StructureResponse>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::BadRequest("Invalid structure ID".into()))?;

    let now = chrono::Utc::now();

    let nodes_bson = mongodb::bson::to_bson(&req.nodes)
        .map_err(|e| ApiError::BadRequest(format!("Failed to serialize nodes: {}", e)))?;
    let members_bson = mongodb::bson::to_bson(&req.members)
        .map_err(|e| ApiError::BadRequest(format!("Failed to serialize members: {}", e)))?;
    let loads_bson = mongodb::bson::to_bson(&req.loads)
        .map_err(|e| ApiError::BadRequest(format!("Failed to serialize loads: {}", e)))?;
    let supports_bson = mongodb::bson::to_bson(&req.supports)
        .map_err(|e| ApiError::BadRequest(format!("Failed to serialize supports: {}", e)))?;

    let update = doc! {
        "$set": {
            "name": &req.name,
            "description": &req.description,
            "nodes": nodes_bson,
            "members": members_bson,
            "loads": loads_bson,
            "supports": supports_bson,
            "updated_at": mongodb::bson::DateTime::from_chrono(now),
        }
    };

    let result = state.db.structures()
        .update_one(doc! { "_id": object_id }, update, None)
        .await
        .map_err(|e| ApiError::DatabaseError(e.to_string()))?;

    if result.matched_count == 0 {
        return Err(ApiError::NotFound("Structure not found".into()));
    }

    Ok(Json(StructureResponse {
        id,
        name: req.name,
        description: req.description,
        node_count: req.nodes.len(),
        member_count: req.members.len(),
        created_at: now.to_rfc3339(),
    }))
}

/// DELETE /api/structures/:id - Delete a structure
pub async fn delete_structure(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> ApiResult<Json<serde_json::Value>> {
    let object_id = ObjectId::parse_str(&id)
        .map_err(|_| ApiError::BadRequest("Invalid structure ID".into()))?;

    let result = state.db.structures()
        .delete_one(doc! { "_id": object_id }, None)
        .await
        .map_err(|e| ApiError::DatabaseError(e.to_string()))?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("Structure not found".into()));
    }

    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Structure deleted",
        "id": id
    })))
}
