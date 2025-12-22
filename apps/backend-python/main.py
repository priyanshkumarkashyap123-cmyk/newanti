"""
main.py - FastAPI Entry Point

REST API for structural model generation.
"""

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
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
    version="2.0.0",
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
    Generate a structural model from natural language prompt using AI.
    
    Features:
    - Mock mode for testing (USE_MOCK_AI=true)
    - JSON cleaning to handle LLM markdown wrapping
    - Comprehensive error logging
    
    Example:
    ```json
    {"prompt": "Create a 12m span bridge truss with 6 panels"}
    ```
    """
    prompt = request.prompt
    print(f"\n{'='*50}")
    print(f"[AI ENDPOINT] Received prompt: {prompt}")
    print(f"[AI ENDPOINT] USE_MOCK_AI: {USE_MOCK_AI}")
    print(f"[AI ENDPOINT] GEMINI_API_KEY set: {GEMINI_API_KEY is not None}")
    print(f"{'='*50}\n")
    
    try:
        # =============================================
        # MOCK MODE - For testing without AI
        # =============================================
        if USE_MOCK_AI:
            print("[AI ENDPOINT] Using MOCK MODE - returning hardcoded response")
            await asyncio.sleep(2)  # Simulate AI thinking time
            
            # Return appropriate mock based on prompt keywords
            prompt_lower = prompt.lower()
            
            if "truss" in prompt_lower:
                mock_model = StructuralFactory.generate_pratt_truss(span=12, height=3, bays=6)
            elif "frame" in prompt_lower or "building" in prompt_lower:
                mock_model = StructuralFactory.generate_3d_frame(
                    width=12, length=12, height=3.5, stories=3
                )
            elif "portal" in prompt_lower or "warehouse" in prompt_lower:
                mock_model = StructuralFactory.generate_portal_frame(
                    width=15, eave_height=6, roof_angle=15
                )
            else:
                # Default to simple beam
                mock_model = StructuralFactory.generate_simple_beam(span=6, support_type="simple")
            
            print(f"[AI ENDPOINT] Mock generated: {len(mock_model.nodes)} nodes, {len(mock_model.members)} members")
            
            return GenerateResponse(
                success=True,
                model=mock_model
            )
        
        # =============================================
        # REAL AI MODE - Call Gemini API
        # =============================================
        if not GEMINI_API_KEY:
            print("[AI ENDPOINT] ERROR: No GEMINI_API_KEY set!")
            return {
                "success": False,
                "error": "AI Provider Not Configured",
                "details": "GEMINI_API_KEY environment variable is not set. Set USE_MOCK_AI=true for testing."
            }
        
        try:
            import google.generativeai as genai
            
            genai.configure(api_key=GEMINI_API_KEY)
            model = genai.GenerativeModel('gemini-pro')
            
            # System instruction for structural JSON generation
            system_prompt = """You are a structural engineering AI. Generate a valid JSON structural model.

RESPOND ONLY WITH PURE JSON - NO MARKDOWN, NO EXPLANATION.

The JSON must have this exact structure:
{
  "nodes": [
    {"id": "N1", "x": 0.0, "y": 0.0, "z": 0.0, "support": "PINNED"},
    ...
  ],
  "members": [
    {"id": "M1", "start_node": "N1", "end_node": "N2", "section_profile": "ISMB300"},
    ...
  ],
  "metadata": {"name": "Structure Name"}
}

Support types: PINNED, FIXED, ROLLER, NONE
Coordinates: x=horizontal, y=vertical (height), z=depth"""

            full_prompt = f"{system_prompt}\n\nUser request: {prompt}"
            
            print("[AI ENDPOINT] Calling Gemini API...")
            response = model.generate_content(full_prompt)
            raw_text = response.text
            
            print(f"[AI ENDPOINT] Raw response length: {len(raw_text)} chars")
            print(f"[AI ENDPOINT] Raw response preview: {raw_text[:200]}...")
            
            # Clean the JSON
            cleaned_json = clean_llm_json(raw_text)
            print(f"[AI ENDPOINT] Cleaned JSON length: {len(cleaned_json)} chars")
            
            # Validate JSON parsing
            try:
                parsed = json.loads(cleaned_json)
            except json.JSONDecodeError as json_err:
                print(f"[AI ENDPOINT] JSON PARSE ERROR: {json_err}")
                print(f"[AI ENDPOINT] Failed JSON: {cleaned_json[:500]}")
                return {
                    "success": False,
                    "error": "AI returned invalid JSON",
                    "details": str(json_err),
                    "raw_response": cleaned_json[:500]
                }
            
            # Convert to StructuralModel
            from models import Node, Member, SupportType
            
            nodes = []
            for n in parsed.get("nodes", []):
                support = n.get("support", "NONE")
                nodes.append(Node(
                    id=n["id"],
                    x=n["x"],
                    y=n["y"],
                    z=n.get("z", 0.0),
                    support=SupportType(support) if support in ["PINNED", "FIXED", "ROLLER", "NONE"] else SupportType.NONE
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
                metadata=parsed.get("metadata", {"name": "AI Generated", "source": "gemini"})
            )
            
            print(f"[AI ENDPOINT] SUCCESS: {len(nodes)} nodes, {len(members)} members")
            
            return GenerateResponse(
                success=True,
                model=result_model
            )
            
        except ImportError:
            print("[AI ENDPOINT] ERROR: google-generativeai package not installed")
            return {
                "success": False,
                "error": "AI Provider Failed",
                "details": "google-generativeai package not installed. Run: pip install google-generativeai"
            }
        
        except Exception as ai_error:
            error_type = type(ai_error).__name__
            error_msg = str(ai_error)
            
            # Detailed error logging
            print(f"[AI ENDPOINT] AI API ERROR!")
            print(f"[AI ENDPOINT] Error Type: {error_type}")
            print(f"[AI ENDPOINT] Error Message: {error_msg}")
            print(f"[AI ENDPOINT] Traceback:\n{traceback.format_exc()}")
            
            # Check for common issues
            if "API_KEY" in error_msg.upper() or "INVALID" in error_msg.upper():
                hint = "Likely an API key issue - check your GEMINI_API_KEY"
            elif "RATE" in error_msg.upper() or "QUOTA" in error_msg.upper():
                hint = "Rate limit or quota exceeded"
            elif "NETWORK" in error_msg.upper() or "CONNECTION" in error_msg.upper():
                hint = "Network connectivity issue"
            else:
                hint = "Unknown error - check server logs"
            
            return {
                "success": False,
                "error": "AI Provider Failed",
                "details": error_msg,
                "error_type": error_type,
                "hint": hint
            }
    
    except Exception as e:
        print(f"[AI ENDPOINT] UNEXPECTED ERROR: {e}")
        print(f"[AI ENDPOINT] Traceback:\n{traceback.format_exc()}")
        return {
            "success": False,
            "error": "Server Error",
            "details": str(e)
        }


# ============================================
# MAIN ENTRY POINT
# ============================================

if __name__ == "__main__":
    import uvicorn
    print(f"\n🚀 Starting BeamLab Structural Engine")
    print(f"📋 USE_MOCK_AI: {USE_MOCK_AI}")
    print(f"🔑 GEMINI_API_KEY: {'SET' if GEMINI_API_KEY else 'NOT SET'}\n")
    uvicorn.run(app, host="0.0.0.0", port=8081)
