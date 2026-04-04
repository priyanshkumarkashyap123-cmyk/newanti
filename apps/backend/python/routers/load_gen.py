"""
Load Generation Endpoints — ASCE 7, IS 1893, Load Combinations
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict
import asyncio

router = APIRouter(tags=["Load Generation"])


# ── Request Models ──

class ASCE7SeismicRequest(BaseModel):
    Ss: float = 1.0
    S1: float = 0.4
    site_class: str = "D"
    risk_category: int = 2
    structural_system: str = "SMF_S"
    height: float = 30.0
    direction: str = "X"
    nodes: Optional[Dict[str, Dict]] = None
    dead_loads: Optional[Dict[str, float]] = None
    live_loads: Optional[Dict[str, float]] = None


class ASCE7WindRequest(BaseModel):
    V: float = 115.0
    exposure: str = "C"
    height: float = 30.0
    width: float = 20.0
    length: float = 30.0
    direction: str = "X"
    nodes: Optional[Dict[str, Dict]] = None


class IS1893SeismicRequest(BaseModel):
    zone: int = 3
    soil_type: str = "MEDIUM"
    building_type: str = "SMRF"
    importance: str = "ORDINARY"
    height: float = 30.0
    direction: str = "X"
    nodes: Optional[Dict[str, Dict]] = None
    dead_loads: Optional[Dict[str, float]] = None
    live_loads: Optional[Dict[str, float]] = None
    accidental_eccentricity_percent: Optional[float] = None  # e.g., 5.0 for 5% per IS 1893 Cl. 7.9.1
    apply_live_load_reduction: bool = True  # Apply IS 875 Part 2 reduction factors


class MovingLoadRequest(BaseModel):
    """
    Moving load generation for bridges per IRC 6:2017, AASHTO, Eurocode.
    
    Generates load cases at incremental vehicle positions and produces
    maximum force envelope.
    """
    vehicle_type: str = "IRC_CLASS_A"  # Standard: IRC_CLASS_A, IRC_70R, AASHTO_HL93, etc.
    custom_vehicle: Optional[Dict] = None  # {name, axles: [{load, spacing, width}]}
    lane_members: List[str] = []  # Sequential member IDs forming the lane
    step_size: float = 0.5  # Distance increment for vehicle positions (m)
    impact_factor: Optional[float] = None  # Dynamic amplification; if None, use standard
    num_lanes: int = 1  # Number of parallel lanes to analyze
    lane_spacing: float = 3.5  # Distance between lane centerlines (m)
    nodes: Optional[Dict[str, Dict]] = None  # node_id -> {x, y, z, ...}
    members: Optional[List[Dict]] = None  # member dicts with start_node_id, end_node_id


class LoadCombinationRequest(BaseModel):
    codes: List[str] = ["ASCE7_LRFD", "IS456_LSM"]
    custom_combinations: Optional[List[Dict]] = None


# ── Endpoints ──

@router.post("/load-generation/asce7-seismic")
async def generate_asce7_seismic_loads(request: ASCE7SeismicRequest):
    """Generate seismic loads per ASCE 7-22 Equivalent Lateral Force procedure."""
    try:
        from analysis.generators.asce7_seismic import (
            ASCE7SeismicGenerator, ASCE7SeismicParams,
            SiteClass, RiskCategory, StructuralSystem
        )

        params = ASCE7SeismicParams(
            Ss=request.Ss, S1=request.S1,
            site_class=SiteClass(request.site_class),
            risk_category=RiskCategory(request.risk_category),
            structural_system=StructuralSystem(request.structural_system),
            height=request.height, direction=request.direction
        )

        generator = ASCE7SeismicGenerator(params)
        result = await asyncio.to_thread(
            generator.analyze,
            request.nodes or {}, request.dead_loads or {}, request.live_loads or {}
        )

        return {
            "success": result.success,
            "code": "ASCE 7-22",
            "method": "Equivalent Lateral Force",
            "parameters": {
                "Ss": request.Ss, "S1": request.S1,
                "Fa": round(result.Fa, 3), "Fv": round(result.Fv, 3),
                "SDS": round(result.SDS, 3), "SD1": round(result.SD1, 3),
            },
            "period": {
                "Ta": round(result.Ta, 3),
                "T_used": round(result.T, 3),
                "Cu": round(result.Cu, 2)
            },
            "design": {
                "SDC": result.SDC, "R": result.R,
                "Ie": result.Ie, "Cs": round(result.Cs, 4)
            },
            "forces": {
                "W": round(result.W, 2), "V": round(result.V, 2),
                "V_percent_W": round(result.Cs * 100, 2)
            },
            "story_forces": [
                {
                    "level": s.level, "height": round(s.height, 2),
                    "weight": round(s.seismic_weight, 2),
                    "force": round(s.lateral_force, 2),
                    "shear": round(s.shear, 2)
                }
                for s in result.story_forces
            ],
            "nodal_loads": result.nodal_loads
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/load-generation/asce7-wind")
async def generate_asce7_wind_loads(request: ASCE7WindRequest):
    """Generate wind loads per ASCE 7-22 Directional Procedure."""
    try:
        from analysis.generators.asce7_wind import (
            ASCE7WindGenerator, ASCE7WindParams, ExposureCategory
        )

        params = ASCE7WindParams(
            V=request.V, exposure=ExposureCategory(request.exposure),
            height=request.height, width=request.width,
            length=request.length, direction=request.direction
        )

        generator = ASCE7WindGenerator(params)
        result = await asyncio.to_thread(generator.analyze, request.nodes or {})

        return {
            "success": result.success,
            "code": "ASCE 7-22",
            "method": "Directional Procedure",
            "parameters": {
                "V": request.V, "exposure": request.exposure,
                "Kd": round(result.Kd, 2), "Ke": round(result.Ke, 3),
                "Kz": round(result.Kz, 3), "Kzt": round(result.Kzt, 3)
            },
            "pressures": {
                "qh": round(result.qh, 3), "GCpi": round(result.GCpi, 2),
                "Cp_windward": result.Cp_windward, "Cp_leeward": result.Cp_leeward,
                "Cp_side": result.Cp_side, "Cp_roof": result.Cp_roof
            },
            "forces": {
                "base_shear_kN": round(result.total_base_shear, 2),
                "overturning_moment_kNm": round(result.total_overturning_moment, 2)
            },
            "pressure_at_heights": [
                {
                    "height": round(p.height, 2), "qz": round(p.qz, 3),
                    "Kz": round(p.Kz, 3), "p_windward": round(p.p_windward, 3),
                    "p_leeward": round(p.p_leeward, 3), "p_net": round(p.p_net, 3)
                }
                for p in result.pressures
            ],
            "nodal_loads": result.nodal_loads
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/load-generation/is1893-seismic")
async def generate_is1893_seismic_loads(request: IS1893SeismicRequest):
    """
    Generate seismic loads per IS 1893:2016 Static Method.
    
    Optionally generates accidental torsional load cases per Cl. 7.9.1
    and applies live load reduction per IS 875 Part 2 if requested.
    """
    try:
        from analysis.generators.auto_loads import (
            SeismicLoadGenerator, SeismicParameters,
            SeismicZone, SoilType, BuildingType, ImportanceCategory
        )

        zone_map = {2: SeismicZone.II, 3: SeismicZone.III, 4: SeismicZone.IV, 5: SeismicZone.V}
        soil_map = {"ROCK": SoilType.ROCK, "MEDIUM": SoilType.MEDIUM, "SOFT": SoilType.SOFT}
        building_map = {
            "OMRF": BuildingType.ORDINARY_RC_MRF, "SMRF": BuildingType.SPECIAL_RC_MRF,
            "OSMRF": BuildingType.ORDINARY_STEEL_MRF, "SSMRF": BuildingType.SPECIAL_STEEL_MRF,
            "BF": BuildingType.BRACED_FRAME, "SW": BuildingType.SHEAR_WALL,
            "DUAL": BuildingType.DUAL_SYSTEM
        }
        importance_map = {
            "ORDINARY": ImportanceCategory.ORDINARY,
            "IMPORTANT": ImportanceCategory.IMPORTANT,
            "CRITICAL": ImportanceCategory.CRITICAL
        }

        params = SeismicParameters(
            zone=zone_map.get(request.zone, SeismicZone.III),
            soil_type=soil_map.get(request.soil_type.upper(), SoilType.MEDIUM),
            building_type=building_map.get(request.building_type.upper(), BuildingType.SPECIAL_RC_MRF),
            importance=importance_map.get(request.importance.upper(), ImportanceCategory.ORDINARY),
            height=request.height, direction=request.direction
        )

        generator = SeismicLoadGenerator(params)
        nodes = request.nodes or {}
        dead_loads = request.dead_loads or {}
        live_loads = request.live_loads or {}

        if nodes and dead_loads:
            def _compute_is1893():
                # Apply live load reduction if requested (IS 875 Part 2 Cl. 3.2.1)
                live_loads_applied = live_loads
                if request.apply_live_load_reduction and live_loads:
                    # Simplified live load reduction per IS 875-2
                    # Area reduction: R_A = 0.5 + 5/√A for A > 50 m² (else 1.0)
                    # Floor reduction: per number of floors
                    total_area_m2 = len(nodes) * 10  # Rough estimate: 10 m² per node
                    num_floors = max(1, int(request.height / 3.5))  # Rough estimate: 3.5m per floor
                    
                    # Area reduction factor
                    area_factor = 1.0 if total_area_m2 <= 50.0 else (0.5 + 5.0 / (total_area_m2 ** 0.5))
                    area_factor = min(area_factor, 1.0)
                    
                    # Floor reduction factor
                    floor_factors = {0: 1.0, 1: 1.0, 2: 0.90, 3: 0.80, 4: 0.70}
                    floor_factor = floor_factors.get(min(num_floors, 4), 0.60)
                    
                    reduction_factor = area_factor * floor_factor
                    live_loads_applied = {nid: ll * reduction_factor for nid, ll in live_loads.items()}
                
                generator.compute_floor_masses(nodes, dead_loads, live_loads_applied)
                generator.calculate_base_shear()
                generator.distribute_lateral_forces()
                generator.generate_nodal_loads()
            
            await asyncio.to_thread(_compute_is1893)

        # Main load cases
        result = {
            "success": True,
            "code": "IS 1893:2016",
            "method": "Equivalent Static Method",
            "parameters": {
                "zone": f"Zone {request.zone}",
                "Z": round(params.zone.factor, 2),
                "soil_type": request.soil_type,
                "I": round(params.importance.factor, 2),
                "R": round(params.building_type.R, 2)
            },
            "analysis": {
                "Ta": round(generator.calculate_period(), 3),
                "Sa_g": round(generator.calculate_Sa_g(generator.calculate_period()), 3),
                "Ah": round(generator.calculate_Ah(), 4)
            },
            "forces": {
                "W": round(generator.total_seismic_weight, 2),
                "Vb": round(generator.base_shear, 2)
            },
            "story_forces": [
                {
                    "level": fm.level, "height": round(fm.y_height, 2),
                    "weight": round(fm.seismic_weight, 2),
                    "force_kN": round(fm.lateral_force, 2)
                }
                for fm in generator.floor_masses
            ],
            "nodal_loads": generator.nodal_loads if hasattr(generator, 'nodal_loads') else [],
            "live_load_reduction_applied": request.apply_live_load_reduction
        }
        
        # Generate accidental torsional load cases if eccentricity specified
        # Per IS 1893 Cl. 7.9.1: accidental eccentricity = 0.05 × building dimension
        if request.accidental_eccentricity_percent:
            ecc_percent = request.accidental_eccentricity_percent / 100.0
            
            # Generate 4 torsional cases: +eX, -eX, +eZ, -eZ
            # Simplified: multiply lateral forces at each floor by eccentricity lever arm
            torsional_cases = []
            
            for direction in ['X_PLUS', 'X_MINUS', 'Z_PLUS', 'Z_MINUS']:
                # Estimated building width/depth; apply eccentric moment
                building_dim = max(10.0, request.height / 2.5)  # Rough estimate
                eccentricity = building_dim * ecc_percent
                
                torsional_moment_per_floor = []
                for fm in generator.floor_masses:
                    # Torsional moment = lateral force × eccentricity
                    torsion_moment = fm.lateral_force * eccentricity
                    torsional_moment_per_floor.append({
                        "level": fm.level,
                        "height": round(fm.y_height, 2),
                        "torsional_moment_kNm": round(torsion_moment, 2),
                        "direction": direction
                    })
                
                torsional_cases.append({
                    "case_name": f"Seismic-Torsion-{direction}",
                    "eccentricity_percent": request.accidental_eccentricity_percent,
                    "eccentricity_m": round(eccentricity, 3),
                    "moments": torsional_moment_per_floor
                })
            
            result["torsional_cases"] = torsional_cases
            result["torsional_note"] = f"Accidental eccentricity = {request.accidental_eccentricity_percent}% × building width (IS 1893 Cl. 7.9.1)"
        
        return result

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))



@router.post("/load-generation/moving-loads")
async def generate_moving_loads(request: MovingLoadRequest):
    """
    Generate moving vehicle load cases for bridge analysis.
    
    Implements IRC 6:2017, AASHTO, Eurocode vehicle models.
    
    Returns:
    - Load cases at each vehicle position
    - Maximum force envelope (moment, shear, reaction)
    - Critical vehicle position for maximum effects
    """
    try:
        from analysis.generators.moving_load import (
            MovingLoadGenerator, Vehicle, Axle, Lane, LanePoint, STANDARD_VEHICLES
        )
        
        # Select or create vehicle
        if request.custom_vehicle:
            # Build custom vehicle from request
            axles = [
                Axle(load=a['load'], spacing=a['spacing'], width=a.get('width', 1.8))
                for a in request.custom_vehicle.get('axles', [])
            ]
            vehicle = Vehicle(
                name=request.custom_vehicle.get('name', 'Custom Vehicle'),
                axles=axles,
                impact_factor=request.impact_factor or 1.0
            )
        else:
            # Use standard vehicle
            vehicle = STANDARD_VEHICLES.get(request.vehicle_type.upper())
            if not vehicle:
                raise ValueError(f"Unknown vehicle type: {request.vehicle_type}")
            if request.impact_factor:
                vehicle.impact_factor = request.impact_factor
        
        # Build lane from member sequence
        nodes = request.nodes or {}
        members = request.members or []
        
        if not members:
            raise ValueError("lane_members or members list required")
        
        lane = Lane.from_members(members, nodes, name="Lane 1")
        
        # Generate moving loads
        generator = MovingLoadGenerator(
            vehicle=vehicle,
            lane=lane,
            step_size=request.step_size,
            impact_factor=request.impact_factor
        )
        
        # Run generation in thread to avoid blocking
        def _generate():
            generator.generate_load_positions()
            generator.generate_envelopes()
        
        await asyncio.to_thread(_generate)
        
        # Prepare response
        envelopes = [env.to_dict() for env in generator.envelopes.values()]
        
        return {
            "success": True,
            "standard": "IRC 6:2017 / AASHTO / Eurocode",
            "vehicle": {
                "name": vehicle.name,
                "total_load_kN": round(vehicle.total_load, 2),
                "total_length_m": round(vehicle.total_length, 3),
                "impact_factor": round(vehicle.impact_factor, 3),
                "num_axles": len(vehicle.axles)
            },
            "lane": {
                "name": lane.name,
                "total_length_m": round(lane.total_length, 2),
                "members_count": len(lane.member_sequence)
            },
            "analysis": {
                "step_size_m": request.step_size,
                "num_positions": len(generator.load_positions),
                "num_lanes": request.num_lanes
            },
            "envelopes": envelopes,
            "max_envelope": {
                "max_moment_kNm": max(e['absolute_max_moment'] for e in envelopes) if envelopes else 0,
                "max_shear_kN": max(e['absolute_max_shear'] for e in envelopes) if envelopes else 0,
                "max_reaction_kN": max(e.get('absolute_max_reaction', 0) for e in envelopes) if envelopes else 0
            },
            "load_cases_generated": len(generator.load_positions),
            "recommendation": "Use envelopes for design; critical positions indicate worst-case vehicle locations"
        }
    
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/load-combinations/generate")
async def generate_load_combinations(request: LoadCombinationRequest):
    """Generate load combinations per specified design codes."""
    try:
        from analysis.generators.load_combinations import (
            LoadCombinationsManager, DesignCode
        )

        manager = LoadCombinationsManager()
        code_map = {
            "ASCE7_LRFD": DesignCode.ASCE7_LRFD,
            "ASCE7_ASD": DesignCode.ASCE7_ASD,
            "IS456_LSM": DesignCode.IS456_LSM,
            "ACI318": DesignCode.ACI318
        }

        for code_name in request.codes:
            code = code_map.get(code_name.upper())
            if code:
                manager.load_predefined(code)

        if request.custom_combinations:
            for custom in request.custom_combinations:
                manager.add_user_combination(
                    name=custom.get("name", "Custom"),
                    factors=custom.get("factors", {}),
                    description=custom.get("description", "")
                )

        summary = manager.get_summary()
        return {
            "success": True,
            "total_combinations": summary["total_combinations"],
            "active_combinations": summary["active_combinations"],
            "user_defined": summary["user_defined"],
            "codes_included": list(set(request.codes)),
            "combinations": [
                {
                    "id": c.id, "name": c.name, "code": c.code,
                    "expression": c.format_expression(),
                    "factors": [{"type": f.load_type, "factor": f.factor} for f in c.factors],
                    "is_user_defined": c.is_user_defined
                }
                for c in manager.combinations
            ]
        }

    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/load-combinations/available")
async def get_available_combinations():
    """Get all available predefined load combinations organized by code."""
    try:
        from analysis.generators.load_combinations import get_all_available_combinations

        all_combos = get_all_available_combinations()
        return {
            "codes": list(all_combos.keys()),
            "combinations": {
                code: [{"id": c.id, "name": c.name, "expression": c.format_expression()} for c in combos]
                for code, combos in all_combos.items()
            }
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
