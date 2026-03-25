"""
Database Routes - Persistence for Audit, Feedback, Learning Data

Provides SQLite-backed persistence for:
- Audit trail records
- User feedback
- ML training data
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Dict, Any, List, Optional
import sqlite3
import json
import os
from datetime import datetime

router = APIRouter()

# ============================================
# DATABASE SETUP
# ============================================

DB_PATH = os.path.join(os.path.dirname(__file__), "data", "ai_architect.db")

def get_db():
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    cursor = conn.cursor()
    
    # Audit table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS audit (
            id TEXT PRIMARY KEY,
            project_id TEXT,
            category TEXT,
            action TEXT,
            description TEXT,
            ai_generated INTEGER,
            metadata TEXT,
            timestamp TEXT
        )
    """)
    
    # Feedback table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS feedback (
            id TEXT PRIMARY KEY,
            feature TEXT,
            rating REAL,
            correction TEXT,
            context TEXT,
            timestamp TEXT
        )
    """)
    
    # Learning table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS learning (
            id TEXT PRIMARY KEY,
            feature TEXT,
            input TEXT,
            output TEXT,
            reward REAL,
            timestamp TEXT
        )
    """)
    
    # Users table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clerk_id TEXT UNIQUE NOT NULL,
            email TEXT,
            name TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    # Projects table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS projects (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id TEXT NOT NULL,
            name TEXT NOT NULL,
            description TEXT,
            project_data TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (clerk_id)
        )
    """)
    
    # Project analytics table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS project_analytics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            project_id INTEGER NOT NULL,
            action TEXT NOT NULL,
            timestamp TEXT DEFAULT CURRENT_TIMESTAMP,
            metadata TEXT,
            FOREIGN KEY (project_id) REFERENCES projects (id)
        )
    """)
    
    conn.commit()
    conn.close()

# Initialize on import
init_db()

# ============================================
# MODELS
# ============================================

class AuditRecord(BaseModel):
    projectId: str
    category: str
    action: str
    description: str
    aiGenerated: bool = False
    metadata: Dict[str, Any] = {}
    timestamp: Optional[str] = None

class FeedbackRecord(BaseModel):
    feature: str
    rating: float
    correction: Optional[str] = None
    context: Dict[str, Any] = {}
    timestamp: Optional[str] = None

class LearningData(BaseModel):
    feature: str
    input: Any
    output: Any
    reward: float
    timestamp: Optional[str] = None

class User(BaseModel):
    id: Optional[int] = None
    clerk_id: str
    email: Optional[str] = None
    name: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class Project(BaseModel):
    id: Optional[int] = None
    user_id: str  # Changed from int to str to match clerk_id
    name: str
    description: Optional[str] = None
    project_data: Any  # Changed from data to project_data
    created_at: datetime  # Changed to datetime
    updated_at: datetime  # Changed to datetime

class ProjectAnalytics(BaseModel):
    id: Optional[int] = None
    project_id: int
    action: str
    timestamp: Optional[str] = None
    metadata: Optional[Dict[str, Any]] = None

# ============================================
# AUDIT ROUTES
# ============================================

@router.post("/audit")
async def save_audit(record: AuditRecord):
    conn = get_db()
    cursor = conn.cursor()
    
    record_id = f"audit_{datetime.now().strftime('%Y%m%d%H%M%S')}_{os.urandom(4).hex()}"
    timestamp = record.timestamp or datetime.now().isoformat()
    
    cursor.execute("""
        INSERT INTO audit (id, project_id, category, action, description, ai_generated, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        record_id,
        record.projectId,
        record.category,
        record.action,
        record.description,
        1 if record.aiGenerated else 0,
        json.dumps(record.metadata),
        timestamp
    ))
    
    conn.commit()
    conn.close()
    
    return {"id": record_id, "success": True}

@router.get("/audit/{project_id}")
async def get_audit(project_id: str, limit: int = 100):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM audit 
        WHERE project_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
    """, (project_id, limit))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in rows]

# ============================================
# FEEDBACK ROUTES
# ============================================

@router.post("/feedback")
async def save_feedback(record: FeedbackRecord):
    conn = get_db()
    cursor = conn.cursor()
    
    record_id = f"fb_{datetime.now().strftime('%Y%m%d%H%M%S')}_{os.urandom(4).hex()}"
    timestamp = record.timestamp or datetime.now().isoformat()
    
    cursor.execute("""
        INSERT INTO feedback (id, feature, rating, correction, context, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        record_id,
        record.feature,
        record.rating,
        record.correction,
        json.dumps(record.context),
        timestamp
    ))
    
    conn.commit()
    conn.close()
    
    return {"id": record_id, "success": True}

@router.get("/feedback/summary/{feature}")
async def get_feedback_summary(feature: str):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT 
            AVG(rating) as avg_rating,
            COUNT(*) as total_count,
            SUM(CASE WHEN correction IS NOT NULL THEN 1 ELSE 0 END) as corrections
        FROM feedback
        WHERE feature = ?
    """, (feature,))
    
    row = cursor.fetchone()
    conn.close()
    
    return {
        "avgRating": row["avg_rating"] or 0,
        "totalCount": row["total_count"] or 0,
        "corrections": row["corrections"] or 0
    }

# ============================================
# LEARNING DATA ROUTES
# ============================================

@router.post("/learning")
async def save_learning(data: LearningData):
    conn = get_db()
    cursor = conn.cursor()
    
    record_id = f"learn_{datetime.now().strftime('%Y%m%d%H%M%S')}_{os.urandom(4).hex()}"
    timestamp = data.timestamp or datetime.now().isoformat()
    
    cursor.execute("""
        INSERT INTO learning (id, feature, input, output, reward, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        record_id,
        data.feature,
        json.dumps(data.input),
        json.dumps(data.output),
        data.reward,
        timestamp
    ))
    
    conn.commit()
    conn.close()
    
    return {"id": record_id, "success": True}

@router.get("/learning/export/{feature}")
async def export_learning(feature: str, limit: int = 10000):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM learning 
        WHERE feature = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
    """, (feature, limit))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [{
        "id": row["id"],
        "feature": row["feature"],
        "input": json.loads(row["input"]),
        "output": json.loads(row["output"]),
        "reward": row["reward"],
        "timestamp": row["timestamp"]
    } for row in rows]

# ============================================
# STATS ROUTE
# ============================================

@router.get("/stats")
async def get_stats():
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT COUNT(*) as count FROM audit")
    audit_count = cursor.fetchone()["count"]
    
    cursor.execute("SELECT COUNT(*) as count FROM feedback")
    feedback_count = cursor.fetchone()["count"]
    
    cursor.execute("SELECT COUNT(*) as count FROM learning")
    learning_count = cursor.fetchone()["count"]
    
    conn.close()
    
    return {
        "audit_records": audit_count,
        "feedback_records": feedback_count,
        "learning_records": learning_count
    }

# ============================================
# USER MANAGEMENT ROUTES
# ============================================

@router.post("/users")
async def create_user(user: User):
    conn = get_db()
    cursor = conn.cursor()
    
    # Check if user already exists
    cursor.execute("SELECT id FROM users WHERE clerk_id = ?", (user.clerk_id,))
    existing = cursor.fetchone()
    
    if existing:
        conn.close()
        raise HTTPException(status_code=409, detail="User already exists")
    
    # Create new user
    cursor.execute("""
        INSERT INTO users (clerk_id, email, name, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
    """, (
        user.clerk_id,
        user.email,
        user.name,
        user.created_at.isoformat(),
        user.updated_at.isoformat()
    ))
    
    conn.commit()
    conn.close()
    
    return {"success": True, "user": user}

@router.get("/users/{clerk_id}")
async def get_user(clerk_id: str):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM users WHERE clerk_id = ?", (clerk_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "id": row["id"],
        "clerk_id": row["clerk_id"],
        "email": row["email"],
        "name": row["name"],
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    }

@router.put("/users/{clerk_id}")
async def update_user(clerk_id: str, user: User):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE users 
        SET email = ?, name = ?, updated_at = ?
        WHERE clerk_id = ?
    """, (
        user.email,
        user.name,
        user.updated_at.isoformat(),
        clerk_id
    ))
    
    conn.commit()
    conn.close()
    
    return {"success": True}

# ============================================
# PROJECT MANAGEMENT ROUTES
# ============================================

@router.post("/projects")
async def create_project(project: Project):
    conn = get_db()
    cursor = conn.cursor()
    
    # Check user project limit (5 projects max)
    cursor.execute("SELECT COUNT(*) as count FROM projects WHERE user_id = ?", (project.user_id,))
    project_count = cursor.fetchone()["count"]
    
    if project_count >= 5:
        conn.close()
        raise HTTPException(status_code=429, detail="Project limit reached (5 projects max)")
    
    # Create project
    cursor.execute("""
        INSERT INTO projects (user_id, name, description, project_data, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        project.user_id,
        project.name,
        project.description,
        json.dumps(project.project_data),
        project.created_at.isoformat() if isinstance(project.created_at, datetime) else project.created_at,
        project.updated_at.isoformat() if isinstance(project.updated_at, datetime) else project.updated_at
    ))
    
    project_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return {"success": True, "project_id": project_id}

@router.get("/projects/user/{user_id}")
async def get_user_projects(user_id: str, limit: int = 5):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM projects 
        WHERE user_id = ? 
        ORDER BY updated_at DESC 
        LIMIT ?
    """, (user_id, limit))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [{
        "id": row["id"],
        "user_id": row["user_id"],
        "name": row["name"],
        "description": row["description"],
        "project_data": json.loads(row["project_data"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    } for row in rows]

@router.get("/projects/{project_id}")
async def get_project(project_id: int):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("SELECT * FROM projects WHERE id = ?", (project_id,))
    row = cursor.fetchone()
    conn.close()
    
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return {
        "id": row["id"],
        "user_id": row["user_id"],
        "name": row["name"],
        "description": row["description"],
        "project_data": json.loads(row["project_data"]),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"]
    }

@router.put("/projects/{project_id}")
async def update_project(project_id: int, project: Project):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        UPDATE projects 
        SET name = ?, description = ?, project_data = ?, updated_at = ?
        WHERE id = ?
    """, (
        project.name,
        project.description,
        json.dumps(project.project_data),
        project.updated_at.isoformat(),
        project_id
    ))
    
    conn.commit()
    conn.close()
    
    return {"success": True}

@router.delete("/projects/{project_id}")
async def delete_project(project_id: int):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM projects WHERE id = ?", (project_id,))
    conn.commit()
    conn.close()
    
    return {"success": True}

# ============================================
# PROJECT ANALYTICS ROUTES
# ============================================

@router.post("/analytics")
async def record_analytics(analytics: ProjectAnalytics):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        INSERT INTO project_analytics (project_id, user_id, action, metadata, timestamp)
        VALUES (?, ?, ?, ?, ?)
    """, (
        analytics.project_id,
        analytics.user_id,
        analytics.action,
        json.dumps(analytics.metadata),
        analytics.timestamp.isoformat()
    ))
    
    conn.commit()
    conn.close()
    
    return {"success": True}

@router.get("/analytics/project/{project_id}")
async def get_project_analytics(project_id: int, limit: int = 100):
    conn = get_db()
    cursor = conn.cursor()
    
    cursor.execute("""
        SELECT * FROM project_analytics 
        WHERE project_id = ? 
        ORDER BY timestamp DESC 
        LIMIT ?
    """, (project_id, limit))
    
    rows = cursor.fetchall()
    conn.close()
    
    return [{
        "id": row["id"],
        "project_id": row["project_id"],
        "user_id": row["user_id"],
        "action": row["action"],
        "metadata": json.loads(row["metadata"]),
        "timestamp": row["timestamp"]
    } for row in rows]
