"""
Enhanced WebSocket Routes for Real-Time Analysis Progress & Collaboration

Provides:
- Analysis progress streaming (percent, stage, ETA)
- Job completion notifications
- Real-time collaboration (cursor sync, selection, chat)
- Connection management with heartbeat
"""

import asyncio
import json
import logging
import time
from typing import Dict, Set, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

# Keep backward compatibility with existing collaboration manager
try:
    from collaboration.manager import manager as collab_manager
except ImportError:
    collab_manager = None

logger = logging.getLogger("beamlab.ws")
router = APIRouter()


# ============================================
# Enhanced Connection Manager
# ============================================

class AnalysisConnectionManager:
    """Manages WebSocket connections for analysis progress & collaboration"""

    def __init__(self):
        self._job_subscribers: Dict[str, Set[WebSocket]] = {}
        self._all_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self._all_connections.add(websocket)

    def disconnect(self, websocket: WebSocket):
        self._all_connections.discard(websocket)
        for subs in self._job_subscribers.values():
            subs.discard(websocket)

    def subscribe_job(self, websocket: WebSocket, job_id: str):
        if job_id not in self._job_subscribers:
            self._job_subscribers[job_id] = set()
        self._job_subscribers[job_id].add(websocket)

    async def send_job_progress(self, job_id: str, data: Dict):
        subs = self._job_subscribers.get(job_id, set())
        message = json.dumps({"type": "job_progress", "job_id": job_id, **data})
        dead = set()
        for ws in subs:
            try:
                await ws.send_text(message)
            except Exception:
                dead.add(ws)
        subs -= dead

    @property
    def connection_count(self) -> int:
        return len(self._all_connections)


ws_manager = AnalysisConnectionManager()


# ============================================
# Original collaboration WebSocket (preserved)
# ============================================

@router.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """Original collaboration WebSocket - backward compatible"""
    if collab_manager:
        await collab_manager.connect(client_id, websocket)
        await collab_manager.broadcast({
            "type": "user_joined",
            "userId": client_id
        }, sender_id=client_id)
        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                await collab_manager.broadcast(message, sender_id=client_id)
        except WebSocketDisconnect:
            collab_manager.disconnect(client_id)
            await collab_manager.broadcast({
                "type": "user_left",
                "userId": client_id
            }, sender_id=client_id)
        except Exception as e:
            logger.error(f"[WS] Error: {e}")
            collab_manager.disconnect(client_id)
    else:
        await websocket.accept()
        await websocket.send_json({"error": "Collaboration manager not available"})
        await websocket.close()


# ============================================
# Analysis Progress WebSocket (NEW)
# ============================================

@router.websocket("/ws/analysis/{job_id}")
async def analysis_progress_ws(websocket: WebSocket, job_id: str):
    """
    Real-time analysis progress streaming.
    
    Connect: ws://host/ws/analysis/{job_id}
    
    Receives:
    {
        "type": "job_progress",
        "job_id": "abc123",
        "status": "running",
        "percent": 45.2,
        "stage": "solving",
        "message": "Factoring stiffness matrix"
    }
    """
    await ws_manager.connect(websocket)
    ws_manager.subscribe_job(websocket, job_id)

    try:
        # Register progress callback with worker pool
        try:
            from analysis.worker_pool import get_worker_pool
            pool = await get_worker_pool()

            async def on_progress(job):
                await ws_manager.send_job_progress(job_id, {
                    "status": job.status.value,
                    "percent": job.progress.percent,
                    "stage": job.progress.stage,
                    "message": job.progress.message,
                    "eta_seconds": job.progress.eta_seconds,
                })

            pool.on_progress(job_id, on_progress)

            # Check if already complete
            job = pool.get_job(job_id)
            if job and job.status.value in ("completed", "failed"):
                await websocket.send_json({
                    "type": "job_progress",
                    "job_id": job_id,
                    "status": job.status.value,
                    "percent": 100.0 if job.status.value == "completed" else 0.0,
                    "message": "Complete" if job.status.value == "completed" else (job.error or "Failed"),
                })
        except ImportError:
            await websocket.send_json({
                "type": "info",
                "message": "Worker pool not available, progress tracking limited",
            })

        # Keep alive with heartbeat
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30.0)
                msg = json.loads(data)
                if msg.get("type") == "ping":
                    await websocket.send_json({"type": "pong", "time": time.time()})
                elif msg.get("type") == "subscribe":
                    new_id = msg.get("job_id")
                    if new_id:
                        ws_manager.subscribe_job(websocket, new_id)
            except asyncio.TimeoutError:
                try:
                    await websocket.send_json({"type": "heartbeat", "time": time.time()})
                except Exception:
                    break

    except WebSocketDisconnect:
        pass
    finally:
        ws_manager.disconnect(websocket)


# ============================================
# Status endpoint
# ============================================

@router.get("/ws/status")
async def ws_status():
    """WebSocket connection statistics"""
    return {
        "active_connections": ws_manager.connection_count,
        "job_subscriptions": {k: len(v) for k, v in ws_manager._job_subscribers.items()},
        "collab_available": collab_manager is not None,
    }

