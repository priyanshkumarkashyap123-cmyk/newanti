"""
AI Generation, Chat & Status Endpoints
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import os
import asyncio
from ai_resilience import LLMResilienceGuard

router = APIRouter(tags=["AI Generation"])

_CHAT_LLM_GUARD = LLMResilienceGuard(
    key="ai_chat_router",
    timeout_seconds=12.0,
    max_retries=2,
    retry_backoff_seconds=0.35,
    circuit_failure_threshold=3,
    circuit_reset_seconds=45.0,
)


# ── Config ──

def _get_ai_config():
    gemini_key = os.getenv('GEMINI_API_KEY', '').strip() or 'mock-key-local-dev'
    use_mock = os.getenv('USE_MOCK_AI', 'true').strip().lower() in ('true', '1', 'yes')
    return gemini_key, use_mock


# ── Request/Response Models ──

class AIGenerateRequest(BaseModel):
    prompt: str


class AIChatRequest(BaseModel):
    message: str
    context: Optional[str] = None
    history: Optional[List[dict]] = None


class AIChatResponse(BaseModel):
    success: bool
    response: Optional[str] = None
    error: Optional[str] = None


# ── Mock Data ──

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
    """Clean JSON from LLM response."""
    cleaned = raw_text.replace("```json", "").replace("```", "").strip()
    start_idx = cleaned.find("{")
    end_idx = cleaned.rfind("}")
    if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
        cleaned = cleaned[start_idx:end_idx + 1]
    return cleaned.strip()


# ── Endpoints ──

@router.post("/generate/ai")
async def generate_from_ai(request: AIGenerateRequest):
    """Generate a structural model from natural language prompt using Enhanced AI Architect."""
    GEMINI_API_KEY, USE_MOCK_AI = _get_ai_config()
    prompt = request.prompt

    print(f"\n{'='*60}")
    print(f"[AI ARCHITECT] Received prompt: {prompt}")
    print(f"[AI ARCHITECT] USE_MOCK_AI: {USE_MOCK_AI}")

    try:
        from ai_architect import EnhancedAIArchitect, PromptAnalyzer

        params = PromptAnalyzer.analyze(prompt)
        print(f"[AI ARCHITECT] Detected structure type: {params.structure_type.value}")

        api_key = None if USE_MOCK_AI else GEMINI_API_KEY
        architect = EnhancedAIArchitect(gemini_api_key=api_key)

        await asyncio.sleep(0.5)
        model_dict, generation_method = architect.generate(prompt)

        print(f"[AI ARCHITECT] Generation method: {generation_method}")

        from models import Node, Member, SupportType, StructuralModel, GenerateResponse

        nodes = []
        for n in model_dict.get("nodes", []):
            sup_str = str(n.get("support", "NONE")).upper().replace("SUPPORTTYPE.", "")
            valid_sups = ["PINNED", "FIXED", "ROLLER", "NONE"]
            support = SupportType(sup_str) if sup_str in valid_sups else SupportType.NONE
            nodes.append(Node(
                id=n["id"], x=float(n["x"]), y=float(n["y"]),
                z=float(n.get("z", 0.0)), support=support
            ))

        members = []
        for m in model_dict.get("members", []):
            members.append(Member(
                id=m["id"], start_node=m["start_node"], end_node=m["end_node"],
                section_profile=m.get("section_profile", "ISMB300")
            ))

        metadata = model_dict.get("metadata", {})
        metadata["generation_method"] = generation_method
        metadata["original_prompt"] = prompt[:100]

        result_model = StructuralModel(nodes=nodes, members=members, metadata=metadata)
        return GenerateResponse(success=True, model=result_model)

    except Exception as e:
        import traceback
        print(f"[AI ARCHITECT] ERROR: {str(e)}")
        traceback.print_exc()

        from factory import StructuralFactory
        from models import GenerateResponse

        prompt_lower = prompt.lower()
        try:
            if "truss" in prompt_lower:
                if "warren" in prompt_lower:
                    fallback = StructuralFactory.generate_warren_truss(span=12, height=3, bays=6)
                elif "howe" in prompt_lower:
                    fallback = StructuralFactory.generate_howe_truss(span=12, height=3, bays=6)
                else:
                    fallback = StructuralFactory.generate_pratt_truss(span=12, height=3, bays=6)
            elif "bridge" in prompt_lower:
                fallback = StructuralFactory.generate_bridge(span=24, deck_width=6, truss_height=4, panels=6)
            elif "tower" in prompt_lower:
                fallback = StructuralFactory.generate_tower(base_width=8, top_width=2, height=30, levels=5)
            elif "portal" in prompt_lower or "shed" in prompt_lower or "warehouse" in prompt_lower:
                fallback = StructuralFactory.generate_portal_frame(width=20, eave_height=8, roof_angle=15)
            elif "frame" in prompt_lower or "building" in prompt_lower:
                fallback = StructuralFactory.generate_3d_frame(width=12, length=12, height=3.5, stories=3)
            elif "cantilever" in prompt_lower:
                fallback = StructuralFactory.generate_simple_beam(span=5, support_type="cantilever")
            elif "continuous" in prompt_lower:
                fallback = StructuralFactory.generate_continuous_beam(spans=[5, 6, 5])
            else:
                fallback = StructuralFactory.generate_simple_beam(span=6, support_type="simple")
        except Exception:
            fallback = StructuralFactory.generate_simple_beam(span=6, support_type="simple")

        fallback.metadata = {"name": "AI Fallback Structure", "error": str(e), "original_prompt": prompt[:50]}
        return GenerateResponse(success=True, model=fallback)


# ── Section Recommendation Endpoints ──

class SectionRecommendationRequest(BaseModel):
    axial_force: float = 0.0  # kN
    shear_force: float = 0.0  # kN
    bending_moment: float = 0.0  # kN·m
    deflection_limit: Optional[float] = None  # mm
    span_length: Optional[float] = None  # m
    code: str = "IS800"  # "IS800", "AISC360", "EC3"
    material: str = "steel"  # "steel", "concrete"
    utilization_target: float = 0.8  # Target utilization ratio
    max_results: int = 5

class SectionOptimizationRequest(BaseModel):
    axial_force: float = 0.0
    shear_force: float = 0.0
    bending_moment: float = 0.0
    deflection_limit: Optional[float] = None
    span_length: Optional[float] = None
    code: str = "IS800"
    material: str = "steel"
    utilization_target: float = 0.8
    optimization_goal: str = "balanced"  # "cost", "weight", "safety", "balanced"
    constraints: Optional[Dict[str, Any]] = None  # max_cost_per_m, max_weight_per_m


@router.post("/ai/section-recommend")
async def recommend_sections(request: SectionRecommendationRequest):
    """Get AI-powered section recommendations based on design requirements."""
    try:
        from ai.section_recommender import get_section_recommendations

        requirements = {
            'axial_force': request.axial_force,
            'shear_force': request.shear_force,
            'bending_moment': request.bending_moment,
            'deflection_limit': request.deflection_limit,
            'span_length': request.span_length,
            'code': request.code,
            'material': request.material,
            'utilization_target': request.utilization_target
        }

        recommendations = get_section_recommendations(requirements, request.max_results)

        return {
            "success": True,
            "recommendations": recommendations,
            "count": len(recommendations)
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "recommendations": []
        }


@router.post("/ai/section-optimize")
async def optimize_section(request: SectionOptimizationRequest):
    """Optimize section selection using advanced algorithms."""
    try:
        from ai.optimization.section_optimizer import optimize_section_selection

        requirements = {
            'axial_force': request.axial_force,
            'shear_force': request.shear_force,
            'bending_moment': request.bending_moment,
            'deflection_limit': request.deflection_limit,
            'span_length': request.span_length,
            'code': request.code,
            'material': request.material,
            'utilization_target': request.utilization_target
        }

        result = optimize_section_selection(
            requirements,
            request.optimization_goal,
            request.constraints
        )

        return {
            "success": True,
            "optimization": result
        }

    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "optimization": None
        }


@router.post("/ai/chat")
async def ai_chat(request: AIChatRequest):
    """Chat with the AI assistant about structural engineering."""
    GEMINI_API_KEY, USE_MOCK_AI = _get_ai_config()
    message = request.message
    context = request.context or ""
    history = request.history or []

    try:
        if not GEMINI_API_KEY or GEMINI_API_KEY == 'mock-key-local-dev':
            response_text = _get_engineering_response(message, context)
            return AIChatResponse(success=True, response=response_text)

        import google.generativeai as genai
        genai.configure(api_key=GEMINI_API_KEY)
        model = genai.GenerativeModel('gemini-2.0-flash')

        system_context = """You are an expert Structural Engineering AI assistant for BeamLab Ultimate, 
a professional-grade structural analysis software. You help users with structural analysis concepts,
results interpretation, design improvements, Indian Standard (IS) codes, FEA, load calculations,
and 2D/3D structural modeling. Keep responses concise but informative."""

        full_prompt = f"{system_context}\n\n"
        if context:
            full_prompt += f"CURRENT MODEL CONTEXT:\n{context}\n\n"
        for entry in history[-5:]:
            full_prompt += f"{entry.get('role', 'user').upper()}: {entry.get('content', '')}\n"
        full_prompt += f"\nUSER: {message}\n\nASSISTANT:"

        guarded = _CHAT_LLM_GUARD.execute(
            lambda: model.generate_content(full_prompt)
        )
        if not guarded.success or guarded.value is None:
            response_text = _get_engineering_response(message, context)
            return AIChatResponse(success=True, response=response_text)

        response = guarded.value
        return AIChatResponse(success=True, response=response.text.strip())

    except Exception as e:
        import traceback
        traceback.print_exc()
        fallback_response = _get_engineering_response(message, context)
        return AIChatResponse(success=True, response=fallback_response)


@router.get("/ai/status")
async def ai_chat_status():
    """Check the status of AI chat capabilities."""
    GEMINI_API_KEY, USE_MOCK_AI = _get_ai_config()
    return {
        "gemini_configured": bool(GEMINI_API_KEY and GEMINI_API_KEY != 'mock-key-local-dev'),
        "mock_mode": USE_MOCK_AI,
        "capabilities": [
            "structure_generation", "chat_assistant", "model_diagnosis", "design_suggestions"
        ] if GEMINI_API_KEY and GEMINI_API_KEY != 'mock-key-local-dev' else [
            "structure_generation_basic", "mock_responses"
        ],
        "model": "gemini-2.0-flash" if GEMINI_API_KEY and GEMINI_API_KEY != 'mock-key-local-dev' else "mock"
    }


# ── Rule-based engineering responses ──

def _get_engineering_response(message: str, context: str = "") -> str:
    """Generate comprehensive rule-based engineering responses when AI is unavailable."""
    msg = message.lower().strip()

    creation_keywords = ['create', 'make', 'build', 'design', 'generate', 'model', 'draw', 'construct', 'i want', 'i need', 'can you make']
    structure_keywords = ['beam', 'truss', 'frame', 'bridge', 'building', 'tower', 'portal', 'cantilever', 'slab', 'shell', 'plate', 'column', 'warehouse', 'shed', 'arch']

    is_creation = any(k in msg for k in creation_keywords)
    has_structure = any(k in msg for k in structure_keywords)

    if is_creation and has_structure:
        suggested_prompt = message.strip()
        if not any(msg.startswith(k) for k in ['create', 'design', 'generate', 'make', 'build']):
            suggested_prompt = f"Create a {suggested_prompt}"
        return (
            f"Great idea! To generate this structure, please switch to the **Generate** tab and type:\n\n"
            f"**\"{suggested_prompt}\"**\n\n"
            f"The AI Architect will create the nodes, members, supports, and loads for you automatically."
        )

    if 'udl' in msg or 'uniformly distributed' in msg:
        return "**UDL (Uniformly Distributed Load)** is a load evenly spread across a member.\n\n- Symbol: w (kN/m)\n- Total load = w × L\n- SS beam: Max BM = wL²/8, Max Deflection = 5wL⁴/(384EI)\n- IS 875 Part 2: Residential = 2 kN/m², Office = 3 kN/m²"

    if 'beam' in msg or 'bheem' in msg:
        if 'deflection' in msg:
            return "**Beam Deflection Formulas:**\n\n- SS + UDL: δ = 5wL⁴/(384EI)\n- SS + Point at center: δ = PL³/(48EI)\n- Cantilever + UDL: δ = wL⁴/(8EI)\n- Cantilever + Point: δ = PL³/(3EI)\n\nIS 800:2007 limits: L/300 (beams), L/150 (cantilevers)."
        if 'moment' in msg or 'bending' in msg:
            return "**Bending Moment Formulas:**\n\n- SS + UDL: M_max = wL²/8 (mid-span)\n- SS + Point: M_max = PL/4 (mid-span)\n- Cantilever + UDL: M_max = wL²/2 (fixed end)\n- Fixed + UDL: M_support = wL²/12, M_mid = wL²/24"
        return "**Beams** resist loads through bending.\n\nTypes: Simply Supported, Cantilever, Fixed, Continuous\n\nKey checks: Bending σ ≤ 0.66fy, Shear τ ≤ 0.4fy, Deflection ≤ L/300"

    if 'truss' in msg:
        return "**Trusses** are triangulated structures with axial-only members.\n\n- **Pratt**: Diagonals in tension\n- **Howe**: Diagonals in compression\n- **Warren**: Alternating diagonals\n\nTry: 'Generate a Pratt truss of 24m span with 6 panels'"

    if 'frame' in msg or 'portal' in msg:
        return "**Frames** have rigid beam-column connections.\n\n- Portal Frame: gable for warehouses\n- Multi-story: Building frames\n\nDesign per IS 800:2007 (steel) or IS 456:2000 (concrete)"

    if 'moment of inertia' in msg or 'second moment' in msg:
        return "**Moment of Inertia (I)** measures bending resistance.\n\n- Rectangle: I = bd³/12\n- Circle: I = πd⁴/64\n- I-beam: Use IS tables (ISMB 300: Ix = 8603 cm⁴)\n\nHigher I → less deflection, lower stress."

    if 'p-delta' in msg or 'pdelta' in msg or 'p delta' in msg:
        return "**P-Delta Analysis** accounts for extra moments from gravity loads on displaced structures.\n\nImportant for tall buildings, slender columns, seismic analysis.\nIS 800:2007 Cl. 4.4.2 requires P-Delta for frames > 5 stories."

    if 'shear' in msg:
        return "**Shear Force** is the transverse force at a section.\n\n- SS + UDL: V_max = wL/2\n- Shear check: τ = V/(d·tw) ≤ 0.4fy (IS 800)"

    if 'is 800' in msg or 'is800' in msg:
        return "**IS 800:2007** — Steel construction code.\n\nKey: Cl.5 Tension, Cl.7 Compression, Cl.8 Bending, Cl.10 Connections, Cl.12 Fatigue.\nUses Limit State Method (LSM)."

    if 'is 456' in msg or 'is456' in msg:
        return "**IS 456:2000** — RC concrete code.\n\nKey: Cl.26 Development length, Cl.34 Slabs, Cl.38 Columns, Cl.40 Footings.\nMin concrete: M20."

    if 'deflection' in msg or 'displacement' in msg:
        return "**Deflection Limits** (IS 800):\n- Beams: L/300\n- Cantilever: L/150\n- Columns: H/300\n\nReduce by: increasing I, reducing span, adding supports."

    if 'load combination' in msg or 'load combo' in msg:
        return "**Load Combinations** (IS 875 Part 5):\n- 1.5(DL + LL)\n- 1.2(DL + LL + WL)\n- 1.5(DL + WL)\n- 0.9DL + 1.5WL\n\nSeismic (IS 1893): 1.2(DL + LL + EL)"

    if any(w in msg for w in ['help', 'what can', 'how to', 'guide', 'tutorial']):
        return "I can help with structural engineering!\n\n**Generate**: Switch to Generate tab and describe your structure\n**Modify**: Use Modify tab to change sections/loads\n**Knowledge**: Ask about beams, trusses, IS codes, etc."

    return (
        f"I understand you're asking about: **{message[:80]}**\n\n"
        "Try asking about: beam design, UDL, trusses, frames, P-Delta, IS 800, IS 456, IS 875.\n\n"
        "Or use the **Generate** tab to create structures from descriptions!"
    )
