"""
Section Design, Material & Plate Element Endpoints (modularized).
"""

import asyncio
import traceback
from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(tags=["Section Design"])


# ── Request Models ──

class SectionRecommendationRequest(BaseModel):
    member_type: str
    required_Mx: float = 0.0
    required_My: float = 0.0
    required_P: float = 0.0
    required_V: float = 0.0
    length: float = 5000.0
    section_type: str = "ISMB"
    safety_factor: float = 1.5
    max_deflection: Optional[float] = None


class CustomSectionRequest(BaseModel):
    points: List[Dict[str, float]]
    name: Optional[str] = "Custom Section"
    material_density: Optional[float] = 7850.0


class StandardSectionRequest(BaseModel):
    shape_type: str
    dimensions: Dict[str, float]
    name: Optional[str] = None
    material_density: Optional[float] = 7850.0


class CreateMaterialRequest(BaseModel):
    type: str
    fy: float = 250.0
    E: float = 200000.0
    plastic_modulus: float = 2000.0
    fck: float = 30.0
    density: float = 7850.0


class CreatePlateRequest(BaseModel):
    node_ids: list
    thickness: float
    material_id: str = ""


# ── Section Endpoints ──

@router.post("/sections/recommend", tags=["Design"])
async def recommend_section(request: SectionRecommendationRequest):
    """Recommend suitable structural sections based on demands.
    
    Delegates to Rust backend for section recommendation.
    """
    try:
        from analysis.adapters.rust.client import get_rust_client
        
        client = get_rust_client()
        
        # Forward request to Rust API
        # Rust has POST /api/sections/recommend endpoint
        result = await client._make_request(
            method="POST",
            endpoint="/sections/recommend",
            data={
                "member_type": request.member_type,
                "required_Mx": request.required_Mx,
                "required_My": request.required_My,
                "required_P": request.required_P,
                "required_V": request.required_V,
                "length": request.length,
                "section_type": request.section_type,
                "safety_factor": request.safety_factor,
            }
        )
        
        if "error" in result:
            raise HTTPException(status_code=500, detail=result["error"])
        
        return result
        
    except Exception as e:
        import traceback
        print(f"Error recommending sections: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Section recommendation failed: {str(e)}")


@router.post("/sections/custom/calculate")
async def calculate_custom_section(request: CustomSectionRequest):
    """Calculate properties of a custom section defined by points."""
    try:
        from analysis.section_designer import CustomSection, Point

        section_points = [Point(p["x"], p["y"]) for p in request.points]
        section = CustomSection(section_points, request.name or "Custom Section")
        properties = await asyncio.to_thread(section.get_all_properties, request.material_density or 7850.0)

        return {
            "success": True,
            "section": {
                "name": section.name,
                "points": [{"x": p.x, "y": p.y} for p in section.points],
                "properties": properties,
            },
        }

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Section calculation error: {str(e)}")


@router.post("/sections/standard/create")
async def create_standard_section(request: StandardSectionRequest):
    """Create a standard section shape with automatic property calculation."""
    try:
        from analysis.section_designer import StandardShapes

        shape_type = request.shape_type.lower()
        dims = request.dimensions
        section = None

        if shape_type in ("i_beam", "ibeam"):
            section = StandardShapes.i_beam(
                depth=dims["depth"],
                width=dims["width"],
                web_thick=dims["web_thickness"],
                flange_thick=dims["flange_thickness"],
                name=request.name or f"I-Beam {dims['depth']}x{dims['width']}",
            )
        elif shape_type == "channel":
            section = StandardShapes.channel(
                depth=dims["depth"],
                width=dims["width"],
                web_thick=dims["web_thickness"],
                flange_thick=dims["flange_thickness"],
                name=request.name or f"Channel {dims['depth']}x{dims['width']}",
            )
        elif shape_type == "angle":
            section = StandardShapes.angle(
                leg1=dims["leg1"],
                leg2=dims["leg2"],
                thickness=dims["thickness"],
                name=request.name or f"Angle {dims['leg1']}x{dims['leg2']}x{dims['thickness']}",
            )
        elif shape_type in ("rectangular", "rectangle"):
            section = StandardShapes.rectangular(
                width=dims["width"],
                depth=dims["depth"],
                name=request.name or f"Rect {dims['width']}x{dims['depth']}",
            )
        elif shape_type in ("circular", "circle"):
            section = StandardShapes.circular(
                diameter=dims["diameter"],
                segments=int(dims.get("segments", 32)),
                name=request.name or f"Circle D{dims['diameter']}",
            )
        elif shape_type == "tee":
            section = StandardShapes.tee(
                width=dims["width"],
                depth=dims["depth"],
                web_thick=dims["web_thickness"],
                flange_thick=dims["flange_thickness"],
                name=request.name or f"Tee {dims['width']}x{dims['depth']}",
            )
        elif shape_type == "built_up_i":
            section = StandardShapes.built_up_i(
                depth=dims["depth"],
                top_width=dims["top_width"],
                bot_width=dims["bot_width"],
                web_thick=dims["web_thickness"],
                top_thick=dims["top_thickness"],
                bot_thick=dims["bot_thickness"],
                name=request.name or "Built-up I-Section",
            )
        elif shape_type == "composite_beam":
            section = StandardShapes.composite_beam(
                depth=dims["depth"],
                width=dims["width"],
                web_thick=dims["web_thickness"],
                flange_thick=dims["flange_thickness"],
                slab_width=dims["slab_width"],
                slab_thick=dims["slab_thickness"],
                modular_ratio=dims.get("modular_ratio", 8.0),
                name=request.name or "Composite Beam",
            )
        elif shape_type == "lipped_channel":
            section = StandardShapes.lipped_channel(
                depth=dims["depth"],
                width=dims["width"],
                thickness=dims["thickness"],
                lip=dims["lip"],
                name=request.name or "Lipped Channel",
            )
        else:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Unknown shape type: {shape_type}. "
                    "Available: i_beam, channel, angle, rectangular, circular, tee, built_up_i, composite_beam, lipped_channel"
                ).format(shape_type=shape_type),
            )

        properties = await asyncio.to_thread(section.get_all_properties, request.material_density or 7850.0)

        return {
            "success": True,
            "section": {
                "name": section.name,
                "shape_type": request.shape_type,
                "points": [{"x": round(p.x, 2), "y": round(p.y, 2)} for p in section.points],
                "properties": properties,
            },
        }

    except KeyError as e:
        raise HTTPException(status_code=400, detail=f"Missing dimension: {str(e)}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Section creation error: {str(e)}")


@router.get("/sections/shapes/list")
async def list_standard_shapes():
    """List all available standard shapes with their required dimensions."""
    return {
        "success": True,
        "shapes": {
            "i_beam": {"description": "I-beam (W-shape)", "dimensions": ["depth", "width", "web_thickness", "flange_thickness"]},
            "channel": {"description": "Channel (C-shape)", "dimensions": ["depth", "width", "web_thickness", "flange_thickness"]},
            "angle": {"description": "Angle (L-shape)", "dimensions": ["leg1", "leg2", "thickness"]},
            "rectangular": {"description": "Solid rectangle", "dimensions": ["width", "depth"]},
            "circular": {"description": "Solid circle", "dimensions": ["diameter", "segments (optional)"]},
            "tee": {"description": "T-section", "dimensions": ["width", "depth", "web_thickness", "flange_thickness"]},
        },
    }


# ── Material & Plate Element Endpoints ──

@router.post("/materials/create", tags=["Materials"])
async def create_material(request: CreateMaterialRequest, req: Request):
    """Create a material model for non-linear analysis."""
    try:
        from analysis.material_models import create_material_from_dict

        material = create_material_from_dict(request.model_dump())

        if not hasattr(req.app.state, "materials"):
            req.app.state.materials = {}

        material_id = f"mat_{len(req.app.state.materials) + 1}"
        req.app.state.materials[material_id] = material
        return {"success": True, "material_id": material_id}
    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/elements/plate/create", tags=["Elements"])
async def create_plate(_: CreatePlateRequest, __: Request):
    """Deprecated: plate elements are Rust-only now."""
    raise HTTPException(
        status_code=410,
        detail="Python plate element creation has been removed. Use the Rust backend endpoints.",
    )
