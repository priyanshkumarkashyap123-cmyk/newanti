"""
main.py - FastAPI Entry Point

REST API for structural model generation.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List, Dict
import os

from models import (
    StructuralModel, GenerateResponse,
    ContinuousBeamRequest, TrussRequest, FrameRequest
)
from factory import StructuralFactory


# ============================================
# FASTAPI APP INITIALIZATION
# ============================================

app = FastAPI(
    title="BeamLab Structural Engine",
    description="Python backend for mathematical structural model generation",
    version="2.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ============================================
# CORS CONFIGURATION
# ============================================

# Allow origins from env
allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "")
frontend_url_env = os.getenv("FRONTEND_URL", "")

allow_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://localhost:5173",
    "http://localhost:8000",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
]

if allowed_origins_env:
    allow_origins.extend([origin.strip() for origin in allowed_origins_env.split(",")])

if frontend_url_env:
    allow_origins.append(frontend_url_env.strip())

# Deduplicate
allow_origins = list(set(allow_origins))

app.add_middleware(
    CORSMiddleware,
    allow_origins=allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================
# HEALTH CHECK ENDPOINTS
# ============================================

@app.get("/", tags=["Health"])
async def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "BeamLab Structural Engine",
        "version": "2.0.0"
    }


@app.get("/health", tags=["Health"])
async def health_check():
    """Detailed health check."""
    return {
        "status": "ok",
        "templates_available": [
            "beam", "continuous_beam", "truss", "pratt_truss", 
            "frame", "3d_frame", "portal"
        ]
    }


# ============================================
# MESHING ENDPOINTS
# ============================================

class MeshPlateRequest(BaseModel):
    corners: List[Dict[str, float]]  # [{x, y, z}, ...]
    nx: int
    ny: int
    hard_points: Optional[List[Dict[str, float]]] = None

class TriangulateRequest(BaseModel):
    boundary: List[Dict[str, float]]  # [{x, y}, ...]
    holes: Optional[List[List[Dict[str, float]]]] = None

@app.post("/mesh/plate", tags=["Meshing"])
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
        
        result = mesh_plate(corners, request.nx, request.ny, hard_pts)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/mesh/triangulate", tags=["Meshing"])
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
        
        result = triangulate_with_holes(boundary, holes)
        return {"success": True, **result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# BEAM ANALYSIS ENDPOINT (with hand calculations)
# ============================================

from pydantic import BaseModel
from typing import List as ListType, Dict, Any

class BeamLoadInput(BaseModel):
    type: str  # "point", "udl", "uvl"
    magnitude: float
    position: float
    end_position: Optional[float] = None
    end_magnitude: Optional[float] = None

class BeamAnalysisRequest(BaseModel):
    length: float
    loads: ListType[BeamLoadInput]
    E: Optional[float] = 200e6
    I: Optional[float] = 1e-4

@app.post("/analyze/beam", tags=["Analysis"])
async def analyze_beam(request: BeamAnalysisRequest):
    """
    Analyze a simply supported beam with various loads.
    
    Returns:
    - Hand calculation steps (for educational display)
    - 100 data points for SFD/BMD diagrams
    - Maximum values and their locations
    """
    try:
        from analysis.solver import (
            BeamSolver, BeamAnalysisInput, Load, LoadType, Support
        )
        
        # Convert request loads to solver format
        loads = []
        for load in request.loads:
            load_type = {
                "point": LoadType.POINT,
                "udl": LoadType.UDL,
                "uvl": LoadType.UVL
            }.get(load.type.lower(), LoadType.POINT)
            
            loads.append(Load(
                type=load_type,
                magnitude=load.magnitude,
                position=load.position,
                end_position=load.end_position,
                end_magnitude=load.end_magnitude
            ))
        
        # Create beam input
        beam_input = BeamAnalysisInput(
            length=request.length,
            loads=loads,
            supports=[
                Support(position=0, type="pinned"),
                Support(position=request.length, type="roller")
            ],
            E=request.E or 200e6,
            I=request.I or 1e-4
        )
        
        # Solve
        solver = BeamSolver(beam_input)
        result = solver.solve()
        
        return {
            "success": result.success,
            "result": {
                "max_moment": result.max_moment,
                "max_shear": result.max_shear,
                "max_deflection": result.max_deflection,
                "max_moment_location": result.max_moment_location,
                "max_shear_location": result.max_shear_location,
                "reactions": result.reactions
            },
            "steps": result.steps,
            "diagram": {
                "x_values": result.diagram.x_values,
                "shear_values": result.diagram.shear_values,
                "moment_values": result.diagram.moment_values,
                "deflection_values": result.diagram.deflection_values
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# 3D FRAME ANALYSIS ENDPOINT (PyNite FEA)
# ============================================

class FrameNodeInput(BaseModel):
    id: str
    x: float
    y: float
    z: float
    support: Optional[str] = "none"

class FrameMemberInput(BaseModel):
    id: str
    startNodeId: str
    endNodeId: str
    E: Optional[float] = 200e6
    G: Optional[float] = 77e6
    Iy: Optional[float] = 1e-4
    Iz: Optional[float] = 1e-4
    J: Optional[float] = 1e-5
    A: Optional[float] = 0.01

class NodeLoadInput(BaseModel):
    nodeId: str
    fx: Optional[float] = 0
    fy: Optional[float] = 0
    fz: Optional[float] = 0
    mx: Optional[float] = 0
    my: Optional[float] = 0
    mz: Optional[float] = 0

class MemberDistLoadInput(BaseModel):
    memberId: str
    direction: Optional[str] = "Fy"
    w1: float
    w2: Optional[float] = None  # If None, uses w1 (UDL)
    startPos: Optional[float] = 0
    endPos: Optional[float] = 1
    isRatio: Optional[bool] = True

class FrameAnalysisRequest(BaseModel):
    nodes: ListType[FrameNodeInput]
    members: ListType[FrameMemberInput]
    node_loads: Optional[ListType[NodeLoadInput]] = []
    distributed_loads: Optional[ListType[MemberDistLoadInput]] = []

@app.post("/analyze/frame", tags=["Analysis"])
async def analyze_3d_frame(request: FrameAnalysisRequest):
    """
    Analyze a 3D frame structure using PyNite FEA.
    
    Returns:
    - Node displacements and reactions
    - Member forces at 100 points (shear, moment, axial, torsion)
    - Deflection arrays
    """
    try:
        from analysis.fea_engine import analyze_frame
        
        # Convert to dict format
        model_dict = {
            "nodes": [
                {
                    "id": n.id,
                    "x": n.x,
                    "y": n.y,
                    "z": n.z,
                    "support": n.support or "none"
                }
                for n in request.nodes
            ],
            "members": [
                {
                    "id": m.id,
                    "startNodeId": m.startNodeId,
                    "endNodeId": m.endNodeId,
                    "E": m.E or 200e6,
                    "G": m.G or 77e6,
                    "Iy": m.Iy or 1e-4,
                    "Iz": m.Iz or 1e-4,
                    "J": m.J or 1e-5,
                    "A": m.A or 0.01
                }
                for m in request.members
            ],
            "node_loads": [
                {
                    "nodeId": l.nodeId,
                    "fx": l.fx or 0,
                    "fy": l.fy or 0,
                    "fz": l.fz or 0,
                    "mx": l.mx or 0,
                    "my": l.my or 0,
                    "mz": l.mz or 0
                }
                for l in (request.node_loads or [])
            ],
            "distributed_loads": [
                {
                    "memberId": l.memberId,
                    "direction": l.direction or "Fy",
                    "w1": l.w1,
                    "w2": l.w2 if l.w2 is not None else l.w1,
                    "startPos": l.startPos or 0,
                    "endPos": l.endPos or 1,
                    "isRatio": l.isRatio if l.isRatio is not None else True
                }
                for l in (request.distributed_loads or [])
            ]
        }
        
        # Run analysis
        result = analyze_frame(model_dict)
        
        if not result['success']:
            raise HTTPException(status_code=400, detail=result.get('error', 'Analysis failed'))
        
        return result
        
    except ImportError as e:
        raise HTTPException(
            status_code=500,
            detail="PyNiteFEA not installed. Run: pip install PyNiteFEA"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============================================
# TEMPLATE GENERATION ENDPOINT
# ============================================

@app.post("/template/{type}", response_model=GenerateResponse, tags=["Generation"])
async def generate_template(
    type: str,
    # Beam parameters
    span: Optional[float] = Query(None, description="Span length in meters"),
    spans: Optional[str] = Query(None, description="Comma-separated span lengths for continuous beam"),
    support_type: Optional[str] = Query("simple", description="Support type: simple, fixed, cantilever"),
    # Truss parameters
    height: Optional[float] = Query(None, description="Height in meters"),
    bays: Optional[int] = Query(None, description="Number of bays"),
    # Frame parameters
    width: Optional[float] = Query(None, description="Width in meters"),
    length: Optional[float] = Query(None, description="Length in meters (for 3D)"),
    stories: Optional[int] = Query(None, description="Number of stories"),
    bays_x: Optional[int] = Query(2, description="Bays in X direction"),
    bays_z: Optional[int] = Query(2, description="Bays in Z direction"),
    # Portal parameters
    roof_angle: Optional[float] = Query(15.0, description="Roof angle in degrees"),
    # General
    intermediate_nodes: Optional[int] = Query(10, description="Intermediate nodes per span")
):
    """
    Generate a structural model from template.
    
    **Template Types:**
    - `beam` - Simple beam
    - `continuous_beam` - Multi-span continuous beam
    - `truss` / `pratt_truss` - Pratt truss
    - `frame` / `3d_frame` - 3D building frame
    - `portal` - Portal frame with pitched roof
    
    **Examples:**
    - `/template/beam?span=6&support_type=simple`
    - `/template/continuous_beam?spans=5,6,5`
    - `/template/truss?span=12&height=3&bays=6`
    - `/template/frame?width=12&length=12&height=3.5&stories=4`
    - `/template/portal?width=15&height=6&roof_angle=15`
    """
    try:
        template_type = type.lower().replace("-", "_").replace(" ", "_")
        model: StructuralModel

        # ----------------------------------------
        # BEAM Templates
        # ----------------------------------------
        if template_type == "beam":
            _span = span or 6.0
            model = StructuralFactory.generate_simple_beam(
                span=_span,
                support_type=support_type or "simple"
            )
        
        elif template_type == "continuous_beam":
            if spans:
                span_list = [float(s.strip()) for s in spans.split(",")]
            else:
                span_list = [5.0, 6.0, 5.0]  # Default 3-span
            
            model = StructuralFactory.generate_continuous_beam(
                spans=span_list,
                intermediate_nodes=intermediate_nodes or 10
            )
        
        # ----------------------------------------
        # TRUSS Templates
        # ----------------------------------------
        elif template_type in ["truss", "pratt_truss", "pratt"]:
            _span = span or 12.0
            _height = height or 3.0
            _bays = bays or 6
            
            model = StructuralFactory.generate_pratt_truss(
                span=_span,
                height=_height,
                bays=_bays
            )
        
        # ----------------------------------------
        # FRAME Templates
        # ----------------------------------------
        elif template_type in ["frame", "3d_frame", "building"]:
            _width = width or 12.0
            _length = length or 12.0
            _height = height or 3.5
            _stories = stories or 3
            _bays_x = bays_x or 2
            _bays_z = bays_z or 2
            
            model = StructuralFactory.generate_3d_frame(
                width=_width,
                length=_length,
                height=_height,
                stories=_stories,
                bays_x=_bays_x,
                bays_z=_bays_z
            )
        
        elif template_type in ["portal", "portal_frame", "warehouse"]:
            _width = width or 15.0
            _height = height or 6.0
            _roof_angle = roof_angle or 15.0
            
            model = StructuralFactory.generate_portal_frame(
                width=_width,
                eave_height=_height,
                roof_angle=_roof_angle
            )
        
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown template type: {type}. "
                       f"Available: beam, continuous_beam, truss, frame, portal"
            )

        return GenerateResponse(
            success=True,
            model=model
        )

    except HTTPException:
        raise
    except Exception as e:
        return GenerateResponse(
            success=False,
            error=str(e)
        )


# ============================================
# SPECIFIC TEMPLATE ENDPOINTS
# ============================================

@app.post("/generate/continuous-beam", response_model=GenerateResponse, tags=["Generation"])
async def generate_continuous_beam(request: ContinuousBeamRequest):
    """Generate a continuous beam with multiple spans."""
    try:
        model = StructuralFactory.generate_continuous_beam(
            spans=request.spans,
            intermediate_nodes=request.intermediate_nodes
        )
        return GenerateResponse(success=True, model=model)
    except Exception as e:
        return GenerateResponse(success=False, error=str(e))


@app.post("/generate/truss", response_model=GenerateResponse, tags=["Generation"])
async def generate_truss(request: TrussRequest):
    """Generate a Pratt truss."""
    try:
        model = StructuralFactory.generate_pratt_truss(
            span=request.span,
            height=request.height,
            bays=request.bays
        )
        return GenerateResponse(success=True, model=model)
    except Exception as e:
        return GenerateResponse(success=False, error=str(e))


@app.post("/generate/3d-frame", response_model=GenerateResponse, tags=["Generation"])
async def generate_3d_frame(request: FrameRequest):
    """Generate a 3D building frame."""
    try:
        model = StructuralFactory.generate_3d_frame(
            width=request.width,
            length=request.length,
            height=request.height,
            stories=request.stories,
            bays_x=request.bays_x,
            bays_z=request.bays_z
        )
        return GenerateResponse(success=True, model=model)
    except Exception as e:
        return GenerateResponse(success=False, error=str(e))


# ============================================
# MODEL VALIDATION
# ============================================

@app.post("/validate", tags=["Validation"])
async def validate_model(model: StructuralModel):
    """Validate a structural model for common issues."""
    issues = []
    
    node_ids = {n.id for n in model.nodes}
    
    # Check member references
    for member in model.members:
        if member.start_node not in node_ids:
            issues.append(f"Member {member.id}: Invalid start node {member.start_node}")
        if member.end_node not in node_ids:
            issues.append(f"Member {member.id}: Invalid end node {member.end_node}")
    
    # Check for supports
    supports = [n for n in model.nodes if n.support and n.support.value != "NONE"]
    if len(supports) == 0:
        issues.append("No supports defined - structure is unstable")
    
    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "node_count": len(model.nodes),
        "member_count": len(model.members),
        "support_count": len(supports)
    }


# ============================================
# AI GENERATION ENDPOINT (HARDENED)
# ============================================

import json
import asyncio
import os
import traceback
from pydantic import BaseModel

class AIGenerateRequest(BaseModel):
    prompt: str

# Configuration flags
USE_MOCK_AI = os.getenv("USE_MOCK_AI", "true").lower() == "true"  # Default to mock for testing
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", None)

# Mock response for testing
MOCK_BEAM_RESPONSE = {
    "nodes": [
        {"id": "N1", "x": 0.0, "y": 0.0, "z": 0.0, "support": "PINNED"},
        {"id": "N2", "x": 3.0, "y": 0.0, "z": 0.0, "support": "NONE"},
        {"id": "N3", "x": 6.0, "y": 0.0, "z": 0.0, "support": "ROLLER"}
    ],
    "members": [
        {"id": "M1", "start_node": "N1", "end_node": "N2", "section_profile": "ISMB300"},
        {"id": "M2", "start_node": "N2", "end_node": "N3", "section_profile": "ISMB300"}
    ],
    "metadata": {"name": "Simple Beam (Mock)", "generated_by": "mock_ai"}
}

def clean_llm_json(raw_text: str) -> str:
    """
    Clean JSON from LLM response.
    LLMs often wrap JSON in markdown code blocks or add commentary.
    """
    # Remove markdown code blocks
    cleaned = raw_text.replace("```json", "").replace("```", "").strip()
    
    # Try to extract JSON if there's text before/after
    # Find the first { and last }
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        cleaned = cleaned[start_idx:end_idx + 1]
    
    return cleaned.strip()


@app.post("/generate/ai", tags=["AI Generation"])
async def generate_from_ai(request: AIGenerateRequest):
    """
    Generate a structural model from natural language prompt using AI (Upgraded).
    """
    prompt = request.prompt
    print(f"\n{'='*50}")
    print(f"[AI ENDPOINT] Received prompt: {prompt}")
    print(f"[AI ENDPOINT] USE_MOCK_AI: {USE_MOCK_AI}")
    
    try:
        # =============================================
        # MOCK MODE (Fallback)
        # =============================================
        if USE_MOCK_AI or not GEMINI_API_KEY:
            if not GEMINI_API_KEY:
                print("[AI WARNING] No API Key found, forcing Mock Mode.")
            
            print("[AI ENDPOINT] Using MOCK MODE - returning hardcoded response")
            await asyncio.sleep(1.5)
            
            # Simple keyword matching for better mock experience
            prompt_lower = prompt.lower()
            if "truss" in prompt_lower:
                model = StructuralFactory.generate_pratt_truss(span=12, height=3, bays=6)
            elif "frame" in prompt_lower or "building" in prompt_lower:
                model = StructuralFactory.generate_3d_frame(width=10, length=10, height=4, stories=2)
            else:
                model = StructuralFactory.generate_simple_beam(span=6, support_type="simple")
            
            return GenerateResponse(success=True, model=model)

        # =============================================
        # REAL AI MODE (Gemini Pro)
        # =============================================
        import google.generativeai as genai
        from analysis.ai_prompts import SYSTEM_PROMPT_v2
        
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-pro')
        
        full_prompt = f"{SYSTEM_PROMPT_v2}\n\nUSER REQUEST: {prompt}"
        
        print("[AI ENDPOINT] Calling Gemini API with V2 Prompt...")
        response = model.generate_content(full_prompt)
        raw_text = response.text
        
        # Clean JSON
        cleaned_json = clean_llm_json(raw_text)
        
        # Parse JSON
        try:
            parsed = json.loads(cleaned_json)
        except json.JSONDecodeError:
            # Simple retry/repair logic (could be expanded)
            print("[AI RECOVERY] JSON parse failed, trying simplified cleanup...")
            cleaned_json = cleaned_json.strip().strip('"').strip("'")
            parsed = json.loads(cleaned_json)

        # Convert to Internal Model
        from models import Node, Member, SupportType
        
        nodes = []
        for n in parsed.get("nodes", []):
            sup_str = str(n.get("support", "NONE")).upper()
            valid_sups = ["PINNED", "FIXED", "ROLLER", "NONE"]
            support = SupportType(sup_str) if sup_str in valid_sups else SupportType.NONE
            
            nodes.append(Node(
                id=n["id"],
                x=float(n["x"]),
                y=float(n["y"]),
                z=float(n.get("z", 0.0)),
                support=support
            ))
        
        members = []
        for m in parsed.get("members", []):
            members.append(Member(
                id=m["id"],
                start_node=m["start_node"],
                end_node=m["end_node"],
                section_profile=m.get("section_profile", "ISMB300")
            ))
        
        result_model = StructuralModel(
            nodes=nodes,
            members=members,
            metadata=parsed.get("metadata", {"name": "AI Generated Structure"})
        )
        
        print(f"[AI SUCCESS] Generated {len(nodes)} nodes, {len(members)} members.")
        return GenerateResponse(success=True, model=result_model)

    except Exception as e:
        print(f"[AI ERROR] {str(e)}")
        # Fallback to simple beam on crash so user gets SOMETHING
        fallback = StructuralFactory.generate_simple_beam(6)
        fallback.metadata = {"name": "Error Fallback", "error": str(e)}
        return GenerateResponse(success=True, model=fallback)


# ============================================
# CONCRETE DESIGN ENDPOINTS
# ============================================

class BeamDesignRequest(BaseModel):
    """Request model for beam design"""
    width: float            # mm
    depth: float            # mm
    cover: float = 40       # mm
    Mu: float               # kNm - Design moment
    Vu: float               # kN - Design shear
    fck: float = 25         # MPa - Concrete grade
    fy: float = 500         # MPa - Steel grade


class ColumnDesignRequest(BaseModel):
    """Request model for column design"""
    width: float            # mm
    depth: float            # mm
    cover: float = 40       # mm
    Pu: float               # kN - Axial load
    Mux: float = 0          # kNm - Moment about x-axis
    Muy: float = 0          # kNm - Moment about y-axis
    unsupported_length: float  # mm
    effective_length_factor: float = 1.0
    fck: float = 25
    fy: float = 500


class SlabDesignRequest(BaseModel):
    """Request model for slab design"""
    lx: float               # m - Shorter span
    ly: float = 0           # m - Longer span (0 for one-way)
    live_load: float        # kN/m²
    floor_finish: float = 1.0  # kN/m²
    support_type: str = 'simple'  # simple, continuous, cantilever
    edge_conditions: str = 'all_simple'  # For two-way slabs
    fck: float = 25
    fy: float = 500


@app.post("/design/beam", tags=["Design"])
async def design_beam(request: BeamDesignRequest):
    """
    Design RC beam per IS 456:2000
    
    Returns reinforcement details for flexure and shear
    """
    try:
        from design.concrete.is456 import IS456Designer, BeamSection
        
        designer = IS456Designer(fck=request.fck, fy=request.fy)
        section = BeamSection(
            width=request.width,
            depth=request.depth,
            effective_depth=request.depth - request.cover - 10,
            cover=request.cover
        )
        
        result = designer.design_beam(section, request.Mu, request.Vu)
        
        return {
            "success": True,
            "tension_steel": {
                "diameter": result.tension_steel.diameter,
                "count": result.tension_steel.count,
                "area": round(result.tension_steel.area, 1)
            },
            "compression_steel": {
                "diameter": result.compression_steel.diameter,
                "count": result.compression_steel.count,
                "area": round(result.compression_steel.area, 1)
            } if result.compression_steel else None,
            "stirrups": {
                "diameter": result.stirrups.diameter,
                "legs": result.stirrups.count,
                "spacing": result.stirrups.spacing
            },
            "Mu_capacity": round(result.Mu_capacity, 2),
            "Vu_capacity": round(result.Vu_capacity, 2),
            "status": result.status,
            "checks": result.checks
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/design/column", tags=["Design"])
async def design_column(request: ColumnDesignRequest):
    """
    Design RC column per IS 456:2000
    
    Handles axial load with biaxial bending
    """
    try:
        from design.concrete.is456 import IS456Designer, ColumnSection
        
        designer = IS456Designer(fck=request.fck, fy=request.fy)
        section = ColumnSection(
            width=request.width,
            depth=request.depth,
            cover=request.cover
        )
        
        result = designer.design_column(
            section,
            Pu=request.Pu,
            Mux=request.Mux,
            Muy=request.Muy,
            unsupported_length=request.unsupported_length,
            effective_length_factor=request.effective_length_factor
        )
        
        return {
            "success": True,
            "longitudinal_steel": [
                {
                    "diameter": bar.diameter,
                    "count": bar.count,
                    "area": round(bar.area, 1)
                }
                for bar in result.longitudinal_steel
            ],
            "ties": {
                "diameter": result.ties.diameter,
                "spacing": result.ties.spacing
            },
            "Pu_capacity": round(result.Pu_capacity, 2),
            "Mux_capacity": round(result.Mux_capacity, 2),
            "Muy_capacity": round(result.Muy_capacity, 2),
            "interaction_ratio": round(result.interaction_ratio, 3),
            "status": result.status,
            "checks": result.checks
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/design/slab", tags=["Design"])
async def design_slab(request: SlabDesignRequest):
    """
    Design RC slab per IS 456:2000
    
    Supports one-way and two-way slabs
    """
    try:
        from design.concrete.slab import (
            SlabDesigner, SlabLoading, SlabPanel, EdgeCondition,
            design_simply_supported_slab, design_two_way_floor_slab
        )
        
        # Determine slab type
        if request.ly == 0 or request.ly / request.lx > 2:
            # One-way slab
            result = design_simply_supported_slab(
                span=request.lx,
                live_load=request.live_load,
                fck=request.fck,
                fy=request.fy,
                floor_finish=request.floor_finish
            )
        else:
            # Two-way slab
            result = design_two_way_floor_slab(
                lx=request.lx,
                ly=request.ly,
                live_load=request.live_load,
                edge_conditions=request.edge_conditions,
                fck=request.fck,
                fy=request.fy
            )
        
        return {
            "success": True,
            "thickness": result.thickness,
            "main_reinforcement": {
                "diameter": result.main_reinforcement.diameter,
                "spacing": result.main_reinforcement.spacing,
                "area_per_m": round(result.main_reinforcement.area_per_m, 1),
                "direction": result.main_reinforcement.direction
            },
            "distribution_reinforcement": {
                "diameter": result.distribution_reinforcement.diameter,
                "spacing": result.distribution_reinforcement.spacing,
                "area_per_m": round(result.distribution_reinforcement.area_per_m, 1),
                "direction": result.distribution_reinforcement.direction
            },
            "top_reinforcement": {
                "diameter": result.top_reinforcement.diameter,
                "spacing": result.top_reinforcement.spacing,
                "area_per_m": round(result.top_reinforcement.area_per_m, 1)
            } if result.top_reinforcement else None,
            "Mu_capacity": round(result.Mu_capacity, 2),
            "Mu_demand": round(result.Mu_demand, 2),
            "deflection_check": round(result.deflection_check, 1),
            "deflection_limit": round(result.deflection_limit, 1),
            "status": result.status,
            "checks": result.checks
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


# ============================================
# MAIN ENTRY POINT
# ============================================

if __name__ == "__main__":
    import uvicorn
    print(f"\n🚀 Starting BeamLab Structural Engine")
    print(f"📋 USE_MOCK_AI: {USE_MOCK_AI}")
    print(f"🔑 GEMINI_API_KEY: {'SET' if GEMINI_API_KEY else 'NOT SET'}\n")
    uvicorn.run(app, host="0.0.0.0", port=8081)
