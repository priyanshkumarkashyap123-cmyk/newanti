"""
Steel member design endpoints (IS 800:2007).
"""

from fastapi import APIRouter, HTTPException

from .design_schemas import SteelMemberDesignRequest

router = APIRouter(tags=["Design"])


@router.post("/design/steel")
async def design_steel_member(request: SteelMemberDesignRequest):
    """
    Design steel member per IS 800:2007

    Complete design check including:
    - Section classification (Plastic/Compact/Semi-compact/Slender)
    - Tension capacity (Cl. 6)
    - Compression capacity with buckling curves (Cl. 7)
    - Flexural capacity with LTB (Cl. 8)
    - Shear capacity (Cl. 8.4)
    - Combined axial + bending interaction (Cl. 9)
    """
    try:
        import math
        from design.steel.is800 import (
            IS800Designer, SectionProperties, MemberGeometry,
            DesignForces, SteelGrade
        )

        grade_map = {
            'E250': SteelGrade.E250, 'FE250': SteelGrade.FE250,
            'E275': SteelGrade.E275, 'E300': SteelGrade.E300,
            'E350': SteelGrade.E350, 'E410': SteelGrade.E410,
            'E450': SteelGrade.E450
        }
        steel_grade = grade_map.get(request.steel_grade.upper(), SteelGrade.E250)

        s = request
        area = s.area or (s.depth * s.web_thickness + 2 * s.width * s.flange_thickness)

        d = s.depth
        bf = s.width
        tw = s.web_thickness
        tf = s.flange_thickness
        hw = d - 2 * tf

        Iz = s.Iz or (tw * hw**3 / 12 + 2 * bf * tf * ((hw + tf) / 2)**2 + 2 * bf * tf**3 / 12)
        Iy = s.Iy or (2 * tf * bf**3 / 12 + hw * tw**3 / 12)
        Zz = s.Zz or (Iz / (d / 2)) if Iz > 0 else 0
        Zy = s.Zy or (Iy / (bf / 2)) if Iy > 0 else 0
        Zpz = s.Zpz or Zz
        Zpy = s.Zpy or Zy
        rz = s.rz or math.sqrt(Iz / area) if area > 0 else 0
        ry = s.ry or math.sqrt(Iy / area) if area > 0 else 0

        section_props = SectionProperties(
            area=area, depth=d, width=bf, tw=tw, tf=tf,
            rz=rz, ry=ry, Iz=Iz, Iy=Iy, Zz=Zz, Zy=Zy, Zpz=Zpz, Zpy=Zpy,
            root_radius=s.root_radius
        )

        member_geometry = MemberGeometry(
            length=s.length,
            effective_length_y=s.effective_length_y or s.length,
            effective_length_z=s.effective_length_z or s.length,
            unbraced_length=s.unbraced_length or s.length,
            Cb=s.Cb
        )

        forces = DesignForces(
            N=s.N, Vy=s.Vy, Vz=s.Vz, My=s.My, Mz=s.Mz, T=s.T
        )

        designer = IS800Designer(grade=steel_grade)
        result = designer.design_member(section_props, member_geometry, forces, code=s.code)

        return {
            "success": True,
            "status": result.status,
            "governing": result.governing,
            "utilization": result.utilization,
            "checks": result.checks,
            "classification": result.classification,
            "capacities": {
                "N_tension": result.capacities.N_tension,
                "N_compression": result.capacities.N_compression,
                "V_y": result.capacities.V_y,
                "V_z": result.capacities.V_z,
                "M_y": result.capacities.M_y,
                "M_z": result.capacities.M_z,
                "T": result.capacities.T
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
