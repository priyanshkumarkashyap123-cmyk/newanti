from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from design.concrete.is456 import IS456Designer, BeamSection, ColumnSection

router = APIRouter(prefix="/design", tags=["Design"])

# Request Models
class MemberForces(BaseModel):
    axial: float = 0.0      # kN
    shearY: float = 0.0     # kN
    shearZ: float = 0.0     # kN
    torsion: float = 0.0    # kNm
    momentY: float = 0.0    # kNm (Bending about Y)
    momentZ: float = 0.0    # kNm (Bending about Z - Major axis usually)

class DesignMember(BaseModel):
    id: str
    type: str = "beam"    # "beam" or "column"
    width: float          # mm
    depth: float          # mm
    length: float         # mm
    effective_length_factor: float = 1.0
    forces: MemberForces
    fck: float = 25       # MPa
    fy: float = 500       # MPa
    cover: float = 25     # mm

class ConcreteDesignRequest(BaseModel):
    members: List[DesignMember]

# Response Models
class DesignCheckResult(BaseModel):
    name: str
    demand: float
    capacity: float
    ratio: float
    unit: str
    status: str

class RebarInfo(BaseModel):
    count: int
    diameter: float
    spacing: Optional[float] = 0

class MemberResult(BaseModel):
    memberId: str
    status: str
    overallRatio: float
    checks: List[DesignCheckResult]
    details: Dict[str, Any] # Flexible for Beam/Column specific details

@router.post("/concrete/check", response_model=List[MemberResult])
async def check_concrete_members(request: ConcreteDesignRequest):
    results = []
    
    for m in request.members:
        try:
            designer = IS456Designer(fck=m.fck, fy=m.fy)
            
            if m.type.lower() == "column" or abs(m.forces.axial) > 10: # Treat as column if significant axial load
                # Column Design
                section = ColumnSection(width=m.width, depth=m.depth, cover=m.cover)
                res = designer.design_column(
                    section=section,
                    Pu=abs(m.forces.axial),
                    Mux=abs(m.forces.momentZ), # Moment about major axis
                    Muy=abs(m.forces.momentY), # Moment about minor axis
                    unsupported_length=m.length,
                    effective_length_factor=m.effective_length_factor
                )
                
                # Convert to API response format
                api_checks = []
                 # Axial Check
                api_checks.append(DesignCheckResult(
                    name="Axial Capacity", 
                    demand=abs(m.forces.axial),
                    capacity=res.Pu_capacity,
                    ratio=abs(m.forces.axial)/res.Pu_capacity if res.Pu_capacity > 0 else 999.0,
                    unit="kN",
                    status="fail" if abs(m.forces.axial) > res.Pu_capacity else "pass"
                ))
                
                results.append(MemberResult(
                    memberId=m.id,
                    status=res.status.lower(),
                    overallRatio=res.interaction_ratio,
                    checks=api_checks,
                    details={
                        "main_bars": f"{res.longitudinal_steel[0].count}-{res.longitudinal_steel[0].diameter}φ",
                        "ties": f"{res.ties.diameter}φ @ {res.ties.spacing}mm"
                    }
                ))

            else:
                # Beam Design
                section = BeamSection(width=m.width, depth=m.depth, effective_depth=m.depth-m.cover-10, cover=m.cover)
                res = designer.design_beam(
                    section=section,
                    Mu=abs(m.forces.momentZ), # Major axis bending
                    Vu=abs(m.forces.shearY)   # Major shear
                )
                
                api_checks = []
                # Flexure
                api_checks.append(DesignCheckResult(
                    name="Flexure",
                    demand=abs(m.forces.momentZ),
                    capacity=res.Mu_capacity,
                    ratio=abs(m.forces.momentZ)/res.Mu_capacity if res.Mu_capacity > 0 else 999.0,
                    unit="kNm",
                    status="fail" if abs(m.forces.momentZ) > res.Mu_capacity else "pass"
                ))
                # Shear
                api_checks.append(DesignCheckResult(
                    name="Shear",
                    demand=abs(m.forces.shearY),
                    capacity=res.Vu_capacity,
                    ratio=abs(m.forces.shearY)/res.Vu_capacity if res.Vu_capacity > 0 else 999.0,
                    unit="kN",
                    status="fail" if abs(m.forces.shearY) > res.Vu_capacity else "pass"
                ))

                results.append(MemberResult(
                    memberId=m.id,
                    status=res.status.lower(),
                    overallRatio=max([c.ratio for c in api_checks]) if api_checks else 0.0,
                    checks=api_checks,
                    details={
                        "top_bars": f"{res.compression_steel.count}-{res.compression_steel.diameter}φ" if res.compression_steel else "-",
                        "bottom_bars": f"{res.tension_steel.count}-{res.tension_steel.diameter}φ",
                        "stirrups": f"{res.stirrups.diameter}φ @ {res.stirrups.spacing}mm"
                    }
                ))

        except Exception as e:
            results.append(MemberResult(
                memberId=m.id,
                status="fail",
                overallRatio=0,
                checks=[DesignCheckResult(name="Error", demand=0, capacity=0, ratio=0, unit="", status="fail")],
                details={"error": str(e)}
            ))
            
    return results
