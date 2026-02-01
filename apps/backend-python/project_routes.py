from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from database.project_repo import ProjectRepository

router = APIRouter()

# ============================================
# MODELS
# ============================================

class ProjectSummary(BaseModel):
    id: str
    name: str
    lastModified: str
    nodeCount: int
    memberCount: int

class SaveProjectRequest(BaseModel):
    projectInfo: Dict[str, Any]
    nodes: Any # Complex objects, letting generic dict handle it for now
    members: Any
    civilData: Optional[Any] = None # Support for Phase 2 Civil Data
    version: str = "2.0"

# ============================================
# ROUTES
# ============================================

@router.get("/", response_model=List[ProjectSummary])
async def list_projects():
    """List all saved projects"""
    return ProjectRepository.list_projects()

@router.post("/", response_model=Dict[str, str])
async def save_project(project: Dict[str, Any]):
    """Save a full project model"""
    try:
        project_id = ProjectRepository.save_project(project)
        return {"id": project_id, "status": "saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{project_id}")
async def get_project(project_id: str):
    """Load a specific project"""
    project = ProjectRepository.get_project(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project

@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Delete a project"""
    if ProjectRepository.delete_project(project_id):
        return {"status": "deleted"}
    raise HTTPException(status_code=404, detail="Project not found")
