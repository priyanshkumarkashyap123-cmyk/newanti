"""
Design code checking endpoints (modularized).
"""

import asyncio
import traceback
from fastapi import APIRouter, HTTPException

from ..design_schemas import DesignCheckRequest

router = APIRouter(tags=["Design"])


@router.get("/design/codes")
async def list_design_codes():
    """Return the supported design code catalog used by the Python backend."""
    from design.sign_convention import DesignCodeType

    return {
        "success": True,
        "codes": [code.value for code in DesignCodeType],
    }


@router.post("/design/check")
async def check_design(request: DesignCheckRequest):
    """Perform code checking (AISC, Eurocode, etc.) on structure."""
    try:
        from design import DesignFactory, DesignMember

        code = DesignFactory.get_code(request.code)
        if not code:
            raise HTTPException(status_code=400, detail=f"Design code '{request.code}' not supported")

        results = {}
        for m_data in request.members:
            try:
                member = DesignMember(
                    id=m_data.member_id,
                    section_name=m_data.section_name,
                    section_properties=m_data.section_properties,
                    length=m_data.length,
                    material=m_data.material,
                    forces=m_data.forces,
                    unbraced_length_major=m_data.unbraced_length_major if m_data.unbraced_length_major is not None else m_data.length,
                    unbraced_length_minor=m_data.unbraced_length_minor if m_data.unbraced_length_minor is not None else m_data.length,
                    unbraced_length_ltb=m_data.unbraced_length_ltb if m_data.unbraced_length_ltb is not None else m_data.length,
                    effective_length_factor_major=m_data.Kx,
                    effective_length_factor_minor=m_data.Ky,
                    cb=m_data.Cb,
                )

                res = await asyncio.to_thread(code.check_member, member)
                results[member.id] = {
                    "ratio": res.ratio,
                    "status": res.status,
                    "governing": res.governing_check,
                    "capacity": res.capacity,
                    "log": res.calculation_log,
                }
            except Exception as item_err:  # noqa: BLE001
                results[m_data.member_id] = {"error": str(item_err), "status": "ERROR"}

        return {"success": True, "code": code.code_name, "results": results}

    except Exception as e:  # noqa: BLE001
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))
