"""
lsd_integration.py - Integration of LSD Algorithm with Load Solver

Connects the reinforced concrete LSD design module with the structural
analysis load solver to provide end-to-end design workflow.

Workflow:
1. Run structural analysis (load_solver.py) → Get Mu and Vu
2. Apply load factors (partial safety factors for LSD)
3. Run RC beam bending design (IS 456:2000)
4. Return complete rebar specification

Author: BeamLab Ultimate Development Team
Date: March 2026
"""

import numpy as np
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
import json
import logging

# Assuming load_solver module is available
# from .load_solver import AnalysisResultFormatter, BackSubstitution

from .rc_limit_state_design import (
    BeamSection,
    ConcreteGrade,
    RebarGrade,
    ConcreteProperties,
    RebarProperties,
    LimitStateDesignBeam,
    LSDDesignResult,
)

logger = logging.getLogger(__name__)


# ============================================================================
# LOAD FACTORING FOR ULTIMATE DESIGN (IS 881AND IS 1893)
# ============================================================================

class LoadFactoring:
    """
    Apply partial safety factors to convert service loads to ultimate loads.
    
    IS 875:1987 and IS 1893:2016 specify:
    - Dead load factor: 1.5
    - Live load factor: 1.5
    - Wind load factor: 1.5 (for ultimate limit state)
    - Earthquake: As per IS 1893 (reduced factors)
    """
    
    # Partial safety factors (γ_f) - IS 875:1987, Clause 3.4
    PARTIAL_SAFETY_FACTORS = {
        'dead': 1.5,        # Permanent/self-weight
        'live': 1.5,        # Imposed/temporary load
        'wind': 1.5,        # Wind load
        'earthquake': 1.0,  # Seismic (combined with reduction factor)
    }
    
    @staticmethod
    def get_shear_moment_from_analysis(
        analysis_results: Dict,
        span_mm: float,
        load_case: str = 'dead+live'
    ) -> Tuple[float, float]:
        """
        Extract maximum moment and shear from analysis results.
        
        Parameters
        ----------
        analysis_results : Dict
            Results from load_solver (contains diagrams, member forces)
        span_mm : float
            Span length (mm) - for relating forces to moments
        load_case : str
            Load case combination type
        
        Returns
        -------
        (Mu, Vu) : Tuple
            Ultimate moment (kN·m), Ultimate shear (kN)
        """
        # If analysis_results has diagrams with moment values
        if 'diagrams' in analysis_results:
            # Find max bending moment
            max_moment = 0
            for member_id, diag in analysis_results['diagrams'].items():
                if 'moment_y' in diag:
                    max_moment = max(max_moment, max(np.abs(diag['moment_y'])))
            
            Mu = max_moment / 1e6  # Convert from N·mm to kN·m
        else:
            Mu = 0
        
        # Extract max shear
        if 'diagrams' in analysis_results:
            max_shear = 0
            for member_id, diag in analysis_results['diagrams'].items():
                if 'shear_y' in diag:
                    max_shear = max(max_shear, max(np.abs(diag['shear_y'])))
            
            Vu = max_shear / 1e3  # Convert from N to kN
        else:
            Vu = 0
        
        return Mu, Vu
    
    @staticmethod
    def factor_loads(
        Md: float,
        Vd: float,
        load_factor: float = 1.5
    ) -> Tuple[float, float]:
        """
        Apply load factor to service loads to get ultimate loads.
        
        Parameters
        ----------
        Md : float
            Service moment (kN·m)
        Vd : float
            Service shear (kN)
        load_factor : float
            Partial safety factor (typically 1.5)
        
        Returns
        -------
        (Mu, Vu) : Tuple
            Ultimate moment, shear
        """
        Mu = load_factor * Md
        Vu = load_factor * Vd
        
        logger.info(
            f"Load factoring: Md={Md:.2f} → Mu={Mu:.2f} (γ={load_factor}), "
            f"Vd={Vd:.2f} → Vu={Vu:.2f}"
        )
        
        return Mu, Vu


# ============================================================================
# RC BEAM DESIGN WORKFLOW
# ============================================================================

@dataclass
class DesignInput:
    """Complete input for RC beam LSD design"""
    # Structural analysis results
    Mu: float           # Ultimate moment (kN·m)
    Vu: float           # Ultimate shear (kN)
    
    # Section geometry
    beam_width: float   # mm
    beam_depth: float   # mm
    
    # Material properties
    concrete_grade: str  # 'M20', 'M25', 'M30', 'M35', 'M40'
    steel_grade: str     # 'Fe415', 'Fe500', 'Fe500S'
    
    # Optional overrides with defaults
    cover_tension: float = 50  # mm (to centroid of main steel)
    cover_compression: float = 50  # mm
    
    @property
    def effective_depth(self) -> float:
        """Calculate effective depth (d = D - cover - dia/2)"""
        # Assuming average main rebar diameter ~16mm
        d = self.beam_depth - self.cover_tension - 8  # 8 = dia/2 approx
        return d
    
    @property
    def compression_steel_depth(self) -> float:
        """Calculate compression steel depth (d' = cover + dia/2)"""
        return self.cover_compression + 10  # Assuming ~10mm stirrup


class RCBeamDesigner:
    """
    Complete RC beam design workflow integrating LSD algorithm.
    """
    
    def __init__(self, design_input: DesignInput):
        """
        Initialize designer with input parameters.
        
        Parameters
        ----------
        design_input : DesignInput
            All required design parameters
        """
        self.input = design_input
        self.result: Optional[LSDDesignResult] = None
    
    def validate_input(self) -> Tuple[bool, List[str]]:
        """
        Validate input parameters before design.
        
        Returns
        -------
        (is_valid, messages) : Tuple
            Validation status and list of warnings/errors
        """
        issues = []
        
        # Check dimensions
        if self.input.beam_width < 100:
            issues.append(f"Width {self.input.beam_width} mm is too small")
        
        if self.input.beam_depth < 150:
            issues.append(f"Depth {self.input.beam_depth} mm is too small")
        
        if self.input.beam_depth < 2 * self.input.beam_width:
            issues.append("Depth should typically be ≥ 2×width for efficiency")
        
        # Check cover
        if self.input.cover_tension < 25:
            issues.append("Cover < 25 mm (minimum durability requirement)")
        elif self.input.cover_tension > self.input.effective_depth / 3:
            issues.append(
                f"Cover {self.input.cover_tension} mm is large "
                f"(reduces effective depth)"
            )
        
        # Check concrete grade
        valid_grades = ['M20', 'M25', 'M30', 'M35', 'M40', 'M45', 'M50']
        if self.input.concrete_grade not in valid_grades:
            issues.append(f"Unknown concrete grade: {self.input.concrete_grade}")
        
        # Check steel grade
        valid_steels = ['Fe415', 'Fe500', 'Fe500S']
        if self.input.steel_grade not in valid_steels:
            issues.append(f"Unknown steel grade: {self.input.steel_grade}")
        
        # Check loads
        if self.input.Mu < 0:
            issues.append("Moment cannot be negative")
        
        if self.input.Vu < 0:
            issues.append("Shear cannot be negative")
        
        is_valid = len(issues) == 0
        
        if issues:
            logger.warning(f"Input validation issues: {len(issues)}")
            for issue in issues:
                logger.warning(f"  • {issue}")
        
        return is_valid, issues
    
    def design(self) -> Dict:
        """
        Execute complete RC beam design.
        
        Returns
        -------
        design_response : Dict
            Complete JSON-serializable design result
        """
        logger.info("=" * 70)
        logger.info("RC BEAM DESIGN - LSD WORKFLOW")
        logger.info("=" * 70)
        
        # Validate input
        is_valid, validation_issues = self.validate_input()
        if not is_valid:
            return {
                'status': 'error',
                'errors': validation_issues,
                'validation_passed': False
            }
        
        # Create section and material objects
        beam = BeamSection(
            b=self.input.beam_width,
            d=self.input.effective_depth,
            d_prime=self.input.compression_steel_depth
        )
        
        # Parse concrete grade
        concrete_grade_map = {
            'M20': ConcreteGrade.M20,
            'M25': ConcreteGrade.M25,
            'M30': ConcreteGrade.M30,
            'M35': ConcreteGrade.M35,
            'M40': ConcreteGrade.M40,
        }
        grade_enum = concrete_grade_map.get(
            self.input.concrete_grade,
            ConcreteGrade.M30
        )
        fck_map = {'M20': 20, 'M25': 25, 'M30': 30, 'M35': 35, 'M40': 40}
        
        concrete = ConcreteProperties(
            grade=grade_enum,
            fck=float(fck_map[self.input.concrete_grade])
        )
        
        # Parse steel grade
        steel_grade_map = {
            'Fe415': RebarGrade.Fe415,
            'Fe500': RebarGrade.Fe500,
            'Fe500S': RebarGrade.Fe500S,
        }
        fy_map = {'Fe415': 415, 'Fe500': 500, 'Fe500S': 500}
        
        rebar = RebarProperties(
            grade=steel_grade_map[self.input.steel_grade],
            fy=float(fy_map[self.input.steel_grade])
        )
        
        # Execute LSD design
        designer = LimitStateDesignBeam(
            Mu=self.input.Mu,
            Vu=self.input.Vu,
            beam=beam,
            concrete=concrete,
            rebar=rebar
        )
        
        self.result = designer.design()
        
        # Format response
        response = self._format_response(self.result)
        
        return response
    
    @staticmethod
    def _format_response(lsd_result: LSDDesignResult) -> Dict:
        """
        Format LSD result as JSON response.
        
        Returns
        -------
        response : Dict
            Complete, JSON-serializable design response
        """
        return {
            'status': 'success',
            'design': {
                'section': {
                    'width_mm': lsd_result.beam_section.b,
                    'depth_mm': lsd_result.beam_section.d,
                    'effective_depth_mm': lsd_result.beam_section.d,
                    'compression_depth_mm': lsd_result.beam_section.d_prime,
                },
                'concrete': {
                    'grade': lsd_result.concrete.grade.name,
                    'fck_mpa': lsd_result.concrete.fck,
                    'fcd_mpa': round(lsd_result.concrete.fcd, 2),
                    'modulus_mpa': round(lsd_result.concrete.Ec, 1),
                },
                'steel': {
                    'grade': lsd_result.rebar.grade.name,
                    'fy_mpa': lsd_result.rebar.fy,
                    'fyd_mpa': round(lsd_result.rebar.fyd, 2),
                    'modulus_mpa': lsd_result.rebar.Es,
                },
            },
            
            'loads': {
                'ultimate_moment_knm': round(lsd_result.Mu, 2),
                'ultimate_shear_kn': round(lsd_result.Vu, 2),
            },
            
            'limiting_moment': {
                'mu_lim_knm': round(lsd_result.limiting_moment.Mu_lim, 3),
                'xu_lim_mm': round(lsd_result.limiting_moment.xu_lim, 2),
                'z_lim_mm': round(lsd_result.limiting_moment.z_lim, 2),
                'ductile': lsd_result.limiting_moment.is_ductile,
            },
            
            'bending_design': {
                'type': lsd_result.bending.design_type,
                'tension_steel': {
                    'required_mm2': round(lsd_result.bending.Ast_required, 2),
                    'provided_mm2': round(
                        lsd_result.bending.main_rebar_count * 
                        (np.pi * (lsd_result.bending.main_rebar_size/2)**2),
                        2
                    ),
                    'bars': lsd_result.bending.main_rebar_desc,
                    'percentage': round(lsd_result.bending.pt, 3),
                },
                'compression_steel': {
                    'required_mm2': round(lsd_result.bending.Asc_required, 2),
                    'bars': lsd_result.bending.comp_rebar_desc if lsd_result.bending.comp_rebar_count > 0 else None,
                    'count': lsd_result.bending.comp_rebar_count,
                } if lsd_result.bending.Asc_required > 0 else None,
                'neutral_axis': {
                    'depth_mm': round(lsd_result.bending.xu, 2),
                    'ratio': round(lsd_result.bending.xu / lsd_result.beam_section.d, 3),
                },
                'lever_arm': {
                    'z_mm': round(lsd_result.bending.z, 2),
                    'ratio': round(lsd_result.bending.z / lsd_result.beam_section.d, 3),
                },
                'moment_capacity_knm': round(lsd_result.bending.Mu_provided, 3),
                'demand_capacity_ratio': round(lsd_result.bending.mu_ratio, 3),
            },
            
            'shear_design': {
                'nominal_stress_nmm2': round(lsd_result.shear.tau_v, 3),
                'design_strength_nmm2': round(lsd_result.shear.tau_c, 3),
                'requires_stirrups': lsd_result.shear.requires_stirrups,
                'stirrups': {
                    'diameter_mm': lsd_result.shear.stirrup_dia,
                    'spacing_mm': round(lsd_result.shear.stirrup_spacing, 0),
                    'specification': lsd_result.shear.stirrup_desc,
                },
                'demand_capacity_ratio': round(
                    lsd_result.shear.tau_v / lsd_result.shear.tau_c
                    if lsd_result.shear.tau_c > 0 else 999,
                    3
                ),
            },
            
            'rebar_layout': {
                'summary': lsd_result.rebar_summary,
                'bottom': lsd_result.bending.main_rebar_desc,
                'top': (lsd_result.bending.comp_rebar_desc 
                        if lsd_result.bending.comp_rebar_count > 0
                        else '2-10φ (minimum)'),
                'shear': lsd_result.shear.stirrup_desc,
            },
            
            'design_status': {
                'status': lsd_result.design_status,
                'design_ratio': round(lsd_result.design_ratio, 3),
                'passes': lsd_result.design_status == '✓ PASS',
                'notes': lsd_result.messages,
            },
        }


# ============================================================================
# EXAMPLES AND QUICK API
# ============================================================================

def design_rc_beam(
    Mu: float,
    Vu: float,
    width_mm: float,
    depth_mm: float,
    concrete_grade: str = 'M30',
    steel_grade: str = 'Fe500',
    cover_mm: float = 50
) -> Dict:
    """
    Quick API for RC beam design.
    
    Parameters
    ----------
    Mu : float
        Ultimate moment (kN·m)
    Vu : float
        Ultimate shear (kN)
    width_mm : float
        Beam width (mm)
    depth_mm : float
        Beam depth (mm)
    concrete_grade : str
        e.g., 'M30'
    steel_grade : str
        e.g., 'Fe500'
    cover_mm : float
        Cover to tension steel (mm)
    
    Returns
    -------
    design_result : Dict
        Complete design in JSON format
    """
    design_input = DesignInput(
        Mu=Mu,
        Vu=Vu,
        beam_width=width_mm,
        beam_depth=depth_mm,
        cover_tension=cover_mm,
        concrete_grade=concrete_grade,
        steel_grade=steel_grade
    )
    
    designer = RCBeamDesigner(design_input)
    return designer.design()


# ============================================================================
# MAIN - EXAMPLE WORKFLOW
# ============================================================================

if __name__ == "__main__":
    logging.basicConfig(
        level=logging.INFO,
        format='%(levelname)-8s | %(message)s'
    )
    
    print("\n" + "="*70)
    print("RC BEAM LSD DESIGN - INTEGRATION EXAMPLE")
    print("="*70 + "\n")
    
    # Example: Design a 300×600 mm beam with M30 and Fe500
    result = design_rc_beam(
        Mu=350.0,           # Ultimate moment (kN·m)
        Vu=200.0,           # Ultimate shear (kN)
        width_mm=300,       # mm
        depth_mm=600,       # mm
        concrete_grade='M30',
        steel_grade='Fe500',
        cover_mm=50         # mm
    )
    
    # Pretty print result
    print("\n" + "="*70)
    print("DESIGN RESULT (JSON)")
    print("="*70 + "\n")
    print(json.dumps(result, indent=2))
    
    # Extract key info
    if result['status'] == 'success':
        layout = result['rebar_layout']
        print("\n" + "="*70)
        print("FINAL REBAR SPECIFICATION (IS 456:2000)")
        print("="*70)
        print(f"\n{layout['summary']}\n")
        
        design_status = result['design_status']
        print(f"Status: {design_status['status']}")
        print(f"Design Ratio: {design_status['design_ratio']}")
