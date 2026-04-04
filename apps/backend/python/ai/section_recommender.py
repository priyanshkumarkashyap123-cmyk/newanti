"""
Section Recommendation Engine
AI-powered section optimization for structural design
"""

import json
import os
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import math
import numpy as np
from pathlib import Path

class SectionType(Enum):
    STEEL_I = "steel_i"
    STEEL_CHANNEL = "steel_channel"
    STEEL_ANGLE = "steel_angle"
    STEEL_TUBE = "steel_tube"
    STEEL_PIPE = "steel_pipe"
    CONCRETE_RECT = "concrete_rect"
    CONCRETE_CIRC = "concrete_circ"

@dataclass
class SectionProperties:
    """Complete section properties"""
    name: str
    section_type: SectionType
    area: float  # mm²
    iy: float    # mm⁴
    iz: float    # mm⁴
    j: float     # mm⁴
    weight_per_m: float  # kg/m
    cost_per_m: float    # INR/m (approximate)
    fy: float    # MPa (yield strength)
    manufacture: str  # e.g., "SAIL", "TATA", "JSW"

@dataclass
class DesignRequirements:
    """Design requirements for section selection"""
    axial_force: float  # kN (positive = compression)
    shear_force: float  # kN
    bending_moment: float  # kN·m
    deflection_limit: float  # mm (optional)
    span_length: float  # m (for deflection check)
    code: str  # "IS800", "AISC360", "EC3"
    material: str  # "steel", "concrete"
    utilization_target: float  # target utilization ratio (0.8 = 80%)

@dataclass
class RecommendationResult:
    """Section recommendation result"""
    section: SectionProperties
    # Overall utilization used for ranking (>=0, where 1.0 = meets target)
    utilization: float
    # Detailed utilization/capacities (used to populate frontend contract)
    axial_capacity_kN: float
    shear_capacity_kN: float
    moment_capacity_kNm: float
    utilization_axial: float
    utilization_shear: float
    utilization_moment: float
    deflection_check_mm: Optional[float]
    safety_margin: float
    cost_score: float
    weight_score: float
    rank_score: float
    checks_passed: List[str]
    warnings: List[str]

class SectionDatabase:
    """Database of structural sections"""

    def __init__(self):
        self.sections: List[SectionProperties] = []
        self._load_sections()

    def _load_sections(self):
        """Load section database"""
        # IS 808 Steel Sections
        is_sections = [
            # ISMB (Indian Standard Medium Weight Beams)
            SectionProperties("ISMB100", SectionType.STEEL_I, 1270, 1.22e6, 38.4e3, 2.45e3, 10.0, 120.0, 250, "SAIL"),
            SectionProperties("ISMB125", SectionType.STEEL_I, 1560, 2.52e6, 55.7e3, 4.05e3, 12.3, 145.0, 250, "SAIL"),
            SectionProperties("ISMB150", SectionType.STEEL_I, 1880, 4.55e6, 80.2e3, 6.85e3, 14.8, 175.0, 250, "SAIL"),
            SectionProperties("ISMB175", SectionType.STEEL_I, 2210, 7.65e6, 112e3, 10.4e3, 17.4, 205.0, 250, "SAIL"),
            SectionProperties("ISMB200", SectionType.STEEL_I, 2570, 11.5e6, 152e3, 15.2e3, 20.2, 240.0, 250, "SAIL"),
            SectionProperties("ISMB225", SectionType.STEEL_I, 2940, 16.2e6, 201e3, 21.1e3, 23.1, 275.0, 250, "SAIL"),
            SectionProperties("ISMB250", SectionType.STEEL_I, 3340, 22.1e6, 261e3, 28.2e3, 26.3, 310.0, 250, "SAIL"),
            SectionProperties("ISMB300", SectionType.STEEL_I, 4420, 41.5e6, 452e3, 53.8e3, 34.8, 410.0, 250, "SAIL"),
            SectionProperties("ISMB350", SectionType.STEEL_I, 5550, 68.4e6, 715e3, 85.4e3, 43.7, 515.0, 250, "SAIL"),
            SectionProperties("ISMB400", SectionType.STEEL_I, 6740, 102e6, 1050e3, 126e3, 53.1, 625.0, 250, "SAIL"),
            SectionProperties("ISMB450", SectionType.STEEL_I, 8020, 144e6, 1470e3, 177e3, 63.2, 745.0, 250, "SAIL"),
            SectionProperties("ISMB500", SectionType.STEEL_I, 9390, 196e6, 2010e3, 243e3, 73.9, 870.0, 250, "SAIL"),
            SectionProperties("ISMB550", SectionType.STEEL_I, 10800, 258e6, 2670e3, 323e3, 85.0, 1000.0, 250, "SAIL"),
            SectionProperties("ISMB600", SectionType.STEEL_I, 12300, 333e6, 3470e3, 421e3, 96.8, 1140.0, 250, "SAIL"),

            # ISMC (Indian Standard Medium Weight Channels)
            SectionProperties("ISMC75", SectionType.STEEL_CHANNEL, 1110, 2.45e5, 7.95e4, 1.23e3, 8.7, 100.0, 250, "SAIL"),
            SectionProperties("ISMC100", SectionType.STEEL_CHANNEL, 1430, 5.59e5, 1.49e5, 2.85e3, 11.3, 130.0, 250, "SAIL"),
            SectionProperties("ISMC125", SectionType.STEEL_CHANNEL, 1790, 10.3e5, 2.45e5, 5.05e3, 14.1, 165.0, 250, "SAIL"),
            SectionProperties("ISMC150", SectionType.STEEL_CHANNEL, 2180, 17.2e5, 3.89e5, 8.35e3, 17.2, 200.0, 250, "SAIL"),
            SectionProperties("ISMC175", SectionType.STEEL_CHANNEL, 2580, 26.2e5, 5.75e5, 12.5e3, 20.3, 240.0, 250, "SAIL"),
            SectionProperties("ISMC200", SectionType.STEEL_CHANNEL, 3010, 38.0e5, 8.11e5, 17.8e3, 23.7, 280.0, 250, "SAIL"),
            SectionProperties("ISMC225", SectionType.STEEL_CHANNEL, 3450, 52.4e5, 10.9e5, 24.2e3, 27.2, 320.0, 250, "SAIL"),
            SectionProperties("ISMC250", SectionType.STEEL_CHANNEL, 3910, 69.8e5, 14.3e5, 32.0e3, 30.8, 360.0, 250, "SAIL"),
            SectionProperties("ISMC300", SectionType.STEEL_CHANNEL, 4420, 107e5, 21.2e5, 48.0e3, 34.8, 410.0, 250, "SAIL"),
            SectionProperties("ISMC400", SectionType.STEEL_CHANNEL, 6310, 231e5, 47.1e5, 111e3, 49.7, 585.0, 250, "SAIL"),
        ]

        # AISC W-Shapes (subset)
        aisc_sections = [
            SectionProperties("W8x10", SectionType.STEEL_I, 2940, 3.89e6, 98.7e3, 4.91e3, 8.7, 150.0, 345, "AISC"),
            SectionProperties("W10x12", SectionType.STEEL_I, 3530, 6.74e6, 159e3, 8.42e3, 10.6, 180.0, 345, "AISC"),
            SectionProperties("W12x14", SectionType.STEEL_I, 4120, 10.3e6, 249e3, 13.1e3, 12.3, 200.0, 345, "AISC"),
            SectionProperties("W14x22", SectionType.STEEL_I, 6470, 22.1e6, 541e3, 28.2e3, 19.3, 280.0, 345, "AISC"),
            SectionProperties("W16x26", SectionType.STEEL_I, 7650, 32.9e6, 764e3, 41.4e3, 22.6, 320.0, 345, "AISC"),
            SectionProperties("W18x35", SectionType.STEEL_I, 10300, 57.6e6, 1360e3, 72.3e3, 30.7, 450.0, 345, "AISC"),
            SectionProperties("W21x44", SectionType.STEEL_I, 12900, 91.4e6, 2040e3, 115e3, 38.7, 550.0, 345, "AISC"),
            SectionProperties("W24x55", SectionType.STEEL_I, 16200, 145e6, 3240e3, 183e3, 48.3, 680.0, 345, "AISC"),
            SectionProperties("W27x84", SectionType.STEEL_I, 24700, 285e6, 6470e3, 359e3, 73.7, 1050.0, 345, "AISC"),
            SectionProperties("W30x99", SectionType.STEEL_I, 29100, 381e6, 8500e3, 479e3, 87.0, 1250.0, 345, "AISC"),
        ]

        self.sections.extend(is_sections)
        self.sections.extend(aisc_sections)

    def find_sections(self, section_type: Optional[SectionType] = None,
                     min_area: float = 0, max_area: float = float('inf')) -> List[SectionProperties]:
        """Find sections matching criteria"""
        return [s for s in self.sections
                if (section_type is None or s.section_type == section_type) and
                   min_area <= s.area <= max_area]

class SectionRecommender:
    """AI-powered section recommendation engine"""

    def __init__(self):
        self.database = SectionDatabase()

    def recommend_sections(self, requirements: DesignRequirements,
                          max_results: int = 5) -> List[RecommendationResult]:
        """
        Recommend sections based on design requirements

        Returns sections ranked by overall score considering:
        - Safety/utilization
        - Cost efficiency
        - Weight optimization
        """
        candidates = self._filter_candidates(requirements)

        recommendations = []
        for section in candidates:
            result = self._evaluate_section(section, requirements)
            if result:
                recommendations.append(result)

        # Sort by rank score (lower is better)
        recommendations.sort(key=lambda x: x.rank_score)

        return recommendations[:max_results]

    def _filter_candidates(self, req: DesignRequirements) -> List[SectionProperties]:
        """Filter sections based on basic requirements"""
        # Determine section type
        section_type = None
        if req.material.lower() == "steel":
            section_type = SectionType.STEEL_I  # Default to I-beams
        elif req.material.lower() == "concrete":
            section_type = SectionType.CONCRETE_RECT

        # Estimate required area based on forces
        min_area = self._estimate_min_area(req)

        return self.database.find_sections(
            section_type=section_type,
            min_area=min_area * 0.5,  # Allow some smaller sections
            max_area=min_area * 3.0   # Allow up to 3x required area
        )

    def _estimate_min_area(self, req: DesignRequirements) -> float:
        """Estimate minimum required area based on forces"""
        # Simple estimation for steel sections
        if req.material.lower() == "steel":
            # Axial capacity: A * fy / γm0
            if abs(req.axial_force) > 0:
                axial_area = abs(req.axial_force) * 1000 * 1.1 / (250e6)  # kN to N, γm0=1.1
            else:
                axial_area = 1000  # minimum

            # Bending capacity: M / (fy * Z) where Z ≈ Iy / (depth/2)
            # Approximate Z ≈ Iy / 100 (rough estimate for I-beams)
            if req.bending_moment > 0:
                bending_area = req.bending_moment * 1e6 * 1.1 / (250e6 * 100)  # kN·m to N·mm
            else:
                bending_area = 1000

            return max(axial_area, bending_area, 2000)  # minimum 2000 mm²

        return 5000  # default for concrete

    def _evaluate_section(self, section: SectionProperties,
                         req: DesignRequirements) -> Optional[RecommendationResult]:
        """Evaluate a section against requirements using IS 800:2007 formulations."""
        checks_passed: List[str] = []
        warnings: List[str] = []

        if req.material.lower() != "steel":
            warnings.append("Concrete/other material not yet supported by deterministic engine.")
            return None

        # IS 800 Parameters
        gamma_m0 = 1.10
        E_steel = 200_000.0  # MPa
        G_steel = 76_923.0   # MPa
        A = max(section.area, 0.0)  # mm^2
        fy = max(section.fy, 0.0)   # MPa
        I_z = max(section.iz, 0.0)  # mm^4 (major)
        I_y = max(section.iy, 0.0)  # mm^4 (minor)
        J = max(section.j, 0.0)     # mm^4 (torsion)
        
        # Approximate geometric properties for LTB and Shear if true dimensions missing
        # For a typical I-section, Area ~ 2*bf*tf + (h-2tf)*tw, Iz ~ (bf*h^2/2) etc.
        # We approximate h and b to apply rigorous limits:
        h_approx = math.sqrt(12.0 * I_z / A) if A > 0 else 0.0
        r_y = math.sqrt(I_y / A) if A > 0 else 0.0
        r_z = math.sqrt(I_z / A) if A > 0 else 0.0
        r_min = min(r_y, r_z) if A > 0 else 0.0
        Z_e = I_z / (h_approx / 2.0) if h_approx > 0 else 0.0
        Z_p = Z_e * 1.14  # shape factor approx for I-beams
        
        L_mm = (req.span_length * 1000.0) if req.span_length else 3000.0 # Default 3m if missing
        
        # --- 1. Axial Capacity (IS 800:2007 Clause 7.1.2) ---
        axial_capacity_kN = 0.0
        if A > 0 and fy > 0 and r_min > 0:
            kL_r = L_mm / r_min
            f_cc = (math.pi**2 * E_steel) / (kL_r**2)
            lambda_nd = math.sqrt(fy / f_cc) if f_cc > 0 else float('inf')
            
            alpha = 0.49  # Conservative buckling class c
            phi = 0.5 * (1 + alpha * (lambda_nd - 0.2) + lambda_nd**2)
            
            if phi**2 > lambda_nd**2:
                chi = 1.0 / (phi + math.sqrt(phi**2 - lambda_nd**2))
            else:
                chi = 1.0 / phi
            chi = min(chi, 1.0)
            
            f_cd = (chi * fy) / gamma_m0
            axial_capacity_kN = (A * f_cd) / 1000.0
            
        utilization_axial = (abs(req.axial_force) / axial_capacity_kN) if axial_capacity_kN > 0 else (float("inf") if abs(req.axial_force) > 0 else 0.0)

        # --- 2. Bending Capacity / LTB (IS 800:2007 Clause 8.2) ---
        moment_capacity_kNm = 0.0
        if Z_p > 0 and fy > 0:
            # Calculate Elastic Critical Moment (Mcr)
            I_w = I_y * (h_approx**2) / 4.0  # Warping constant approx
            term1 = math.pi**2 * E_steel * I_y / (L_mm**2)
            term2 = G_steel * J + (math.pi**2 * E_steel * I_w) / (L_mm**2)
            M_cr = math.sqrt(term1 * term2) if term1>0 and term2>0 else 0.0
            
            if M_cr > 0:
                lambda_LT = math.sqrt((Z_p * fy) / M_cr)
                alpha_LT = 0.21  # Rolled steel I-sections (Class a for LTB)
                phi_LT = 0.5 * (1 + alpha_LT * (lambda_LT - 0.2) + lambda_LT**2)
                
                if phi_LT**2 > lambda_LT**2:
                    chi_LT = 1.0 / (phi_LT + math.sqrt(phi_LT**2 - lambda_LT**2))
                else:
                    chi_LT = 1.0 / phi_LT
                chi_LT = min(chi_LT, 1.0)
                
                f_bd = (chi_LT * fy) / gamma_m0
                capacity_Nmm = Z_p * f_bd
                moment_capacity_kNm = capacity_Nmm / 1e6
            else:
                moment_capacity_kNm = (Z_p * fy / gamma_m0) / 1e6

        utilization_moment = (abs(req.bending_moment) / moment_capacity_kNm) if moment_capacity_kNm > 0 else (float("inf") if abs(req.bending_moment) > 0 else 0.0)

        # --- 3. Shear Capacity (IS 800:2007 Clause 8.4) ---
        shear_capacity_kN = 0.0
        if A > 0 and fy > 0:
            # Shear area A_v approx = h * t_w. For I-beam, A_v ~ 0.4*A to 0.5*A loosely. Let's use 0.45*A conservative
            A_v = 0.45 * A 
            V_p = (A_v * fy) / (math.sqrt(3.0) * gamma_m0)
            shear_capacity_kN = V_p / 1000.0
            
        utilization_shear = (abs(req.shear_force) / shear_capacity_kN) if shear_capacity_kN > 0 else (float("inf") if abs(req.shear_force) > 0 else 0.0)

        # --- 4. Deflection Check (Clause 5.6.1) ---
        deflection_check_mm: Optional[float] = None
        utilization_deflection: Optional[float] = None
        if req.deflection_limit and req.span_length > 0:
            M_Nmm = abs(req.bending_moment) * 1e6
            if E_steel > 0 and I_z > 0 and req.deflection_limit > 0:
                # Use major axis I_z for bending downward
                deflection_check_mm = (M_Nmm * (L_mm ** 2)) / (12.0 * E_steel * I_z)
                utilization_deflection = deflection_check_mm / req.deflection_limit
            else:
                utilization_deflection = float("inf") if abs(req.bending_moment) > 0 else 0.0

        # --- Overall Check & Ranking ---
        utilizations: List[float] = [utilization_axial, utilization_shear, utilization_moment]
        if utilization_deflection is not None:
            utilizations.append(utilization_deflection)
        overall_utilization = max(utilizations) if utilizations else 1.0

        safety_margin = 0.0 if overall_utilization == float("inf") else (1.0 / overall_utilization) if overall_utilization > 0 else 0.0
        cost_score = section.cost_per_m / 1000.0 if section.cost_per_m is not None else 0.0
        weight_score = section.weight_per_m / 100.0 if section.weight_per_m is not None else 0.0
        rank_score = 0.5 * min(overall_utilization, 10.0) + 0.3 * cost_score + 0.2 * weight_score

        # Check conditions
        if utilization_axial <= req.utilization_target: checks_passed.append("IS 800 Cl 7.1.2: Buckling Compressive Strength")
        else: warnings.append(f"Compression Utilization {utilization_axial:.2f} > {req.utilization_target}")
            
        if utilization_moment <= req.utilization_target: checks_passed.append("IS 800 Cl 8.2: Lateral-Torsional Buckling (LTB)")
        else: warnings.append(f"LTB Utilization {utilization_moment:.2f} > {req.utilization_target}")

        if utilization_shear <= req.utilization_target: checks_passed.append("IS 800 Cl 8.4: Web Shear Strength")
        else: warnings.append(f"Shear Utilization {utilization_shear:.2f} > {req.utilization_target}")

        if utilization_deflection is not None:
            if utilization_deflection <= 1.0: checks_passed.append("IS 800 Cl 5.6.1: Serviceability (Deflection)")
            else: warnings.append(f"Deflection Utilization {utilization_deflection:.2f} > 1.0 (limit {req.deflection_limit} mm)")

        return RecommendationResult(
            section=section,
            utilization=overall_utilization,
            axial_capacity_kN=axial_capacity_kN,
            shear_capacity_kN=shear_capacity_kN,
            moment_capacity_kNm=moment_capacity_kNm,
            utilization_axial=utilization_axial,
            utilization_shear=utilization_shear,
            utilization_moment=utilization_moment,
            deflection_check_mm=deflection_check_mm,
            safety_margin=safety_margin,
            cost_score=cost_score,
            weight_score=weight_score,
            rank_score=rank_score,
            checks_passed=checks_passed,
            warnings=warnings,
        )

# Global instance
section_recommender = SectionRecommender()

def get_section_recommendations(requirements: Dict[str, Any], max_results: int = 5) -> List[Dict[str, Any]]:
    """
    Get section recommendations

    Args:
        requirements: Dict with keys:
            - axial_force: float (kN)
            - shear_force: float (kN)
            - bending_moment: float (kN·m)
            - deflection_limit: float (mm, optional)
            - span_length: float (m, optional)
            - code: str ("IS800", "AISC360", "EC3")
            - material: str ("steel", "concrete")
            - utilization_target: float (default 0.8)
        max_results: Maximum number of recommendations

    Returns:
        List of recommendation dicts
    """
    req = DesignRequirements(
        axial_force=requirements.get('axial_force', 0.0),
        shear_force=requirements.get('shear_force', 0.0),
        bending_moment=requirements.get('bending_moment', 0.0),
        deflection_limit=requirements.get('deflection_limit'),
        span_length=requirements.get('span_length'),
        code=requirements.get('code', 'IS800'),
        material=requirements.get('material', 'steel'),
        utilization_target=requirements.get('utilization_target', 0.8)
    )

    recommendations = section_recommender.recommend_sections(req, max_results)

    def _safe_sqrt(x: float) -> float:
        return math.sqrt(x) if x > 0 else 0.0

    def _section_properties_for_frontend(section: SectionProperties) -> Dict[str, Any]:
        # The frontend contract expects Ix/Iy and section moduli.
        # Backend database contains Iy/Iz; we map:
        #   Ix ~= Iz (weak/strong axis depends on local convention)
        #   Iy ~= Iy
        A = max(section.area, 0.0)
        Ix = max(section.iz, 0.0)
        Iy = max(section.iy, 0.0)

        rx = _safe_sqrt(Ix / A) if A > 0 else 0.0
        ry = _safe_sqrt(Iy / A) if A > 0 else 0.0

        # Rectangle-equivalent approximation:
        #   c ~= sqrt(3) * r
        #   Z ~= I / c
        Zx = (Ix / (math.sqrt(3.0) * rx)) if rx > 0 else 0.0
        Zy = (Iy / (math.sqrt(3.0) * ry)) if ry > 0 else 0.0

        return {
            "area": section.area,   # mm^2
            "Ix": Ix,              # mm^4
            "Iy": Iy,              # mm^4
            "Zx": Zx,              # mm^3
            "Zy": Zy,              # mm^3
            "rx": rx,              # mm
            "ry": ry,              # mm
            "weight_per_m": section.weight_per_m,  # kg/m
        }

    output: List[Dict[str, Any]] = []
    for r in recommendations:
        overall_util = float(r.utilization) if r.utilization is not None else 1.0
        # score: higher when utilization is lower
        score = 0.0 if overall_util <= 0 else min(100.0, (1.0 / overall_util) * 100.0)

        reasoning: List[str] = []
        reasoning.extend([f"PASS: {c}" for c in r.checks_passed])
        reasoning.extend(r.warnings)
        if not reasoning:
            reasoning = ["No checks applied."]

        design_checks: Dict[str, Any] = {
            "axial_capacity": r.axial_capacity_kN,
            "shear_capacity": r.shear_capacity_kN,
            "moment_capacity": r.moment_capacity_kNm,
            "utilization_axial": r.utilization_axial,
            "utilization_shear": r.utilization_shear,
            "utilization_moment": r.utilization_moment,
            "overall_utilization": overall_util,
        }
        if r.deflection_check_mm is not None:
            design_checks["deflection_check"] = r.deflection_check_mm

        output.append({
            "section_name": r.section.name,
            "section_type": r.section.section_type.value,
            "material": req.material,
            "properties": _section_properties_for_frontend(r.section),
            "design_checks": design_checks,
            "score": round(score, 3),
            "reasoning": reasoning,
        })

    return output