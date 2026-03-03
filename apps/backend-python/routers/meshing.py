"""
Mesh Generation Endpoints
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import asyncio

router = APIRouter(tags=["Meshing"])


class MeshPlateRequest(BaseModel):
    corners: List[Dict[str, float]]  # [{x, y, z}, ...]
    nx: int
    ny: int
    hard_points: Optional[List[Dict[str, float]]] = None


class TriangulateRequest(BaseModel):
    boundary: List[Dict[str, float]]  # [{x, y}, ...]
    holes: Optional[List[List[Dict[str, float]]]] = None


@router.post("/mesh/plate")
async def mesh_plate_endpoint(request: MeshPlateRequest):
    """
    Mesh a quadrilateral plate into N×M elements.
    Supports hard point constraints for beam node snapping.
    """
    try:
        from meshing import mesh_plate

        corners = [(c["x"], c["y"], c.get("z", 0)) for c in request.corners]
        hard_pts = None
        if request.hard_points:
            hard_pts = [(p["x"], p["y"], p.get("z", 0)) for p in request.hard_points]

        result = await asyncio.to_thread(mesh_plate, corners, request.nx, request.ny, hard_pts)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mesh/triangulate")
async def triangulate_endpoint(request: TriangulateRequest):
    """
    Constrained Delaunay Triangulation with hole support.
    - boundary: CCW polygon vertices
    - holes: List of CW hole polygons
    """
    try:
        from meshing import triangulate_with_holes

        boundary = [(p["x"], p["y"]) for p in request.boundary]
        holes = None
        if request.holes:
            holes = [[(p["x"], p["y"]) for p in hole] for hole in request.holes]

        result = await asyncio.to_thread(triangulate_with_holes, boundary, holes)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
