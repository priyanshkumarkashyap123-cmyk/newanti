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
